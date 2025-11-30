import { useAuth } from "@/lib/auth-context";
import { db, realtimeDb } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ref, set } from "firebase/database";
import { arrayUnion, doc, getDoc, increment, updateDoc } from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Application = {
  id: string;
  groupId: string;
  userId: string;
  answers: Array<{ question: string; answer: string }>;
  status: "pending" | "approved" | "rejected";
  createdAt: any;
};

type Group = {
  id: string;
  name: string;
  creatorId: string;
  members: string[];
  memberCount: number;
};

type UserData = {
  userId: string;
  email: string;
  intro: string;
  avatarUrl?: string;
  createdAt: any;
  joinedGroups: string[];
};

export default function ViewApplicationScreen() {
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [application, setApplication] = React.useState<Application | null>(null);
  const [group, setGroup] = React.useState<Group | null>(null);
  const [applicant, setApplicant] = React.useState<UserData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState(false);

  React.useEffect(() => {
    if (applicationId) {
      loadApplicationData();
    }
  }, [applicationId]);

  const loadApplicationData = async () => {
    if (!applicationId) return;

    setLoading(true);
    try {
      // 신청서 데이터 로드
      const applicationDoc = await getDoc(doc(db, "applications", applicationId));
      if (!applicationDoc.exists()) {
        Alert.alert("오류", "신청서를 찾을 수 없습니다.", [
          {
            text: "확인",
            onPress: () => router.back(),
          },
        ]);
        return;
      }

      const applicationData = {
        id: applicationDoc.id,
        ...applicationDoc.data(),
      } as Application;
      setApplication(applicationData);

      // 모임 데이터 로드
      const groupDoc = await getDoc(doc(db, "groups", applicationData.groupId));
      if (groupDoc.exists()) {
        setGroup({
          id: groupDoc.id,
          ...groupDoc.data(),
        } as Group);
      }

      // 신청자 정보 로드
      const applicantDoc = await getDoc(doc(db, "users", applicationData.userId));
      if (applicantDoc.exists()) {
        setApplicant(applicantDoc.data() as UserData);
      }
    } catch (error) {
      console.error("Error loading application data:", error);
      Alert.alert("오류", "신청서를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!application || !group || !user) return;

    // 모임장인지 확인
    if (group.creatorId !== user.uid) {
      Alert.alert("오류", "모임장만 승인할 수 있습니다.");
      return;
    }

    setProcessing(true);
    try {
      // 신청서 상태를 승인으로 변경
      await updateDoc(doc(db, "applications", application.id), {
        status: "approved",
      });

      // 모임에 멤버 추가
      await updateDoc(doc(db, "groups", group.id), {
        members: arrayUnion(application.userId),
        memberCount: increment(1),
      });

      // 사용자의 joinedGroups에 추가
      const userDoc = await getDoc(doc(db, "users", application.userId));
      const userData = userDoc.data();
      const joinedGroups = userData?.joinedGroups || [];
      if (!joinedGroups.includes(group.id)) {
        await updateDoc(doc(db, "users", application.userId), {
          joinedGroups: arrayUnion(group.id),
        });
      }

      // Realtime Database에 그룹 멤버 정보 추가 (채팅방 접근 권한용)
      const memberRef = ref(realtimeDb, `groupMembers/${group.id}/${application.userId}`);
      await set(memberRef, true);

      Alert.alert("성공", "신청서가 승인되었습니다.", [
        {
          text: "확인",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error approving application:", error);
      Alert.alert("오류", error?.message || "승인 처리에 실패했습니다.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!application || !group || !user) return;

    // 모임장인지 확인
    if (group.creatorId !== user.uid) {
      Alert.alert("오류", "모임장만 거절할 수 있습니다.");
      return;
    }

    Alert.alert("신청서 거절", "정말 이 신청서를 거절하시겠습니까?", [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "거절",
        style: "destructive",
        onPress: async () => {
          setProcessing(true);
          try {
            await updateDoc(doc(db, "applications", application.id), {
              status: "rejected",
            });

            Alert.alert("완료", "신청서가 거절되었습니다.", [
              {
                text: "확인",
                onPress: () => router.back(),
              },
            ]);
          } catch (error: any) {
            console.error("Error rejecting application:", error);
            Alert.alert("오류", error?.message || "거절 처리에 실패했습니다.");
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>신청서 상세</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!application || !group || !applicant) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>신청서 상세</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>신청서를 불러올 수 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCreator = user && group.creatorId === user.uid;
  const avatarUrl =
    applicant.avatarUrl ||
    `https://api.dicebear.com/9.x/identicon/png?seed=${encodeURIComponent(
      applicant.userId || "unknown"
    )}&size=128`;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>신청서 상세</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 모임 정보 */}
        <View style={styles.groupSection}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupInfoText}>모임 참여 신청서</Text>
        </View>

        {/* 신청자 정보 */}
        <View style={styles.applicantSection}>
          <Text style={styles.sectionTitle}>신청자 정보</Text>
          <View style={styles.applicantCard}>
            <View style={styles.applicantHeader}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.applicantAvatar} />
              ) : (
                <View style={styles.applicantAvatarPlaceholder}>
                  <Ionicons name="person" size={24} color="#999" />
                </View>
              )}
              <View style={styles.applicantInfo}>
                <Text style={styles.applicantName}>
                  {applicant.userId || "알 수 없음"}
                </Text>
                {applicant.intro && (
                  <Text style={styles.applicantIntro} numberOfLines={2}>
                    {applicant.intro}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* 신청서 답변 */}
        <View style={styles.answersSection}>
          <Text style={styles.sectionTitle}>신청서 답변</Text>
          {application.answers.map((item, index) => (
            <View key={index} style={styles.answerCard}>
              <View style={styles.questionHeader}>
                <Text style={styles.questionNumber}>질문 {index + 1}</Text>
              </View>
              <Text style={styles.questionText}>{item.question}</Text>
              <View style={styles.answerContainer}>
                <Text style={styles.answerText}>{item.answer}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 모임장인 경우 승인/거절 버튼 */}
        {isCreator && application.status === "pending" && (
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleReject}
              disabled={processing}
            >
              <Ionicons name="close" size={20} color="#FF4444" />
              <Text style={styles.rejectButtonText}>거절</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={handleApprove}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.approveButtonText}>승인</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 상태 표시 */}
        {application.status !== "pending" && (
          <View style={styles.statusSection}>
            <View
              style={[
                styles.statusBadge,
                application.status === "approved"
                  ? styles.statusBadgeApproved
                  : styles.statusBadgeRejected,
              ]}
            >
              <Ionicons
                name={
                  application.status === "approved" ? "checkmark-circle" : "close-circle"
                }
                size={16}
                color={application.status === "approved" ? "#4CAF50" : "#FF4444"}
              />
              <Text
                style={[
                  styles.statusText,
                  application.status === "approved"
                    ? styles.statusTextApproved
                    : styles.statusTextRejected,
                ]}
              >
                {application.status === "approved" ? "승인됨" : "거절됨"}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
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
    fontSize: 16,
    color: "#666",
  },
  content: {
    flex: 1,
  },
  groupSection: {
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
  applicantSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  applicantCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  applicantHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  applicantAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  applicantAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  applicantInfo: {
    flex: 1,
    gap: 4,
  },
  applicantName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  applicantIntro: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  answersSection: {
    padding: 20,
  },
  answerCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  questionHeader: {
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A90E2",
  },
  questionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
    lineHeight: 22,
  },
  answerContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  answerText: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
  },
  actionSection: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    paddingBottom: 32,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  approveButton: {
    backgroundColor: "#4A90E2",
  },
  rejectButton: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#FF4444",
  },
  approveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  rejectButtonText: {
    color: "#FF4444",
    fontSize: 16,
    fontWeight: "600",
  },
  statusSection: {
    padding: 20,
    paddingBottom: 32,
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgeApproved: {
    backgroundColor: "#E8F5E9",
  },
  statusBadgeRejected: {
    backgroundColor: "#FFEBEE",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusTextApproved: {
    color: "#4CAF50",
  },
  statusTextRejected: {
    color: "#FF4444",
  },
});
