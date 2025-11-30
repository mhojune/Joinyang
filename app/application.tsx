import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Group = {
  id: string;
  name: string;
  requiresApplication?: boolean;
  applicationQuestions?: string[] | null;
  hasSchedule?: boolean;
  schedule?: {
    daysOfWeek?: number[];
    startTime?: string;
    endTime?: string;
  } | null;
};

export default function ApplicationScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [group, setGroup] = React.useState<Group | null>(null);
  const [answers, setAnswers] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<{ [key: number]: boolean }>({});

  // 시간을 분 단위로 변환하는 함수
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || timeStr.trim() === "") {
      return 0;
    }
    const [hours, minutes] = timeStr.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      return 0;
    }
    return hours * 60 + minutes;
  };

  // 주간 고정 일정과 겹치는지 확인하는 함수
  const checkWeeklyEventConflict = async (
    daysOfWeek: number[],
    startTimeStr: string,
    endTimeStr: string
  ): Promise<{ hasConflict: boolean; conflictEvent?: string }> => {
    if (!user) {
      return { hasConflict: false };
    }

    try {
      const weeklyEventsQuery = query(
        collection(db, "weeklyEvents"),
        where("userId", "==", user.uid)
      );
      const weeklyEventsSnapshot = await getDocs(weeklyEventsQuery);

      const groupStartMinutes = timeToMinutes(startTimeStr);
      const groupEndMinutes = timeToMinutes(endTimeStr);

      for (const docSnapshot of weeklyEventsSnapshot.docs) {
        const data = docSnapshot.data();
        const weeklyDaysOfWeek = data.daysOfWeek || [];
        const weeklyStartTime = data.startTime || "";
        const weeklyEndTime = data.endTime || "";
        const weeklyTitle = data.title || "";

        // 겹치는 요일이 있는지 확인
        const hasCommonDay = daysOfWeek.some((day) => weeklyDaysOfWeek.includes(day));
        if (!hasCommonDay) {
          continue;
        }

        // 시간이 겹치는지 확인
        const weeklyStartMinutes = timeToMinutes(weeklyStartTime);
        const weeklyEndMinutes = timeToMinutes(weeklyEndTime);

        // 시간 겹침 체크: startTime < other.endTime && endTime > other.startTime
        if (
          groupStartMinutes < weeklyEndMinutes &&
          groupEndMinutes > weeklyStartMinutes
        ) {
          return {
            hasConflict: true,
            conflictEvent: weeklyTitle,
          };
        }
      }

      return { hasConflict: false };
    } catch (error) {
      console.error("Error checking weekly event conflict:", error);
      return { hasConflict: false };
    }
  };

  React.useEffect(() => {
    if (groupId) {
      loadGroupData();
    }
  }, [groupId]);

  const loadGroupData = async () => {
    if (!groupId) return;

    setLoading(true);
    try {
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (groupDoc.exists()) {
        const groupData = {
          id: groupDoc.id,
          ...groupDoc.data(),
        } as Group;

        if (
          !groupData.requiresApplication ||
          !groupData.applicationQuestions ||
          groupData.applicationQuestions.length === 0
        ) {
          Alert.alert("오류", "이 모임은 신청서가 필요하지 않습니다.", [
            {
              text: "확인",
              onPress: () => router.back(),
            },
          ]);
          return;
        }

        setGroup(groupData);
        // 답변 배열 초기화
        setAnswers(new Array(groupData.applicationQuestions!.length).fill(""));
      } else {
        Alert.alert("오류", "모임을 찾을 수 없습니다.", [
          {
            text: "확인",
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error: any) {
      console.error("Error loading group data:", error);
      Alert.alert("오류", error?.message || "모임 데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !groupId || !group) return;

    // 답변 검증
    const newErrors: { [key: number]: boolean } = {};
    let hasError = false;

    group.applicationQuestions!.forEach((_, index) => {
      if (!answers[index] || answers[index].trim().length === 0) {
        newErrors[index] = true;
        hasError = true;
      }
    });

    if (hasError) {
      setErrors(newErrors);
      Alert.alert("입력 오류", "모든 질문에 답변해주세요.");
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      // 신청서 제출 (applications 컬렉션에 저장)
      const applicationsRef = collection(db, "applications");
      await addDoc(applicationsRef, {
        groupId: groupId,
        userId: user.uid,
        answers: answers.map((answer, index) => ({
          question: group.applicationQuestions![index],
          answer: answer.trim(),
        })),
        status: "pending", // pending, approved, rejected
        createdAt: serverTimestamp(),
      });

      Alert.alert("성공", "신청서가 제출되었습니다. 모임장의 승인을 기다려주세요.", [
        {
          text: "확인",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error submitting application:", error);
      Alert.alert("오류", error?.message || "신청서 제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!group || !group.applicationQuestions) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>신청서 작성</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>신청서를 불러올 수 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>신청서 작성</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 모임 정보 */}
          <View style={styles.groupInfoSection}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.groupInfoText}>모임 참여 신청서</Text>
          </View>

          {/* 신청서 질문들 */}
          <View style={styles.questionsSection}>
            {group.applicationQuestions.map((question, index) => (
              <View key={index} style={styles.questionContainer}>
                <Text style={styles.questionLabel}>
                  질문 {index + 1} <Text style={styles.required}>*</Text>
                </Text>
                <Text style={styles.questionText}>{question}</Text>
                <TextInput
                  style={[styles.answerInput, errors[index] && styles.answerInputError]}
                  placeholder="답변을 입력하세요"
                  value={answers[index] || ""}
                  onChangeText={(text) => {
                    const newAnswers = [...answers];
                    newAnswers[index] = text;
                    setAnswers(newAnswers);
                    if (errors[index]) {
                      setErrors((prev) => ({ ...prev, [index]: false }));
                    }
                  }}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  textAlignVertical="top"
                />
                {errors[index] && (
                  <Text style={styles.errorText}>답변을 입력해주세요</Text>
                )}
              </View>
            ))}
          </View>

          {/* 제출 버튼 */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>신청서 제출</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  headerSpacer: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorText: {
    fontSize: 12,
    color: "#FF4444",
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  groupInfoSection: {
    padding: 24,
    backgroundColor: "#F9F9F9",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  groupName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  groupInfoText: {
    fontSize: 14,
    color: "#666",
  },
  questionsSection: {
    padding: 16,
  },
  questionContainer: {
    marginBottom: 24,
  },
  questionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  required: {
    color: "#FF4444",
  },
  questionText: {
    fontSize: 15,
    color: "#666",
    marginBottom: 12,
    lineHeight: 22,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#333",
    backgroundColor: "#fff",
    minHeight: 100,
  },
  answerInputError: {
    borderColor: "#FF4444",
    borderWidth: 2,
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4A90E2",
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
