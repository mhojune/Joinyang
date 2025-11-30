import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  arrayRemove,
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
  requiresApplication?: boolean;
};

type UserData = {
  userId: string;
  email: string;
  intro: string;
  avatarUrl?: string;
  createdAt: any;
  joinedGroups: string[];
};

type Application = {
  id: string;
  groupId: string;
  userId: string;
  answers: Array<{ question: string; answer: string }>;
  status: "pending" | "approved" | "rejected";
  createdAt: any;
};

export default function GroupMembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [group, setGroup] = React.useState<Group | null>(null);
  const [members, setMembers] = React.useState<(UserData & { uid: string })[]>([]);
  const [pendingApplications, setPendingApplications] = React.useState<
    (Application & { applicant: UserData })[]
  >([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (groupId) {
      loadMembers();
    }
  }, [groupId, user]);

  // 화면이 포커스될 때마다 데이터 새로고침
  useFocusEffect(
    React.useCallback(() => {
      if (groupId) {
        loadMembers();
      }
    }, [groupId, user])
  );

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

        // 모임장이고 신청서가 필요한 모임인 경우에만 대기중인 신청서 로드
        if (
          user &&
          groupData.creatorId === user.uid &&
          groupData.requiresApplication === true
        ) {
          const applicationsRef = collection(db, "applications");
          const q = query(
            applicationsRef,
            where("groupId", "==", groupId),
            where("status", "==", "pending")
          );
          const applicationsSnapshot = await getDocs(q);
          const applicationsData: (Application & { applicant: UserData })[] = [];

          for (const appDoc of applicationsSnapshot.docs) {
            const appData = {
              id: appDoc.id,
              ...appDoc.data(),
            } as Application;

            // 신청자 정보 로드
            try {
              const applicantDoc = await getDoc(doc(db, "users", appData.userId));
              if (applicantDoc.exists()) {
                applicationsData.push({
                  ...appData,
                  applicant: applicantDoc.data() as UserData,
                });
              }
            } catch (error) {
              console.error(`Error loading applicant ${appData.userId}:`, error);
            }
          }

          setPendingApplications(applicationsData);
        } else {
          // 신청서가 필요 없는 모임이거나 모임장이 아닌 경우 빈 배열로 설정
          setPendingApplications([]);
        }
      }
    } catch (error) {
      console.error("Error loading members:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = (memberId: string, memberUserId: string) => {
    if (!group || !user || group.creatorId !== user.uid) {
      return;
    }

    // 본인은 추방할 수 없음
    if (memberId === user.uid) {
      Alert.alert("오류", "본인은 추방할 수 없습니다.");
      return;
    }

    Alert.alert("멤버 추방", `정말 ${memberUserId}님을 모임에서 추방하시겠습니까?`, [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "추방",
        style: "destructive",
        onPress: async () => {
          try {
            // 모임에서 멤버 제거
            await updateDoc(doc(db, "groups", groupId), {
              members: arrayRemove(memberId),
              memberCount: increment(-1),
            });

            // 사용자의 joinedGroups에서 제거
            const userDoc = await getDoc(doc(db, "users", memberId));
            const userData = userDoc.data();
            const joinedGroups = userData?.joinedGroups || [];
            if (joinedGroups.includes(groupId)) {
              await updateDoc(doc(db, "users", memberId), {
                joinedGroups: arrayRemove(groupId),
              });
            }

            // 데이터 다시 로드 (완료될 때까지 기다림)
            await loadMembers();

            Alert.alert("완료", "멤버가 추방되었습니다.");
          } catch (error: any) {
            console.error("Error removing member:", error);
            Alert.alert("오류", error?.message || "멤버 추방에 실패했습니다.");
          }
        },
      },
    ]);
  };

  const handleLeaveGroup = () => {
    if (!group || !user) {
      return;
    }

    Alert.alert("모임 탈퇴", "정말로 탈퇴하시겠습니까?", [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "탈퇴",
        style: "destructive",
        onPress: async () => {
          try {
            // 모임에서 본인 제거
            await updateDoc(doc(db, "groups", groupId), {
              members: arrayRemove(user.uid),
              memberCount: increment(-1),
            });

            // 사용자의 joinedGroups에서 제거
            const userDoc = await getDoc(doc(db, "users", user.uid));
            const userData = userDoc.data();
            const joinedGroups = userData?.joinedGroups || [];
            if (joinedGroups.includes(groupId)) {
              await updateDoc(doc(db, "users", user.uid), {
                joinedGroups: arrayRemove(groupId),
              });
            }

            // 모임 상세 페이지로 돌아가기
            router.back();
          } catch (error: any) {
            console.error("Error leaving group:", error);
            Alert.alert("오류", error?.message || "모임 탈퇴에 실패했습니다.");
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
          <Text style={styles.headerTitle}>참여 인원</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  const isCreator = user && group && group.creatorId === user.uid;

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
        {/* 참여 인원 섹션 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>참여 인원</Text>
            <Text style={styles.sectionCount}>{group?.memberCount || 0}명</Text>
          </View>

          {members.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>참여 인원이 없습니다</Text>
            </View>
          ) : (
            <View style={styles.membersList}>
              {members.map((member) => {
                const isMemberCreator = member.uid === group?.creatorId;
                const isCurrentUser = user && member.uid === user.uid;
                const canRemove = isCreator && !isMemberCreator; // 모임장이고 본인이 아닌 경우만 추방 가능
                const canLeave = !isCreator && isCurrentUser; // 모임장이 아니고 본인인 경우 탈퇴 가능
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
                          <Image
                            source={{ uri: avatarUrl }}
                            style={styles.memberAvatar}
                          />
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
                            {isMemberCreator && (
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
                    {canRemove && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveMember(member.uid, member.userId)}
                      >
                        <Ionicons name="log-out-outline" size={24} color="#FF4444" />
                      </TouchableOpacity>
                    )}
                    {canLeave && (
                      <TouchableOpacity
                        style={styles.leaveButton}
                        onPress={handleLeaveGroup}
                      >
                        <Ionicons name="exit-outline" size={24} color="#FF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* 모임장이고 신청서가 필요한 모임인 경우 대기중인 신청자 섹션 */}
        {isCreator && group && group.requiresApplication === true && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>대기중인 신청자</Text>
              <Text style={styles.sectionCount}>{pendingApplications.length}명</Text>
            </View>

            {pendingApplications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={48} color="#CCC" />
                <Text style={styles.emptyText}>대기중인 신청자가 없습니다</Text>
              </View>
            ) : (
              <View style={styles.membersList}>
                {pendingApplications.map((application) => {
                  const applicant = application.applicant;
                  const avatarUrl =
                    applicant.avatarUrl ||
                    `https://api.dicebear.com/9.x/identicon/png?seed=${encodeURIComponent(
                      applicant.userId || "unknown"
                    )}&size=128`;
                  return (
                    <TouchableOpacity
                      key={application.id}
                      style={styles.pendingItem}
                      onPress={() => {
                        router.push({
                          pathname: "/view-application",
                          params: { applicationId: application.id },
                        } as any);
                      }}
                    >
                      <View style={styles.memberHeader}>
                        {avatarUrl ? (
                          <Image
                            source={{ uri: avatarUrl }}
                            style={styles.memberAvatar}
                          />
                        ) : (
                          <View style={styles.memberAvatarPlaceholder}>
                            <Ionicons name="person" size={20} color="#999" />
                          </View>
                        )}
                        <View style={styles.memberTextInfo}>
                          <View style={styles.memberNameRow}>
                            <Text style={styles.memberName}>
                              {applicant.userId || "알 수 없음"}
                            </Text>
                            <View style={styles.pendingBadge}>
                              <Ionicons name="time-outline" size={12} color="#4A90E2" />
                              <Text style={styles.pendingBadgeText}>대기중</Text>
                            </View>
                          </View>
                          {applicant.intro && (
                            <Text style={styles.memberIntro} numberOfLines={2}>
                              {applicant.intro}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#999" />
                    </TouchableOpacity>
                  );
                })}
              </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A90E2",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  removeButton: {
    padding: 4,
    marginLeft: 8,
  },
  leaveButton: {
    padding: 4,
    marginLeft: 8,
  },
  pendingItem: {
    backgroundColor: "#F0F7FF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#B3D9FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  memberInfo: {
    gap: 8,
    flex: 1,
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
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E6F4FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  pendingBadgeText: {
    fontSize: 10,
    color: "#4A90E2",
    fontWeight: "600",
  },
});
