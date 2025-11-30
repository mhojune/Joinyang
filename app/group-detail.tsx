import { useAuth } from "@/lib/auth-context";
import { db, realtimeDb } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ref, set } from "firebase/database";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Group = {
  id: string;
  name: string;
  description: string;
  type?: "study" | "hobby";
  hasSchedule?: boolean;
  schedule?: {
    daysOfWeek?: number[];
    startTime?: string;
    endTime?: string;
  } | null;
  location?: string;
  color?: string;
  creatorId: string;
  members: string[];
  memberCount: number;
  requiresApplication?: boolean;
  applicationQuestions?: string[] | null;
  createdAt: any;
};

type UserData = {
  userId: string;
  email: string;
  intro: string;
  avatarUrl?: string;
  createdAt: any;
  joinedGroups: string[];
};

const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [group, setGroup] = React.useState<Group | null>(null);
  const [creator, setCreator] = React.useState<UserData | null>(null);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [hasPendingApplication, setHasPendingApplication] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (groupId) {
      loadGroupData();
    }
  }, [groupId, user]);

  // 화면이 포커스될 때마다 데이터 새로고침
  useFocusEffect(
    React.useCallback(() => {
      if (groupId) {
        loadGroupData();
      }
    }, [groupId, user])
  );

  const loadGroupData = async () => {
    if (!groupId) return;

    setLoading(true);
    try {
      // 모임 데이터 로드
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (groupDoc.exists()) {
        const groupData = {
          id: groupDoc.id,
          ...groupDoc.data(),
        } as Group;
        setGroup(groupData);

        // 모임장 정보 로드
        if (groupData.creatorId) {
          const creatorDoc = await getDoc(doc(db, "users", groupData.creatorId));
          if (creatorDoc.exists()) {
            setCreator(creatorDoc.data() as UserData);
          }
        }

        // 모임장인 경우 대기중인 신청서 수 로드
        if (user && groupData.creatorId === user.uid) {
          const applicationsRef = collection(db, "applications");
          const q = query(
            applicationsRef,
            where("groupId", "==", groupId),
            where("status", "==", "pending")
          );
          const applicationsSnapshot = await getDocs(q);
          setPendingCount(applicationsSnapshot.size);
        }

        // 사용자가 해당 모임에 대해 대기중인 신청서가 있는지 확인
        if (
          user &&
          !groupData.members.includes(user.uid) &&
          groupData.creatorId !== user.uid
        ) {
          const applicationsRef = collection(db, "applications");
          const q = query(
            applicationsRef,
            where("groupId", "==", groupId),
            where("userId", "==", user.uid),
            where("status", "==", "pending")
          );
          const applicationsSnapshot = await getDocs(q);
          setHasPendingApplication(!applicationsSnapshot.empty);
        } else {
          setHasPendingApplication(false);
        }
      }
    } catch (error) {
      console.error("Error loading group data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatSchedule = () => {
    if (!group?.schedule || !group.hasSchedule) return "일정 없음";

    const { daysOfWeek, startTime, endTime } = group.schedule;
    if (!daysOfWeek || daysOfWeek.length === 0) return "일정 없음";

    const days = daysOfWeek.map((day) => dayLabels[day]).join(", ");
    return `매주 ${days} ${startTime || ""} ~ ${endTime || ""}`;
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

  if (!group) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>모임 상세</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>모임을 찾을 수 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  const groupColor = group.color || "#4A90E2";
  const isCreator = user && group && group.creatorId === user.uid;
  const isMember = user && group && group.members.includes(user.uid);
  const showTimeCalculator = (isMember || isCreator) && group && group.memberCount <= 8;

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

  const handleJoinGroup = async () => {
    if (!user) {
      return;
    }

    // 모임에 일정이 있는 경우 주간 고정 일정과 겹치는지 확인
    if (group.hasSchedule && group.schedule) {
      const { daysOfWeek, startTime, endTime } = group.schedule;
      if (daysOfWeek && daysOfWeek.length > 0 && startTime && endTime) {
        const conflictCheck = await checkWeeklyEventConflict(
          daysOfWeek,
          startTime,
          endTime
        );

        if (conflictCheck.hasConflict) {
          Alert.alert(
            "일정 충돌",
            `기존 주간 고정 일정 "${conflictCheck.conflictEvent}"과 시간이 겹칩니다.\n모임에 가입할 수 없습니다.`
          );
          return;
        }
      }
    }

    if (
      group.requiresApplication &&
      group.applicationQuestions &&
      group.applicationQuestions.length > 0
    ) {
      // 신청서 작성 페이지로 이동
      router.push(`/application?groupId=${groupId}` as any);
    } else {
      // 바로 가입 처리
      joinGroupDirectly();
    }
  };

  const joinGroupDirectly = async () => {
    if (!user || !groupId) return;

    try {
      // 모임에 멤버 추가
      await updateDoc(doc(db, "groups", groupId), {
        members: arrayUnion(user.uid),
        memberCount: increment(1),
      });

      // 사용자의 joinedGroups에 추가
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      const joinedGroups = userData?.joinedGroups || [];
      if (!joinedGroups.includes(groupId)) {
        await updateDoc(doc(db, "users", user.uid), {
          joinedGroups: arrayUnion(groupId),
        });
      }

      // Realtime Database에 그룹 멤버 정보 추가 (채팅방 접근 권한용)
      const memberRef = ref(realtimeDb, `groupMembers/${groupId}/${user.uid}`);
      await set(memberRef, true);

      Alert.alert("성공", "모임에 가입되었습니다.");
      // 모임 데이터 다시 로드
      loadGroupData();
    } catch (error: any) {
      console.error("Error joining group:", error);
      Alert.alert("오류", error?.message || "모임 가입에 실패했습니다.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>모임 상세</Text>
        {isCreator ? (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push(`/edit-group?groupId=${groupId}` as any)}
          >
            <Ionicons name="settings-outline" size={24} color="#333" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 상단 헤더 (모임 색상 배경) */}
        <View style={[styles.topHeader, { backgroundColor: groupColor }]}>
          <Text style={styles.groupName}>{group.name}</Text>
          <View style={styles.topHeaderInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="person" size={16} color="#fff" />
              <Text style={styles.infoText}>
                모임장: {creator?.userId || "알 수 없음"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="people" size={16} color="#fff" />
              <Text style={styles.infoText}>{group.memberCount}명</Text>
            </View>
            {group.type && (
              <View style={styles.infoRow}>
                <Ionicons
                  name={group.type === "study" ? "school" : "heart"}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.infoText}>
                  {group.type === "study" ? "스터디" : "취미 모임"}
                </Text>
              </View>
            )}
            {group.requiresApplication && (
              <View style={styles.infoRow}>
                <Ionicons name="document-text" size={16} color="#fff" />
                <Text style={styles.infoText}>신청서 필요</Text>
              </View>
            )}
          </View>
        </View>

        {/* 모임 소개 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>모임 소개</Text>
          <Text style={styles.sectionContent}>
            {group.description || "소개가 없습니다."}
          </Text>
        </View>

        {/* 모임 일정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>모임 일정</Text>
          <View style={styles.scheduleContainer}>
            <Ionicons name="calendar-outline" size={20} color="#4A90E2" />
            <Text style={styles.sectionContent}>{formatSchedule()}</Text>
          </View>
        </View>

        {/* 모임 장소 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>모임 장소</Text>
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={20} color="#4A90E2" />
            <Text style={styles.sectionContent}>{group.location || "장소 미정"}</Text>
          </View>
        </View>

        {/* 모임 참여 방식 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>참여 방식</Text>
          <View style={styles.participationContainer}>
            {group.requiresApplication ? (
              <>
                <Ionicons name="document-text-outline" size={20} color="#FF6B6B" />
                <View style={styles.participationInfo}>
                  <Text style={styles.participationTitle}>신청서 작성 필요</Text>
                  <Text style={styles.participationDescription}>
                    모임 참여를 위해 신청서를 작성해야 합니다.
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="person-add-outline" size={20} color="#4A90E2" />
                <View style={styles.participationInfo}>
                  <Text style={styles.participationTitle}>자유 가입</Text>
                  <Text style={styles.participationDescription}>
                    누구나 바로 참여할 수 있습니다.
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* 참여 인원 버튼 (모임 멤버만 표시) */}
        {(isMember || isCreator) && (
          <View style={styles.buttonSection}>
            <TouchableOpacity
              style={styles.memberButton}
              onPress={() => router.push(`/group-members?groupId=${groupId}` as any)}
            >
              <Ionicons name="people-outline" size={20} color="#4A90E2" />
              <Text style={styles.memberButtonText}>참여 인원</Text>
              <View style={styles.memberCountBadge}>
                <Text style={styles.memberCountText}>{group.memberCount}</Text>
              </View>
              {isCreator && pendingCount > 0 && (
                <View style={styles.pendingCountBadge}>
                  <Text style={styles.pendingCountText}>대기 {pendingCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            {/* 시간 계산기 버튼 (모임 멤버이고 인원 8명 이하일 때만 표시) */}
            {showTimeCalculator && (
              <TouchableOpacity
                style={styles.timeCalculatorButton}
                onPress={() =>
                  router.push(`/group-time-calculator?groupId=${groupId}` as any)
                }
              >
                <Ionicons name="time-outline" size={20} color="#4A90E2" />
                <Text style={styles.timeCalculatorButtonText}>시간 계산기</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            )}

            {/* 게시판 버튼 */}
            <TouchableOpacity
              style={styles.boardButton}
              onPress={() => router.push(`/group-board?groupId=${groupId}` as any)}
            >
              <Ionicons name="document-text-outline" size={20} color="#4A90E2" />
              <Text style={styles.boardButtonText}>게시판</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            {/* 채팅방 버튼 */}
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => router.push(`/group-chat?groupId=${groupId}` as any)}
            >
              <Ionicons name="chatbubbles-outline" size={20} color="#4A90E2" />
              <Text style={styles.chatButtonText}>채팅방</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        )}

        {/* 모임 참여하기 버튼 또는 대기중 표시 */}
        {user && !isMember && !isCreator && (
          <View style={styles.joinButtonContainer}>
            {hasPendingApplication ? (
              <View style={styles.pendingStatusContainer}>
                <Ionicons name="time-outline" size={20} color="#4A90E2" />
                <Text style={styles.pendingStatusText}>
                  신청서 제출 완료, 승인 대기중입니다
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.joinButton, { backgroundColor: groupColor }]}
                onPress={handleJoinGroup}
              >
                <Ionicons name="person-add" size={20} color="#fff" />
                <Text style={styles.joinButtonText}>모임 참여하기</Text>
              </TouchableOpacity>
            )}
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
  settingsButton: {
    padding: 4,
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
  topHeader: {
    padding: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },
  groupName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  topHeaderInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
  },
  scheduleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  buttonSection: {
    padding: 20,
    gap: 12,
  },
  memberButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 12,
  },
  memberButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  memberCountBadge: {
    backgroundColor: "#E6F4FE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4A90E2",
  },
  pendingCountBadge: {
    backgroundColor: "#FFE6E6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingCountText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FF4444",
  },
  boardButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 12,
  },
  boardButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 12,
  },
  chatButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  timeCalculatorButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 12,
  },
  timeCalculatorButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  joinButtonContainer: {
    padding: 20,
    paddingBottom: 32,
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  joinButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  participationContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  participationInfo: {
    flex: 1,
  },
  participationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  participationDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  pendingStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#E6F4FE",
    borderRadius: 12,
    gap: 8,
  },
  pendingStatusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4A90E2",
  },
});
