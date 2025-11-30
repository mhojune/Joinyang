import Header from "@/components/Header";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Group = {
  id: string;
  name: string;
  description: string;
  type?: "study" | "hobby";
  color?: string;
  creatorId: string;
  memberCount: number;
  requiresApplication?: boolean;
  location?: string;
  schedule?: {
    daysOfWeek?: number[];
    startTime?: string;
    endTime?: string;
  } | null;
};

type CalendarEvent = {
  id?: string;
  groupId?: string;
  groupName: string;
  dayOfWeek: number;
  daysOfWeek?: number[];
  startDate?: Date;
  endDate?: Date;
  startTime: string;
  endTime: string;
  color: string;
  isPersonal?: boolean;
  isWeekly?: boolean;
};

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [myGroups, setMyGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [todayEvents, setTodayEvents] = React.useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = React.useState(true);

  React.useEffect(() => {
    if (user) {
      loadMyGroups();
      loadTodayEvents();
    }
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadMyGroups();
        loadTodayEvents();
      }
    }, [user])
  );

  const loadMyGroups = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // 사용자 정보에서 joinedGroups 가져오기
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      const joinedGroupIds = userData?.joinedGroups || [];

      // 내 모임 리스트 로드
      if (joinedGroupIds.length > 0) {
        const myGroupsData: Group[] = [];
        for (const groupId of joinedGroupIds) {
          try {
            const groupDoc = await getDoc(doc(db, "groups", groupId));
            if (groupDoc.exists()) {
              myGroupsData.push({
                id: groupDoc.id,
                ...groupDoc.data(),
              } as Group);
            }
          } catch (error) {
            console.error(`Error loading group ${groupId}:`, error);
          }
        }
        setMyGroups(myGroupsData);
      } else {
        setMyGroups([]);
      }
    } catch (error) {
      console.error("Error loading my groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTodayEvents = async () => {
    if (!user) return;

    setLoadingEvents(true);
    try {
      const eventsData: CalendarEvent[] = [];
      const today = new Date();
      const todayDayOfWeek = today.getDay();
      const todayDateStr = `${today.getFullYear()}-${
        today.getMonth() + 1
      }-${today.getDate()}`;

      // 사용자가 참여한 모임들 가져오기
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      const joinedGroupIds = userData?.joinedGroups || [];

      // 모임 일정 가져오기
      for (const groupId of joinedGroupIds) {
        try {
          const groupDoc = await getDoc(doc(db, "groups", groupId));
          if (groupDoc.exists()) {
            const groupData = groupDoc.data() as Group;
            if (
              groupData.schedule?.daysOfWeek &&
              groupData.schedule.daysOfWeek.includes(todayDayOfWeek)
            ) {
              eventsData.push({
                groupId: groupDoc.id,
                groupName: groupData.name,
                dayOfWeek: todayDayOfWeek,
                startTime: groupData.schedule?.startTime || "",
                endTime: groupData.schedule?.endTime || "",
                color: groupData.color || "#4A90E2",
                isPersonal: false,
              });
            }
          }
        } catch (error) {
          // 에러 무시
        }
      }

      // 개인 일정 가져오기
      try {
        const personalEventsQuery = query(
          collection(db, "personalEvents"),
          where("userId", "==", user.uid)
        );
        const personalEventsSnapshot = await getDocs(personalEventsQuery);
        personalEventsSnapshot.forEach((doc) => {
          const data = doc.data();
          const startDateObj = data.startDate?.toDate() || new Date();
          const endDateObj = data.endDate?.toDate() || new Date();
          const startStr = `${startDateObj.getFullYear()}-${
            startDateObj.getMonth() + 1
          }-${startDateObj.getDate()}`;
          const endStr = `${endDateObj.getFullYear()}-${
            endDateObj.getMonth() + 1
          }-${endDateObj.getDate()}`;

          if (todayDateStr >= startStr && todayDateStr <= endStr) {
            eventsData.push({
              id: doc.id,
              groupName: data.title,
              dayOfWeek: startDateObj.getDay(),
              startDate: startDateObj,
              endDate: endDateObj,
              startTime: data.startTime || "",
              endTime: data.endTime || "",
              color: data.color || "#4A90E2",
              isPersonal: true,
            });
          }
        });
      } catch (error) {
        // 에러 무시
      }

      // 주간 고정 일정 가져오기
      try {
        const weeklyEventsQuery = query(
          collection(db, "weeklyEvents"),
          where("userId", "==", user.uid)
        );
        const weeklyEventsSnapshot = await getDocs(weeklyEventsQuery);
        weeklyEventsSnapshot.forEach((doc) => {
          const data = doc.data();
          const daysOfWeek = data.daysOfWeek || [];
          if (daysOfWeek.includes(todayDayOfWeek)) {
            eventsData.push({
              id: doc.id,
              groupName: data.title,
              dayOfWeek: todayDayOfWeek,
              daysOfWeek,
              startTime: data.startTime || "",
              endTime: data.endTime || "",
              color: data.color || "#4A90E2",
              isWeekly: true,
              isPersonal: false,
            });
          }
        });
      } catch (error) {
        // 에러 무시
      }

      // 시간 순서로 정렬
      const timeToMinutes = (timeStr: string): number => {
        if (!timeStr || timeStr.trim() === "") {
          return 24 * 60;
        }
        const [hours, minutes] = timeStr.split(":").map(Number);
        if (isNaN(hours) || isNaN(minutes)) {
          return 24 * 60;
        }
        return hours * 60 + minutes;
      };

      eventsData.sort((a, b) => {
        const aMinutes = timeToMinutes(a.startTime);
        const bMinutes = timeToMinutes(b.startTime);
        return aMinutes - bMinutes;
      });

      setTodayEvents(eventsData);
    } catch (error) {
      // 에러 무시
    } finally {
      setLoadingEvents(false);
    }
  };

  const formatTodayDate = () => {
    const today = new Date();
    return `${today.getMonth() + 1}월 ${today.getDate()}일`;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header />

      {/* 메인 컨텐츠 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 오늘 일정 섹션 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>오늘 일정</Text>
            <Text style={styles.todayDate}>{formatTodayDate()}</Text>
          </View>
          {loadingEvents ? (
            <View style={styles.scheduleCard}>
              <ActivityIndicator size="small" color="#4A90E2" />
            </View>
          ) : todayEvents.length === 0 ? (
            <View style={styles.scheduleCard}>
              <Text style={styles.emptyText}>오늘 예정된 일정이 없습니다</Text>
            </View>
          ) : (
            <View style={styles.eventsContainer}>
              {todayEvents.map((event, index) => (
                <View
                  key={index}
                  style={[
                    styles.eventCard,
                    index === todayEvents.length - 1 && styles.eventCardLast,
                  ]}
                >
                  <Text style={styles.eventTime}>
                    {event.startTime} - {event.endTime}
                  </Text>
                  <Text style={styles.eventTitle}>{event.groupName}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 내 모임 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>내 모임</Text>
          {loading ? (
            <View style={styles.groupCard}>
              <ActivityIndicator size="small" color="#4A90E2" />
            </View>
          ) : myGroups.length === 0 ? (
            <View style={styles.groupCard}>
              <Ionicons name="people-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>참가한 모임이 없습니다</Text>
              <TouchableOpacity
                style={styles.goToGroupsButton}
                onPress={() => router.push("/(tabs)/groups" as any)}
              >
                <Text style={styles.goToGroupsButtonText}>모임 둘러보기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {myGroups.map((group) => {
                const groupColor = group.color || "#4A90E2";
                const isCreator = user && group.creatorId === user.uid;
                return (
                  <TouchableOpacity
                    key={group.id}
                    style={styles.groupCard}
                    onPress={() =>
                      router.push(`/group-detail?groupId=${group.id}` as any)
                    }
                  >
                    <View
                      style={[styles.groupColorBar, { backgroundColor: groupColor }]}
                    />
                    <View style={styles.groupCardContent}>
                      <View style={styles.groupCardHeader}>
                        <View style={styles.groupNameContainer}>
                          <Text style={styles.groupName}>{group.name}</Text>
                          {isCreator && (
                            <View style={styles.creatorBadge}>
                              <Ionicons name="star" size={12} color="#FFA500" />
                              <Text style={styles.creatorBadgeText}>내가 만든 모임</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.memberCountBadge}>
                          <Ionicons name="people" size={14} color="#4A90E2" />
                          <Text style={styles.memberCountText}>{group.memberCount}</Text>
                        </View>
                      </View>
                      {group.description && (
                        <Text style={styles.groupDescription} numberOfLines={2}>
                          {group.description}
                        </Text>
                      )}
                      {(group.type || group.requiresApplication || group.location) && (
                        <View style={styles.groupMeta}>
                          {group.type && (
                            <View style={styles.groupTypeBadge}>
                              <Ionicons
                                name={group.type === "study" ? "school" : "heart"}
                                size={12}
                                color="#666"
                              />
                              <Text style={styles.groupTypeText}>
                                {group.type === "study" ? "스터디" : "취미 모임"}
                              </Text>
                            </View>
                          )}
                          {group.requiresApplication && (
                            <View style={styles.applicationBadge}>
                              <Ionicons name="document-text" size={12} color="#FF6B6B" />
                              <Text style={styles.applicationBadgeText}>신청서 필요</Text>
                            </View>
                          )}
                          {group.location && (
                            <View style={styles.groupLocation}>
                              <Ionicons name="location" size={12} color="#666" />
                              <Text style={styles.groupLocationText}>
                                {group.location}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
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
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  todayDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4A90E2",
  },
  scheduleCard: {
    backgroundColor: "#E6F4FE",
    borderRadius: 12,
    padding: 20,
    minHeight: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  eventsContainer: {
    gap: 8,
    backgroundColor: "#E6F4FE",
    borderRadius: 12,
    padding: 16,
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#D0E8F8",
    gap: 12,
  },
  eventCardLast: {
    borderBottomWidth: 0,
  },
  eventTime: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  eventTitle: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  groupCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    flexDirection: "row",
  },
  groupColorBar: {
    width: 4,
  },
  groupCardContent: {
    flex: 1,
    padding: 16,
  },
  groupCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  groupNameContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  groupName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  creatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF4E6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  creatorBadgeText: {
    fontSize: 10,
    color: "#FFA500",
    fontWeight: "600",
  },
  memberCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E6F4FE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  memberCountText: {
    fontSize: 12,
    color: "#4A90E2",
    fontWeight: "600",
  },
  groupDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 8,
  },
  groupMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  groupTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0E0E0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  groupTypeText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
  },
  groupLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  groupLocationText: {
    fontSize: 11,
    color: "#666",
  },
  applicationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFE6E6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  applicationBadgeText: {
    fontSize: 11,
    color: "#FF6B6B",
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    marginTop: 12,
  },
  goToGroupsButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#4A90E2",
    borderRadius: 8,
  },
  goToGroupsButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
