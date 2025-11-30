import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type GroupType = "study" | "hobby";

export default function EditGroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // 폼 상태
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<GroupType>("study");
  const [hasSchedule, setHasSchedule] = React.useState<boolean | null>(null);
  const [selectedDays, setSelectedDays] = React.useState<number[]>([]);
  const [startTime, setStartTime] = React.useState<Date>(new Date());
  const [endTime, setEndTime] = React.useState<Date>(new Date());
  const [location, setLocation] = React.useState("");
  const [requiresApplication, setRequiresApplication] = React.useState<boolean | null>(
    null
  );
  const [applicationQuestions, setApplicationQuestions] = React.useState<string[]>([""]);

  // 피커 상태
  const [showStartTimePicker, setShowStartTimePicker] = React.useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = React.useState(false);

  // 에러 상태
  const [errors, setErrors] = React.useState<{
    name?: boolean;
    description?: boolean;
    location?: boolean;
  }>({});
  const [scheduleError, setScheduleError] = React.useState("");

  React.useEffect(() => {
    if (groupId) {
      loadGroupData();
    }
  }, [groupId]);

  const loadGroupData = async () => {
    if (!groupId || !user) return;

    setLoading(true);
    try {
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();

        // 모임장 권한 확인
        if (groupData.creatorId !== user.uid) {
          Alert.alert("권한 없음", "모임장만 편집할 수 있습니다.", [
            {
              text: "확인",
              onPress: () => router.back(),
            },
          ]);
          return;
        }

        // 데이터 로드
        setName(groupData.name || "");
        setDescription(groupData.description || "");
        setType(groupData.type || "study");
        setLocation(groupData.location || "");
        setHasSchedule(
          groupData.hasSchedule === true
            ? true
            : groupData.hasSchedule === false
            ? false
            : null
        );
        setRequiresApplication(
          groupData.requiresApplication === true
            ? true
            : groupData.requiresApplication === false
            ? false
            : null
        );

        // 일정 데이터 로드
        if (groupData.schedule) {
          const schedule = groupData.schedule;
          setSelectedDays(schedule.daysOfWeek || []);

          if (schedule.startTime) {
            const [hours, minutes] = schedule.startTime.split(":").map(Number);
            const startDate = new Date();
            startDate.setHours(hours, minutes, 0, 0);
            setStartTime(startDate);
          }

          if (schedule.endTime) {
            const [hours, minutes] = schedule.endTime.split(":").map(Number);
            const endDate = new Date();
            endDate.setHours(hours, minutes, 0, 0);
            setEndTime(endDate);
          }
        }

        // 신청서 문답 로드
        if (
          groupData.applicationQuestions &&
          Array.isArray(groupData.applicationQuestions)
        ) {
          if (groupData.applicationQuestions.length > 0) {
            setApplicationQuestions(groupData.applicationQuestions);
          } else {
            setApplicationQuestions([""]);
          }
        } else {
          setApplicationQuestions([""]);
        }
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

  const handleSave = async () => {
    if (!user || !groupId) {
      Alert.alert("오류", "로그인이 필요합니다.");
      return;
    }

    // 모든 필수 필드 검증
    const newErrors: {
      name?: boolean;
      description?: boolean;
      location?: boolean;
    } = {};
    const missingFields: string[] = [];

    if (!name.trim()) {
      newErrors.name = true;
      missingFields.push("모임 이름");
    }

    if (!description.trim()) {
      newErrors.description = true;
      missingFields.push("모임 설명");
    }

    if (!location.trim()) {
      newErrors.location = true;
      missingFields.push("모임 장소");
    }

    // 에러가 있으면 표시하고 중단
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const errorMessage = `다음 필드를 입력해주세요:\n\n${missingFields
        .map((field) => `• ${field}`)
        .join("\n")}`;
      Alert.alert("입력 오류", errorMessage);
      return;
    }

    // 에러 상태 초기화
    setErrors({});

    setSaving(true);
    try {
      // 일정 데이터 구성
      let scheduleData = null;
      if (hasSchedule === true) {
        // 요일 검증
        if (selectedDays.length === 0) {
          Alert.alert("입력 오류", "모임 요일을 선택해주세요.");
          setSaving(false);
          return;
        }

        // 시간 검증
        const startHours = startTime.getHours();
        const startMinutes = startTime.getMinutes();
        const endHours = endTime.getHours();
        const endMinutes = endTime.getMinutes();

        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;

        // 시작 시간이 마침 시간보다 늦거나 같으면 오류
        if (startTotalMinutes >= endTotalMinutes) {
          setScheduleError("시작 시간은 종료 시간보다 이전이어야 합니다.");
          setSaving(false);
          return;
        }

        // 에러 초기화
        setScheduleError("");

        scheduleData = {
          daysOfWeek: selectedDays.sort(),
          startTime: `${String(startHours).padStart(2, "0")}:${String(
            startMinutes
          ).padStart(2, "0")}`,
          endTime: `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(
            2,
            "0"
          )}`,
        };
      }

      // 신청서 문답 검증
      let applicationQuestionsData: string[] | null = null;
      if (requiresApplication === true) {
        const validQuestions = applicationQuestions.filter((q) => q.trim().length > 0);
        if (validQuestions.length === 0) {
          Alert.alert("입력 오류", "신청서 문답을 최소 1개 이상 입력해주세요.");
          setSaving(false);
          return;
        }
        applicationQuestionsData = validQuestions.map((q) => q.trim());
      }

      const updateData = {
        name: name.trim(),
        description: description.trim(),
        type: type,
        hasSchedule: hasSchedule === true,
        schedule: scheduleData,
        location: location.trim(),
        requiresApplication: requiresApplication === true,
        applicationQuestions: applicationQuestionsData,
      };

      await updateDoc(doc(db, "groups", groupId), updateData);

      Alert.alert("성공", "모임 정보가 수정되었습니다.", [
        {
          text: "확인",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error updating group:", error);
      Alert.alert("오류", error?.message || "모임 수정에 실패했습니다.");
    } finally {
      setSaving(false);
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>모임 편집</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 20}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 모임 이름 */}
          <View style={styles.section}>
            <Text style={styles.label}>
              모임 이름 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="모임 이름을 입력하세요"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) {
                  setErrors((prev) => ({ ...prev, name: false }));
                }
              }}
              maxLength={50}
            />
            {errors.name && (
              <Text style={styles.errorText}>모임 이름을 입력해주세요</Text>
            )}
          </View>

          {/* 모임 설명 */}
          <View style={styles.section}>
            <Text style={styles.label}>
              모임 설명 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                errors.description && styles.inputError,
              ]}
              placeholder="모임에 대한 설명을 입력하세요"
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                if (errors.description) {
                  setErrors((prev) => ({ ...prev, description: false }));
                }
              }}
              multiline
              numberOfLines={4}
              maxLength={200}
              textAlignVertical="top"
            />
            {errors.description && (
              <Text style={styles.errorText}>모임 설명을 입력해주세요</Text>
            )}
          </View>

          {/* 모임 타입 */}
          <View style={styles.section}>
            <Text style={styles.label}>
              모임 타입 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.typeContainer}>
              <TouchableOpacity
                style={[styles.typeButton, type === "study" && styles.typeButtonActive]}
                onPress={() => setType("study")}
              >
                <Ionicons
                  name="school-outline"
                  size={24}
                  color={type === "study" ? "#fff" : "#666"}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    type === "study" && styles.typeButtonTextActive,
                  ]}
                >
                  공부하는 스터디
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, type === "hobby" && styles.typeButtonActive]}
                onPress={() => setType("hobby")}
              >
                <Ionicons
                  name="heart-outline"
                  size={24}
                  color={type === "hobby" ? "#fff" : "#666"}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    type === "hobby" && styles.typeButtonTextActive,
                  ]}
                >
                  그냥 취미 모임
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 모임 일정 */}
          <View style={styles.section}>
            <Text style={styles.label}>모임 일정</Text>

            {/* 일정 유형 선택 */}
            <View style={styles.scheduleTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.scheduleTypeButton,
                  hasSchedule === true && styles.scheduleTypeButtonActive,
                ]}
                onPress={() => setHasSchedule(true)}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={hasSchedule === true ? "#fff" : "#666"}
                />
                <Text
                  style={[
                    styles.scheduleTypeButtonText,
                    hasSchedule === true && styles.scheduleTypeButtonTextActive,
                  ]}
                >
                  시간 확정 모임
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.scheduleTypeButton,
                  hasSchedule === false && styles.scheduleTypeButtonActive,
                ]}
                onPress={() => setHasSchedule(false)}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={20}
                  color={hasSchedule === false ? "#fff" : "#666"}
                />
                <Text
                  style={[
                    styles.scheduleTypeButtonText,
                    hasSchedule === false && styles.scheduleTypeButtonTextActive,
                  ]}
                >
                  시간 미정 모임
                </Text>
              </TouchableOpacity>
            </View>

            {/* 시간 정하는 모임인 경우 요일/시간 선택 */}
            {hasSchedule === true && (
              <View style={styles.scheduleInputs}>
                {/* 요일 선택 */}
                <View style={styles.daysContainer}>
                  <Text style={styles.scheduleLabel}>요일</Text>
                  <View style={styles.daysRow}>
                    {[
                      { day: 0, label: "일" },
                      { day: 1, label: "월" },
                      { day: 2, label: "화" },
                      { day: 3, label: "수" },
                      { day: 4, label: "목" },
                      { day: 5, label: "금" },
                      { day: 6, label: "토" },
                    ].map(({ day, label }) => (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dayButton,
                          selectedDays.includes(day) && styles.dayButtonActive,
                        ]}
                        onPress={() => {
                          if (selectedDays.includes(day)) {
                            setSelectedDays(selectedDays.filter((d) => d !== day));
                          } else {
                            setSelectedDays([...selectedDays, day]);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.dayButtonText,
                            selectedDays.includes(day) && styles.dayButtonTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 시작 시간 선택 */}
                <View style={styles.scheduleRow}>
                  <Text style={styles.scheduleLabel}>시작 시간</Text>
                  <TouchableOpacity
                    style={styles.scheduleButton}
                    onPress={() => {
                      setShowStartTimePicker(true);
                    }}
                  >
                    <Ionicons name="time-outline" size={18} color="#4A90E2" />
                    <Text style={styles.scheduleButtonText}>
                      {String(startTime.getHours()).padStart(2, "0")}:
                      {String(startTime.getMinutes()).padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 마침 시간 선택 */}
                <View style={styles.scheduleRow}>
                  <Text style={styles.scheduleLabel}>마침 시간</Text>
                  <TouchableOpacity
                    style={styles.scheduleButton}
                    onPress={() => {
                      setShowEndTimePicker(true);
                    }}
                  >
                    <Ionicons name="time-outline" size={18} color="#4A90E2" />
                    <Text style={styles.scheduleButtonText}>
                      {String(endTime.getHours()).padStart(2, "0")}:
                      {String(endTime.getMinutes()).padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 시간 에러 메시지 */}
                {scheduleError ? (
                  <View style={styles.scheduleErrorContainer}>
                    <Ionicons name="alert-circle-outline" size={16} color="#FF6B6B" />
                    <Text style={styles.scheduleErrorText}>{scheduleError}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* 시간 피커 모달 */}
          {(showStartTimePicker || showEndTimePicker) && (
            <Modal
              visible={true}
              transparent={true}
              animationType="fade"
              onRequestClose={() => {
                setShowStartTimePicker(false);
                setShowEndTimePicker(false);
              }}
            >
              <TouchableOpacity
                style={styles.pickerOverlay}
                activeOpacity={1}
                onPress={() => {
                  setShowStartTimePicker(false);
                  setShowEndTimePicker(false);
                }}
              >
                <View style={styles.pickerContainer}>
                  {Platform.OS === "ios" && (
                    <View style={styles.pickerHeader}>
                      <TouchableOpacity
                        onPress={() => {
                          setShowStartTimePicker(false);
                          setShowEndTimePicker(false);
                        }}
                      >
                        <Text style={styles.pickerCancelText}>취소</Text>
                      </TouchableOpacity>
                      <Text style={styles.pickerTitle}>
                        {showStartTimePicker ? "시작 시간 선택" : "마침 시간 선택"}
                      </Text>
                      <View style={{ width: 50 }} />
                    </View>
                  )}
                  <DateTimePicker
                    value={showStartTimePicker ? startTime : endTime}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(event, selectedDate) => {
                      if (Platform.OS === "android") {
                        setShowStartTimePicker(false);
                        setShowEndTimePicker(false);
                      }
                      if (selectedDate) {
                        if (showStartTimePicker) {
                          setStartTime(selectedDate);
                          setScheduleError("");
                          if (Platform.OS === "ios") {
                            setShowStartTimePicker(false);
                          }
                        } else if (showEndTimePicker) {
                          setEndTime(selectedDate);
                          setScheduleError("");
                          if (Platform.OS === "ios") {
                            setShowEndTimePicker(false);
                          }
                        }
                      }
                    }}
                  />
                  {Platform.OS === "ios" && (
                    <TouchableOpacity
                      style={styles.pickerConfirmButton}
                      onPress={() => {
                        setShowStartTimePicker(false);
                        setShowEndTimePicker(false);
                      }}
                    >
                      <Text style={styles.pickerConfirmText}>확인</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            </Modal>
          )}

          {/* 모임 장소 */}
          <View style={styles.section}>
            <Text style={styles.label}>
              모임 장소 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.location && styles.inputError]}
              placeholder="모임 장소를 입력하세요"
              value={location}
              onChangeText={(text) => {
                setLocation(text);
                if (errors.location) {
                  setErrors((prev) => ({ ...prev, location: false }));
                }
              }}
              maxLength={100}
            />
            {errors.location && (
              <Text style={styles.errorText}>모임 장소를 입력해주세요</Text>
            )}
          </View>

          {/* 모임 참여 방식 */}
          <View style={styles.section}>
            <Text style={styles.label}>모임 참여 방식</Text>

            {/* 참여 방식 선택 */}
            <View style={styles.scheduleTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.scheduleTypeButton,
                  requiresApplication === false && styles.scheduleTypeButtonActive,
                ]}
                onPress={() => {
                  setRequiresApplication(false);
                  setApplicationQuestions([""]);
                }}
              >
                <Ionicons
                  name="person-add-outline"
                  size={20}
                  color={requiresApplication === false ? "#fff" : "#666"}
                />
                <Text
                  style={[
                    styles.scheduleTypeButtonText,
                    requiresApplication === false && styles.scheduleTypeButtonTextActive,
                  ]}
                >
                  자유 가입
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.scheduleTypeButton,
                  requiresApplication === true && styles.scheduleTypeButtonActive,
                ]}
                onPress={() => setRequiresApplication(true)}
              >
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={requiresApplication === true ? "#fff" : "#666"}
                />
                <Text
                  style={[
                    styles.scheduleTypeButtonText,
                    requiresApplication === true && styles.scheduleTypeButtonTextActive,
                  ]}
                >
                  신청서 필요
                </Text>
              </TouchableOpacity>
            </View>

            {/* 신청서 문답 작성 */}
            {requiresApplication === true && (
              <View style={styles.applicationSection}>
                <Text style={styles.applicationLabel}>신청서 문답</Text>
                <Text style={styles.applicationHint}>
                  모임 참여 신청 시 답변할 질문을 작성해주세요
                </Text>
                {applicationQuestions.map((question, index) => (
                  <View key={index} style={styles.questionContainer}>
                    <View style={styles.questionHeader}>
                      <Text style={styles.questionNumber}>질문 {index + 1}</Text>
                      {applicationQuestions.length > 1 && (
                        <TouchableOpacity
                          style={styles.deleteQuestionButton}
                          onPress={() => {
                            const newQuestions = applicationQuestions.filter(
                              (_, i) => i !== index
                            );
                            setApplicationQuestions(newQuestions);
                          }}
                        >
                          <Ionicons name="close-circle" size={20} color="#FF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={styles.questionInput}
                      placeholder="질문을 입력하세요"
                      value={question}
                      onChangeText={(text) => {
                        const newQuestions = [...applicationQuestions];
                        newQuestions[index] = text;
                        setApplicationQuestions(newQuestions);
                      }}
                      maxLength={200}
                    />
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addQuestionButton}
                  onPress={() => {
                    setApplicationQuestions([...applicationQuestions, ""]);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#4A90E2" />
                  <Text style={styles.addQuestionText}>질문 추가</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 저장 버튼 */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>저장하기</Text>
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
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  required: {
    color: "#FF4444",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fff",
  },
  inputError: {
    borderColor: "#FF4444",
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: "#FF4444",
    marginTop: 4,
  },
  textArea: {
    minHeight: 100,
  },
  typeContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: "#4A90E2",
    borderColor: "#4A90E2",
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  typeButtonTextActive: {
    color: "#fff",
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4A90E2",
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  scheduleTypeContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  scheduleTypeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
    gap: 6,
  },
  scheduleTypeButtonActive: {
    backgroundColor: "#4A90E2",
    borderColor: "#4A90E2",
  },
  scheduleTypeButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
  },
  scheduleTypeButtonTextActive: {
    color: "#fff",
  },
  scheduleInputs: {
    marginTop: 16,
    gap: 16,
  },
  daysContainer: {
    gap: 8,
  },
  daysRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  dayButtonActive: {
    backgroundColor: "#4A90E2",
    borderColor: "#4A90E2",
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  dayButtonTextActive: {
    color: "#fff",
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scheduleLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    width: 80,
  },
  scheduleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#F9F9F9",
  },
  scheduleButtonText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "90%",
    maxWidth: 400,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  pickerCancelText: {
    fontSize: 16,
    color: "#666",
  },
  pickerConfirmButton: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: "#4A90E2",
    borderRadius: 8,
    alignItems: "center",
  },
  pickerConfirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  applicationSection: {
    marginTop: 16,
    gap: 12,
  },
  applicationLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  applicationHint: {
    fontSize: 12,
    color: "#999",
    marginBottom: 8,
  },
  questionContainer: {
    gap: 8,
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  questionNumber: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  deleteQuestionButton: {
    padding: 4,
  },
  questionInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#fff",
  },
  addQuestionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4A90E2",
    borderStyle: "dashed",
    gap: 6,
    marginTop: 4,
  },
  addQuestionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4A90E2",
  },
  scheduleErrorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FFE0E0",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  scheduleErrorText: {
    flex: 1,
    fontSize: 14,
    color: "#FF6B6B",
    fontWeight: "500",
  },
});
