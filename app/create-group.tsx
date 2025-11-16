import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// 랜덤 색상 생성 함수
const generateRandomColor = (): string => {
  const colors = [
    "#FF6B6B", // 빨강
    "#4ECDC4", // 청록
    "#45B7D1", // 하늘색
    "#FFA07A", // 연어색
    "#98D8C8", // 민트
    "#F7DC6F", // 노랑
    "#BB8FCE", // 보라
    "#85C1E2", // 파랑
    "#F8B88B", // 복숭아
    "#82E0AA", // 연두
    "#F1948A", // 분홍
    "#5DADE2", // 밝은 파랑
    "#AED6F1", // 연한 파랑
    "#A9DFBF", // 연한 초록
    "#F9E79F", // 연한 노랑
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

type GroupType = "study" | "hobby";

export default function CreateGroupScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);

  // 폼 상태
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<GroupType>("study");
  const [hasSchedule, setHasSchedule] = React.useState<boolean | null>(null); // null: 선택 안함, true: 시간 정하는 모임, false: 모이는 거 없는 모임
  const [selectedDays, setSelectedDays] = React.useState<number[]>([]); // 0: 일요일, 1: 월요일, ..., 6: 토요일
  const [startTime, setStartTime] = React.useState<Date>(new Date());
  const [endTime, setEndTime] = React.useState<Date>(new Date());
  const [location, setLocation] = React.useState("");

  // 피커 상태
  const [showStartTimePicker, setShowStartTimePicker] = React.useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = React.useState(false);

  // 에러 상태
  const [errors, setErrors] = React.useState<{
    name?: boolean;
    description?: boolean;
    location?: boolean;
  }>({});

  const handleCreate = async () => {
    if (!user) {
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

    setCreating(true);
    try {
      // 랜덤 색상 생성
      const color = generateRandomColor();

      // 새 모임 생성
      const groupsRef = collection(db, "groups");
      const newGroupRef = doc(groupsRef);

      // 일정 데이터 구성
      let scheduleData = null;
      if (hasSchedule === true) {
        // 요일 검증
        if (selectedDays.length === 0) {
          Alert.alert("입력 오류", "모임 요일을 선택해주세요.");
          return;
        }

        // 시간 검증
        const startHours = startTime.getHours();
        const startMinutes = startTime.getMinutes();
        const endHours = endTime.getHours();
        const endMinutes = endTime.getMinutes();

        // 시작 시간이 마침 시간보다 늦거나 같으면 오류
        if (
          startHours > endHours ||
          (startHours === endHours && startMinutes >= endMinutes)
        ) {
          Alert.alert("입력 오류", "시작 시간은 마침 시간보다 이전이어야 합니다.");
          return;
        }

        scheduleData = {
          daysOfWeek: selectedDays.sort(), // 요일 배열 (0: 일요일, 1: 월요일, ..., 6: 토요일)
          startTime: `${String(startHours).padStart(2, "0")}:${String(
            startMinutes
          ).padStart(2, "0")}`,
          endTime: `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(
            2,
            "0"
          )}`,
        };
      }

      const newGroup = {
        name: name.trim(),
        description: description.trim(),
        type: type,
        hasSchedule: hasSchedule === true,
        schedule: scheduleData,
        location: location.trim(),
        color: color,
        creatorId: user.uid,
        members: [user.uid],
        memberCount: 1,
        createdAt: serverTimestamp(),
      };

      await setDoc(newGroupRef, newGroup);

      // 사용자의 joinedGroups에 추가
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      const joinedGroups = userData?.joinedGroups || [];
      await setDoc(
        doc(db, "users", user.uid),
        {
          joinedGroups: [...joinedGroups, newGroupRef.id],
        },
        { merge: true }
      );

      Alert.alert("성공", "모임이 생성되었습니다.", [
        {
          text: "확인",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error creating group:", error);
      Alert.alert("오류", error?.message || "모임 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 헤더 (뒤로가기만) */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>모임 만들기</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
          {errors.name && <Text style={styles.errorText}>모임 이름을 입력해주세요</Text>}
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
                        if (Platform.OS === "ios") {
                          setShowStartTimePicker(false);
                        }
                      } else if (showEndTimePicker) {
                        setEndTime(selectedDate);
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

        {/* 생성 버튼 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.createButton, creating && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.createButtonText}>모임 만들기</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
  hint: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
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
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4A90E2",
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
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
});
