import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
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
  creatorId: string;
  members: string[];
  memberCount: number;
  hasSchedule?: boolean;
  schedule?: {
    daysOfWeek?: number[];
    startTime?: string;
    endTime?: string;
  } | null;
};

const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

// 시간 계산기 뷰 컴포넌트
function TimeCalculatorView({
  memberSchedules,
  totalMembers,
  onTimeBlockPress,
}: {
  memberSchedules: Array<{
    userId: string;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
  }>;
  totalMembers: number;
  onTimeBlockPress: (dayOfWeek: number, startMinutes: number, endMinutes: number) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i); // 0시부터 23시까지

  // 시간 문자열을 분 단위로 변환
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

  // 분을 픽셀 위치로 변환 (1시간 = 30px)
  const minutesToTop = (minutes: number): number => {
    return (minutes / 60) * 30;
  };

  // 분을 높이로 변환
  const minutesToHeight = (startMinutes: number, endMinutes: number): number => {
    return ((endMinutes - startMinutes) / 60) * 30;
  };

  // 각 시간대별로 겹치는 인원수 계산 (중복 제거)
  const getOverlapCount = (
    dayOfWeek: number,
    startMinutes: number,
    endMinutes: number
  ) => {
    const userIds = new Set<string>();
    for (const schedule of memberSchedules) {
      if (schedule.daysOfWeek.includes(dayOfWeek)) {
        const scheduleStart = timeToMinutes(schedule.startTime);
        const scheduleEnd = timeToMinutes(schedule.endTime);
        // 시간이 겹치는지 확인: startMinutes < scheduleEnd && endMinutes > scheduleStart
        if (startMinutes < scheduleEnd && endMinutes > scheduleStart) {
          userIds.add(schedule.userId); // Set을 사용하여 중복 제거
        }
      }
    }
    return userIds.size; // 고유한 사용자 수 반환
  };

  // 해당 시간에 일정이 있는 사용자 ID 목록 가져오기
  const getOverlappingUserIds = (
    dayOfWeek: number,
    startMinutes: number,
    endMinutes: number
  ): string[] => {
    const userIds = new Set<string>();
    for (const schedule of memberSchedules) {
      if (schedule.daysOfWeek.includes(dayOfWeek)) {
        const scheduleStart = timeToMinutes(schedule.startTime);
        const scheduleEnd = timeToMinutes(schedule.endTime);
        // 시간이 겹치는지 확인: startMinutes < scheduleEnd && endMinutes > scheduleStart
        if (startMinutes < scheduleEnd && endMinutes > scheduleStart) {
          userIds.add(schedule.userId);
        }
      }
    }
    return Array.from(userIds);
  };

  // 모든 시간 블록에서 최대 겹치는 인원수 계산
  const getMaxOverlapCount = (): number => {
    let maxCount = 0;
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const startMinutes = hour * 60 + minute;
          const endMinutes = startMinutes + 30;
          const count = getOverlapCount(dayOfWeek, startMinutes, endMinutes);
          if (count > maxCount) {
            maxCount = count;
          }
        }
      }
    }
    return maxCount;
  };

  // RGB 값을 16진수로 변환
  const rgbToHex = (r: number, g: number, b: number): string => {
    return `#${[r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")}`;
  };

  // 두 색상 사이의 보간
  const interpolateColor = (
    color1: [number, number, number],
    color2: [number, number, number],
    factor: number
  ): string => {
    const r = Math.round(color1[0] + (color2[0] - color1[0]) * factor);
    const g = Math.round(color1[1] + (color2[1] - color1[1]) * factor);
    const b = Math.round(color1[2] + (color2[2] - color1[2]) * factor);
    return rgbToHex(r, g, b);
  };

  // 최대 인원수에 따라 색상 생성
  const generateColorScale = (maxCount: number): Map<number, string> => {
    const colorMap = new Map<number, string>();

    if (maxCount === 0) {
      return colorMap;
    }

    // 시작 색상 (연한 파란색) - RGB: 227, 242, 253
    const startColor: [number, number, number] = [227, 242, 253];
    // 끝 색상 (진한 파란색) - RGB: 25, 118, 210
    const endColor: [number, number, number] = [25, 118, 210];

    for (let count = 1; count <= maxCount; count++) {
      // 0 (연한색) ~ 1 (진한색) 사이의 비율 계산
      const factor = maxCount === 1 ? 1 : (count - 1) / (maxCount - 1);
      const color = interpolateColor(startColor, endColor, factor);
      colorMap.set(count, color);
    }

    return colorMap;
  };

  // 최대 겹치는 인원수 계산
  const maxOverlapCount = React.useMemo(() => getMaxOverlapCount(), [memberSchedules]);

  // 색상 스케일 생성
  const colorScale = React.useMemo(
    () => generateColorScale(maxOverlapCount),
    [maxOverlapCount]
  );

  // 겹치는 인원수에 따라 색상 반환 (동적으로 계산된 색상 사용)
  const getColorByCount = (count: number): string => {
    if (count === 0) return "#F0F0F0"; // 아무도 없음
    if (maxOverlapCount === 0) return "#E3F2FD"; // 기본 색상

    // 계산된 색상 스케일에서 색상 가져오기
    return colorScale.get(count) || colorScale.get(maxOverlapCount) || "#E3F2FD";
  };

  // 30분 단위로 겹치는 인원수 계산하여 블록 생성
  const generateTimeBlocks = (dayOfWeek: number) => {
    const blocks: Array<{
      startMinutes: number;
      endMinutes: number;
      count: number;
    }> = [];

    // 30분 단위로 시간대를 나누어 계산
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const startMinutes = hour * 60 + minute;
        const endMinutes = startMinutes + 30;
        const count = getOverlapCount(dayOfWeek, startMinutes, endMinutes);
        blocks.push({ startMinutes, endMinutes, count });
      }
    }

    // 연속된 같은 count 값을 가진 블록들을 합치기
    const mergedBlocks: Array<{
      startMinutes: number;
      endMinutes: number;
      count: number;
    }> = [];

    for (let i = 0; i < blocks.length; i++) {
      if (i === 0 || blocks[i].count !== blocks[i - 1].count) {
        mergedBlocks.push({
          startMinutes: blocks[i].startMinutes,
          endMinutes: blocks[i].endMinutes,
          count: blocks[i].count,
        });
      } else {
        mergedBlocks[mergedBlocks.length - 1].endMinutes = blocks[i].endMinutes;
      }
    }

    return mergedBlocks.filter((block) => block.count > 0);
  };

  const screenWidth = Dimensions.get("window").width;
  const timeColumnWidth = 40;
  const paddingHorizontal = 40; // 좌우 패딩 (20 * 2)
  const availableWidth = screenWidth - paddingHorizontal - timeColumnWidth;
  const dayColumnWidth = availableWidth / 7;

  return (
    <View style={styles.timeCalculatorContainer}>
      <View style={styles.timeCalculatorTimeline}>
        {/* 시간대 표시 */}
        <View style={styles.timeCalculatorTimeColumn}>
          <View style={styles.timeCalculatorTimeColumnHeader} />
          {hours.map((hour) => (
            <View key={hour} style={styles.timeCalculatorTimeSlot}>
              <Text style={styles.timeCalculatorTimeText}>{hour}</Text>
            </View>
          ))}
        </View>

        {/* 요일별 컬럼 */}
        {dayLabels.map((dayName, dayIndex) => {
          const dayOfWeek = dayIndex;
          const timeBlocks = generateTimeBlocks(dayOfWeek);

          return (
            <View
              key={dayIndex}
              style={[
                styles.timeCalculatorDayColumn,
                { width: dayColumnWidth },
                (dayOfWeek === 0 || dayOfWeek === 6) &&
                  styles.timeCalculatorDayColumnWeekend,
              ]}
            >
              <View style={styles.timeCalculatorDayHeader}>
                <Text
                  style={[
                    styles.timeCalculatorDayName,
                    (dayOfWeek === 0 || dayOfWeek === 6) &&
                      styles.timeCalculatorDayNameWeekend,
                  ]}
                >
                  {dayName}
                </Text>
              </View>
              <View style={styles.timeCalculatorDayTimeline}>
                {/* 시간대 구분선 */}
                {hours.map((hour) => (
                  <View key={hour} style={styles.timeCalculatorTimeLine} />
                ))}

                {/* 시간 블록 */}
                {timeBlocks.map((block, blockIndex) => {
                  const top = minutesToTop(block.startMinutes);
                  const height = Math.max(
                    minutesToHeight(block.startMinutes, block.endMinutes),
                    2
                  );
                  const color = getColorByCount(block.count);

                  return (
                    <TouchableOpacity
                      key={blockIndex}
                      style={[
                        styles.timeCalculatorBlock,
                        {
                          backgroundColor: color,
                          top: top,
                          height: height,
                        },
                      ]}
                      onPress={() => {
                        const userIds = getOverlappingUserIds(
                          dayOfWeek,
                          block.startMinutes,
                          block.endMinutes
                        );
                        onTimeBlockPress(dayOfWeek, block.startMinutes, block.endMinutes);
                      }}
                      activeOpacity={0.7}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      {/* 범례 */}
      <View style={styles.timeCalculatorLegend}>
        <Text style={styles.timeCalculatorLegendTitle}>겹치는 인원수</Text>
        <View style={styles.timeCalculatorLegendItems}>
          {maxOverlapCount > 0 ? (
            Array.from({ length: maxOverlapCount }, (_, i) => i + 1).map((count) => (
              <View key={count} style={styles.timeCalculatorLegendItem}>
                <View
                  style={[
                    styles.timeCalculatorLegendColor,
                    { backgroundColor: getColorByCount(count) },
                  ]}
                />
                <Text style={styles.timeCalculatorLegendText}>{count}명</Text>
              </View>
            ))
          ) : (
            <Text style={styles.timeCalculatorLegendText}>표시할 데이터가 없습니다</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function GroupTimeCalculatorScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [group, setGroup] = React.useState<Group | null>(null);
  const [memberSchedules, setMemberSchedules] = React.useState<
    Array<{
      userId: string;
      daysOfWeek: number[];
      startTime: string;
      endTime: string;
    }>
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingSchedules, setLoadingSchedules] = React.useState(false);
  const [selectedTimeBlock, setSelectedTimeBlock] = React.useState<{
    dayOfWeek: number;
    startMinutes: number;
    endMinutes: number;
  } | null>(null);
  const [overlappingUsers, setOverlappingUsers] = React.useState<string[]>([]);
  const [userNames, setUserNames] = React.useState<Map<string, string>>(new Map());

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

        // 모임 멤버 확인
        const isMember =
          user &&
          (groupData.members.includes(user.uid) || groupData.creatorId === user.uid);
        if (!isMember) {
          Alert.alert("권한 없음", "모임 멤버만 시간 계산기를 사용할 수 있습니다.", [
            {
              text: "확인",
              onPress: () => router.back(),
            },
          ]);
          return;
        }

        // 인원수 확인
        if (groupData.memberCount > 8) {
          Alert.alert(
            "사용 불가",
            "시간 계산기는 모임 인원이 8명 이하일 때만 사용할 수 있습니다.",
            [
              {
                text: "확인",
                onPress: () => router.back(),
              },
            ]
          );
          return;
        }

        // 시간표 데이터 로드
        await loadMemberSchedules(groupData);
        // 사용자 이름 맵 로드
        await loadUserNames(groupData);
      } else {
        Alert.alert("오류", "모임을 찾을 수 없습니다.", [
          {
            text: "확인",
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error) {
      console.error("Error loading group data:", error);
      Alert.alert("오류", "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 모임원들의 고정 시간 정보 가져오기
  const loadMemberSchedules = async (groupData: Group) => {
    if (!groupData || groupData.memberCount > 8) return;

    setLoadingSchedules(true);
    try {
      const schedules: Array<{
        userId: string;
        daysOfWeek: number[];
        startTime: string;
        endTime: string;
      }> = [];

      // 모임장과 모든 모임원들의 ID 수집 (중복 제거)
      const allMemberIds = new Set<string>();
      if (groupData.creatorId) {
        allMemberIds.add(groupData.creatorId);
      }
      groupData.members.forEach((memberId) => {
        allMemberIds.add(memberId);
      });

      // 모임 고정 시간 추가 (캘린더 주간 뷰 방식과 동일하게 각 요일별로 처리)
      if (
        groupData.hasSchedule &&
        groupData.schedule &&
        groupData.schedule.daysOfWeek &&
        groupData.schedule.daysOfWeek.length > 0 &&
        groupData.schedule.startTime &&
        groupData.schedule.endTime
      ) {
        // 각 요일에 대해 모든 멤버에게 모임 시간 추가
        groupData.schedule.daysOfWeek.forEach((dayOfWeek) => {
          allMemberIds.forEach((memberId) => {
            schedules.push({
              userId: memberId,
              daysOfWeek: [dayOfWeek], // 각 요일을 개별적으로 처리
              startTime: groupData.schedule!.startTime!,
              endTime: groupData.schedule!.endTime!,
            });
          });
        });
      }

      // 모든 멤버(모임장 포함)의 weeklyEvents 가져오기
      for (const memberId of allMemberIds) {
        try {
          // 개인 고정 시간 (weeklyEvents)
          const weeklyEventsQuery = query(
            collection(db, "weeklyEvents"),
            where("userId", "==", memberId)
          );
          const weeklyEventsSnapshot = await getDocs(weeklyEventsQuery);
          weeklyEventsSnapshot.forEach((doc) => {
            const data = doc.data();
            const weeklyDaysOfWeek = data.daysOfWeek || [];
            // 각 요일별로 개별 스케줄로 추가 (캘린더 방식과 동일)
            weeklyDaysOfWeek.forEach((dayOfWeek: number) => {
              schedules.push({
                userId: memberId,
                daysOfWeek: [dayOfWeek], // 각 요일을 개별적으로 처리
                startTime: data.startTime || "",
                endTime: data.endTime || "",
              });
            });
          });

          // 해당 멤버가 참여한 모든 모임의 고정 시간 가져오기
          const userDoc = await getDoc(doc(db, "users", memberId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const joinedGroupIds = userData?.joinedGroups || [];

            // 각 모임의 고정 시간 가져오기
            for (const joinedGroupId of joinedGroupIds) {
              try {
                const joinedGroupDoc = await getDoc(doc(db, "groups", joinedGroupId));
                if (joinedGroupDoc.exists()) {
                  const joinedGroupData = joinedGroupDoc.data();
                  if (
                    joinedGroupData.schedule?.daysOfWeek &&
                    joinedGroupData.schedule.daysOfWeek.length > 0 &&
                    joinedGroupData.schedule.startTime &&
                    joinedGroupData.schedule.endTime
                  ) {
                    // 각 요일에 대해 스케줄 추가
                    joinedGroupData.schedule.daysOfWeek.forEach((dayOfWeek: number) => {
                      schedules.push({
                        userId: memberId,
                        daysOfWeek: [dayOfWeek],
                        startTime: joinedGroupData.schedule.startTime,
                        endTime: joinedGroupData.schedule.endTime,
                      });
                    });
                  }
                }
              } catch (error) {
                console.error(
                  `Error loading group ${joinedGroupId} for member ${memberId}:`,
                  error
                );
              }
            }
          }
        } catch (error) {
          console.error(`Error loading schedule for member ${memberId}:`, error);
        }
      }

      setMemberSchedules(schedules);
    } catch (error) {
      console.error("Error loading member schedules:", error);
    } finally {
      setLoadingSchedules(false);
    }
  };

  // 사용자 이름 맵 로드
  const loadUserNames = async (groupData: Group) => {
    try {
      const namesMap = new Map<string, string>();

      // 모임장과 모든 모임원들의 ID 수집
      const allMemberIds = new Set<string>();
      if (groupData.creatorId) {
        allMemberIds.add(groupData.creatorId);
      }
      groupData.members.forEach((memberId) => {
        allMemberIds.add(memberId);
      });

      // 각 사용자의 이름 가져오기
      for (const memberId of allMemberIds) {
        try {
          const userDoc = await getDoc(doc(db, "users", memberId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            namesMap.set(memberId, userData.userId || "알 수 없음");
          }
        } catch (error) {
          console.error(`Error loading user name for ${memberId}:`, error);
        }
      }

      setUserNames(namesMap);
    } catch (error) {
      console.error("Error loading user names:", error);
    }
  };

  // 시간을 문자열로 변환
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

  // 분을 시간 문자열로 변환
  const minutesToTimeString = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  };

  // 시간 블록 클릭 핸들러
  const handleTimeBlockPress = (
    dayOfWeek: number,
    startMinutes: number,
    endMinutes: number
  ) => {
    // 해당 시간에 일정이 있는 사용자 ID 수집
    const userIds = new Set<string>();
    for (const schedule of memberSchedules) {
      if (schedule.daysOfWeek.includes(dayOfWeek)) {
        const scheduleStart = timeToMinutes(schedule.startTime);
        const scheduleEnd = timeToMinutes(schedule.endTime);
        if (startMinutes < scheduleEnd && endMinutes > scheduleStart) {
          userIds.add(schedule.userId);
        }
      }
    }

    setSelectedTimeBlock({ dayOfWeek, startMinutes, endMinutes });
    setOverlappingUsers(Array.from(userIds));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>시간 계산기</Text>
          <View style={styles.headerSpacer} />
        </View>
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
          <Text style={styles.headerTitle}>시간 계산기</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>모임을 찾을 수 없습니다</Text>
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
        <Text style={styles.headerTitle}>시간 계산기</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 설명 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{group.name} 시간 계산기</Text>
          <Text style={styles.sectionContent}>
            모임원들의 고정 시간을 확인하여 공통 가능 시간을 찾아보세요.
          </Text>
        </View>

        {/* 시간표 */}
        {loadingSchedules ? (
          <View style={styles.timeCalculatorLoading}>
            <ActivityIndicator size="small" color="#4A90E2" />
            <Text style={styles.timeCalculatorLoadingText}>시간표를 불러오는 중...</Text>
          </View>
        ) : (
          <TimeCalculatorView
            memberSchedules={memberSchedules}
            totalMembers={group.memberCount}
            onTimeBlockPress={handleTimeBlockPress}
          />
        )}
      </ScrollView>

      {/* 시간 블록 상세 모달 */}
      <Modal
        visible={selectedTimeBlock !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedTimeBlock(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedTimeBlock &&
                  `${dayLabels[selectedTimeBlock.dayOfWeek]}요일 ${minutesToTimeString(
                    selectedTimeBlock.startMinutes
                  )} - ${minutesToTimeString(selectedTimeBlock.endMinutes)}`}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedTimeBlock(null)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                일정이 있는 인원 ({overlappingUsers.length}명)
              </Text>
              {overlappingUsers.length > 0 ? (
                <ScrollView style={styles.userList}>
                  {overlappingUsers.map((userId) => (
                    <View key={userId} style={styles.userItem}>
                      <Text style={styles.userName}>
                        {userNames.get(userId) || "알 수 없음"}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.noUsersText}>일정이 있는 인원이 없습니다.</Text>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
  timeCalculatorContainer: {
    marginTop: 12,
    paddingHorizontal: 20,
  },
  timeCalculatorLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  timeCalculatorLoadingText: {
    fontSize: 14,
    color: "#666",
  },
  timeCalculatorTimeline: {
    flexDirection: "row",
    position: "relative",
  },
  timeCalculatorTimeColumn: {
    width: 40,
    borderRightWidth: 1,
    borderRightColor: "#E0E0E0",
  },
  timeCalculatorTimeColumnHeader: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  timeCalculatorTimeSlot: {
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  timeCalculatorTimeText: {
    fontSize: 10,
    color: "#666",
  },
  timeCalculatorDayColumn: {
    borderRightWidth: 1,
    borderRightColor: "#E0E0E0",
  },
  timeCalculatorDayColumnWeekend: {
    backgroundColor: "#FAFAFA",
  },
  timeCalculatorDayHeader: {
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    backgroundColor: "#F9F9F9",
  },
  timeCalculatorDayName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  timeCalculatorDayNameWeekend: {
    color: "#4A90E2",
  },
  timeCalculatorDayTimeline: {
    position: "relative",
    flex: 1,
  },
  timeCalculatorTimeLine: {
    height: 30,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  timeCalculatorBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: 2,
    opacity: 0.8,
  },
  timeCalculatorLegend: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  timeCalculatorLegendTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  timeCalculatorLegendItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  timeCalculatorLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeCalculatorLegendColor: {
    width: 16,
    height: 16,
    borderRadius: 2,
  },
  timeCalculatorLegendText: {
    fontSize: 12,
    color: "#666",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "85%",
    maxHeight: "70%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  userList: {
    maxHeight: 300,
  },
  userItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 8,
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    color: "#333",
  },
  noUsersText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingVertical: 20,
  },
});
