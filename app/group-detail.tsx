import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
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
  const [group, setGroup] = React.useState<Group | null>(null);
  const [creator, setCreator] = React.useState<UserData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (groupId) {
      loadGroupData();
    }
  }, [groupId]);

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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 헤더 (뒤로가기만) */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>모임 상세</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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

        {/* 참여 인원 버튼 */}
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
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {/* 게시판 버튼 */}
          <TouchableOpacity style={styles.boardButton}>
            <Ionicons name="document-text-outline" size={20} color="#4A90E2" />
            <Text style={styles.boardButtonText}>게시판</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
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
});
