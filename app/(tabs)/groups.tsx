import Header from "@/components/Header";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
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
import { SafeAreaView } from "react-native-safe-area-context";

type Group = {
  id: string;
  name: string;
  description: string;
  type?: "study" | "hobby";
  schedule?: string | null;
  location?: string;
  color?: string;
  creatorId: string;
  members: string[];
  memberCount: number;
  createdAt: any;
};

export default function GroupsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [myGroups, setMyGroups] = React.useState<Group[]>([]);
  const [popularGroups, setPopularGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (user) {
      loadGroups();
    }
  }, [user]);

  const loadGroups = async () => {
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
          const groupDoc = await getDoc(doc(db, "groups", groupId));
          if (groupDoc.exists()) {
            myGroupsData.push({
              id: groupDoc.id,
              ...groupDoc.data(),
            } as Group);
          }
        }
        setMyGroups(myGroupsData);
      } else {
        setMyGroups([]);
      }

      // 인기 모임 리스트 로드 (멤버 수 기준 정렬)
      const groupsRef = collection(db, "groups");
      const popularQuery = query(groupsRef, orderBy("memberCount", "desc"));
      const popularSnapshot = await getDocs(popularQuery);
      const popularData: Group[] = [];
      popularSnapshot.forEach((doc) => {
        popularData.push({
          id: doc.id,
          ...doc.data(),
        } as Group);
      });
      setPopularGroups(popularData.slice(0, 10)); // 상위 10개만
    } catch (error) {
      console.error("Error loading groups:", error);
      Alert.alert("오류", "모임 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 화면 포커스 시 목록 새로고침
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadGroups();
      }
    }, [user])
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 모임 생성 버튼 */}
          <View style={styles.createButtonContainer}>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push("/create-group" as any)}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.createButtonText}>모임 만들기</Text>
            </TouchableOpacity>
          </View>

          {/* 내 모임 리스트 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>내 모임</Text>
            {myGroups.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={48} color="#CCC" />
                <Text style={styles.emptyText}>참가한 모임이 없습니다</Text>
              </View>
            ) : (
              myGroups.map((group) => (
                <GroupCard key={group.id} group={group} userId={user?.uid} />
              ))
            )}
          </View>

          {/* 인기 모임 리스트 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>인기 모임</Text>
            {popularGroups.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="flame-outline" size={48} color="#CCC" />
                <Text style={styles.emptyText}>인기 모임이 없습니다</Text>
              </View>
            ) : (
              popularGroups.map((group) => (
                <GroupCard key={group.id} group={group} userId={user?.uid} />
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function GroupCard({ group, userId }: { group: Group; userId?: string }) {
  const router = useRouter();
  const isCreator = userId === group.creatorId;
  const groupColor = group.color || "#4A90E2";

  return (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => router.push(`/group-detail?groupId=${group.id}` as any)}
    >
      <View style={[styles.groupColorBar, { backgroundColor: groupColor }]} />
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
        {group.type && (
          <View style={styles.groupMeta}>
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
            {group.location && (
              <View style={styles.groupLocation}>
                <Ionicons name="location" size={12} color="#666" />
                <Text style={styles.groupLocationText}>{group.location}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  createButtonContainer: {
    padding: 16,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4A90E2",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: "#E6F4FE",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    marginTop: 12,
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
});
