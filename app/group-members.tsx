import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  Image,
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

export default function GroupMembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [group, setGroup] = React.useState<Group | null>(null);
  const [members, setMembers] = React.useState<(UserData & { uid: string })[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (groupId) {
      loadMembers();
    }
  }, [groupId]);

  const loadMembers = async () => {
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

        // 멤버 정보 로드
        const membersData: (UserData & { uid: string })[] = [];
        for (const memberId of groupData.members) {
          try {
            const memberDoc = await getDoc(doc(db, "users", memberId));
            if (memberDoc.exists()) {
              membersData.push({
                uid: memberId,
                ...memberDoc.data(),
              } as UserData & { uid: string });
            }
          } catch (error) {
            console.error(`Error loading member ${memberId}:`, error);
          }
        }
        setMembers(membersData);
      }
    } catch (error) {
      console.error("Error loading members:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>참여 인원</Text>
          <View style={styles.headerSpacer} />
        </View>
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
        <Text style={styles.headerTitle}>참여 인원</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 인원 수 표시 */}
        <View style={styles.countSection}>
          <Text style={styles.countText}>총 {group?.memberCount || 0}명</Text>
        </View>

        {/* 멤버 리스트 */}
        {members.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>참여 인원이 없습니다</Text>
          </View>
        ) : (
          <View style={styles.membersList}>
            {members.map((member) => {
              const isCreator = member.uid === group?.creatorId;
              // avatarUrl이 없으면 userId로 생성
              const avatarUrl =
                member.avatarUrl ||
                `https://api.dicebear.com/9.x/identicon/png?seed=${encodeURIComponent(
                  member.userId || "unknown"
                )}&size=128`;
              return (
                <View key={member.uid} style={styles.memberItem}>
                  <View style={styles.memberInfo}>
                    <View style={styles.memberHeader}>
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.memberAvatar} />
                      ) : (
                        <View style={styles.memberAvatarPlaceholder}>
                          <Ionicons name="person" size={20} color="#999" />
                        </View>
                      )}
                      <View style={styles.memberTextInfo}>
                        <View style={styles.memberNameRow}>
                          <Text style={styles.memberName}>
                            {member.userId || "알 수 없음"}
                          </Text>
                          {isCreator && (
                            <View style={styles.creatorBadge}>
                              <Ionicons name="star" size={12} color="#FFA500" />
                              <Text style={styles.creatorBadgeText}>모임장</Text>
                            </View>
                          )}
                        </View>
                        {member.intro && (
                          <Text style={styles.memberIntro} numberOfLines={2}>
                            {member.intro}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
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
  content: {
    flex: 1,
  },
  countSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  countText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 64,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    marginTop: 12,
  },
  membersList: {
    padding: 16,
    gap: 12,
  },
  memberItem: {
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  memberInfo: {
    gap: 8,
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  memberAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  memberTextInfo: {
    flex: 1,
    gap: 4,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  memberName: {
    fontSize: 16,
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
  memberIntro: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
});
