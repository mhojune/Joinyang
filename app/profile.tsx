import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type UserData = {
  userId: string;
  email: string;
  intro: string;
  avatarUrl?: string;
  createdAt: any; // Timestamp
  joinedGroups: string[];
};

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

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userData, setUserData] = React.useState<UserData | null>(null);
  const [joinedGroups, setJoinedGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingGroups, setLoadingGroups] = React.useState(false);
  const [editing, setEditing] = React.useState<{
    userId?: boolean;
    intro?: boolean;
  }>({});
  const [editValues, setEditValues] = React.useState({
    userId: "",
    intro: "",
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      loadUserData();
      loadJoinedGroups();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as UserData;
        setUserData(data);
        setEditValues({
          userId: data.userId || "",
          intro: data.intro || "",
        });
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadJoinedGroups = async () => {
    if (!user) return;

    setLoadingGroups(true);
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      const joinedGroupIds = userData?.joinedGroups || [];

      if (joinedGroupIds.length > 0) {
        const groupsData: Group[] = [];
        for (const groupId of joinedGroupIds) {
          const groupDoc = await getDoc(doc(db, "groups", groupId));
          if (groupDoc.exists()) {
            groupsData.push({
              id: groupDoc.id,
              ...groupDoc.data(),
            } as Group);
          }
        }
        setJoinedGroups(groupsData);
      } else {
        setJoinedGroups([]);
      }
    } catch (error) {
      console.error("Error loading joined groups:", error);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleSave = async (field: "userId" | "intro") => {
    if (!user) return;

    setSaving(true);
    try {
      // userId 중복 체크
      if (field === "userId") {
        const trimmedUserId = editValues.userId.trim();
        if (!trimmedUserId) {
          Alert.alert("오류", "프로필 아이디를 입력해주세요.");
          setSaving(false);
          return;
        }

        // 현재 userId와 다를 때만 중복 체크
        if (trimmedUserId !== userData?.userId) {
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("userId", "==", trimmedUserId));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            Alert.alert("오류", "이미 사용 중인 프로필 아이디입니다.");
            setSaving(false);
            return;
          }
        }
      }

      const updateData: any = {};
      if (field === "userId") {
        updateData.userId = editValues.userId.trim();
      } else if (field === "intro") {
        updateData.intro = editValues.intro.trim();
      }

      await updateDoc(doc(db, "users", user.uid), updateData);

      // 로컬 상태 업데이트
      setUserData((prev) => (prev ? { ...prev, ...updateData } : null));
      setEditing((prev) => ({ ...prev, [field]: false }));

      Alert.alert("성공", "프로필이 업데이트되었습니다.");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      Alert.alert("오류", error?.message || "프로필 업데이트에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "날짜 정보 없음";

    try {
      // Firestore Timestamp를 Date로 변환
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return `${year}년 ${month}월 ${day}일`;
    } catch (error) {
      return "날짜 정보 없음";
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
      {/* 뒤로가기 버튼 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 프로필 정보 */}
          <View style={styles.infoSection}>
            {/* 프로필 아이콘 */}
            <View style={styles.avatarSection}>
              {userData?.avatarUrl ? (
                <Image source={{ uri: userData.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#999" />
                </View>
              )}
            </View>
            <EditableInfoRow
              label="프로필 아이디"
              value={userData?.userId || "-"}
              editing={!!editing.userId}
              editValue={editValues.userId}
              onEditChange={(text) =>
                setEditValues((prev) => ({ ...prev, userId: text }))
              }
              onEdit={() => {
                setEditing((prev) => ({ ...prev, userId: !prev.userId }));
                setEditValues((prev) => ({
                  ...prev,
                  userId: userData?.userId || "",
                }));
              }}
              onSave={() => handleSave("userId")}
              onCancel={() => {
                setEditValues((prev) => ({
                  ...prev,
                  userId: userData?.userId || "",
                }));
                setEditing((prev) => ({ ...prev, userId: false }));
              }}
              saving={saving}
            />
            <InfoRow label="이메일" value={userData?.email || user?.email || "-"} />
            <InfoRow label="가입일" value={formatDate(userData?.createdAt)} />
            <EditableInfoRow
              label="자기소개"
              value={userData?.intro || "(비어있음)"}
              editing={!!editing.intro}
              editValue={editValues.intro}
              onEditChange={(text) => setEditValues((prev) => ({ ...prev, intro: text }))}
              onEdit={() => {
                setEditing((prev) => ({ ...prev, intro: !prev.intro }));
                setEditValues((prev) => ({
                  ...prev,
                  intro: userData?.intro || "",
                }));
              }}
              onSave={() => handleSave("intro")}
              onCancel={() => {
                setEditValues((prev) => ({
                  ...prev,
                  intro: userData?.intro || "",
                }));
                setEditing((prev) => ({ ...prev, intro: false }));
              }}
              saving={saving}
              multiline
            />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>참가 중인 모임</Text>
              {loadingGroups ? (
                <ActivityIndicator
                  size="small"
                  color="#4A90E2"
                  style={{ marginTop: 8 }}
                />
              ) : joinedGroups.length === 0 ? (
                <Text style={styles.infoValue}>없음</Text>
              ) : (
                <View style={styles.groupsList}>
                  {joinedGroups.map((group) => (
                    <GroupItem key={group.id} group={group} userId={user?.uid} />
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* 옵션칸 */}
          <View style={styles.optionsSection}>
            <TouchableOpacity style={styles.optionButton}>
              <Ionicons name="settings-outline" size={24} color="#333" />
              <Text style={styles.optionText}>설정</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton}>
              <Ionicons name="help-circle-outline" size={24} color="#333" />
              <Text style={styles.optionText}>도움말</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* 로그아웃 버튼 */}
          <View style={styles.logoutSection}>
            <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
              <Text style={styles.logoutText}>로그아웃</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function GroupItem({ group, userId }: { group: Group; userId?: string }) {
  const isCreator = userId === group.creatorId;
  const groupColor = group.color || "#4A90E2";

  return (
    <View style={styles.groupItem}>
      <View style={[styles.groupItemColorBar, { backgroundColor: groupColor }]} />
      <View style={styles.groupItemContent}>
        <View style={styles.groupItemHeader}>
          <Text style={styles.groupItemName}>{group.name}</Text>
          {isCreator && (
            <View style={styles.groupItemCreatorBadge}>
              <Ionicons name="star" size={10} color="#FFA500" />
              <Text style={styles.groupItemCreatorText}>내가 만든 모임</Text>
            </View>
          )}
        </View>
        {group.description && (
          <Text style={styles.groupItemDescription} numberOfLines={1}>
            {group.description}
          </Text>
        )}
        <View style={styles.groupItemMeta}>
          <View style={styles.groupItemMemberBadge}>
            <Ionicons name="people" size={10} color="#4A90E2" />
            <Text style={styles.groupItemMemberText}>{group.memberCount}명</Text>
          </View>
          {group.type && (
            <View style={styles.groupItemTypeBadge}>
              <Ionicons
                name={group.type === "study" ? "school" : "heart"}
                size={10}
                color="#666"
              />
              <Text style={styles.groupItemTypeText}>
                {group.type === "study" ? "스터디" : "취미 모임"}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function EditableInfoRow({
  label,
  value,
  editing,
  editValue,
  onEditChange,
  onEdit,
  onSave,
  onCancel,
  saving,
  multiline = false,
}: {
  label: string;
  value: string;
  editing: boolean;
  editValue: string;
  onEditChange: (text: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowHeader}>
        <Text style={styles.infoLabel}>{label}</Text>
        {!editing ? (
          <TouchableOpacity onPress={onEdit} style={styles.editIconButton}>
            <Ionicons name="pencil" size={18} color="#4A90E2" />
          </TouchableOpacity>
        ) : null}
      </View>
      {editing ? (
        <View>
          <TextInput
            style={[styles.editInput, multiline && styles.editInputMultiline]}
            value={editValue}
            onChangeText={onEditChange}
            placeholder={value === "(비어있음)" ? "" : value}
            multiline={multiline}
            numberOfLines={multiline ? 4 : 1}
          />
          <View style={styles.editButtons}>
            <TouchableOpacity
              style={[styles.editButton, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={[styles.editButtonText, { color: "#333" }]}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editButton, styles.saveButton]}
              onPress={onSave}
              disabled={saving}
            >
              <Text style={[styles.editButtonText, { color: "#fff" }]}>
                {saving ? "저장 중..." : "저장"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.infoValue}>{value}</Text>
      )}
    </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  infoSection: {
    padding: 16,
    gap: 16,
  },
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  infoRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  editIconButton: {
    padding: 4,
  },
  infoValue: {
    fontSize: 16,
    color: "#333",
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#4A90E2",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  editInputMultiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  editButtons: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 60,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#E0E0E0",
  },
  saveButton: {
    backgroundColor: "#4A90E2",
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  optionsSection: {
    marginTop: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  logoutSection: {
    marginTop: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  logoutButton: {
    backgroundColor: "#FF4444",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#E0E0E0",
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#E0E0E0",
  },
  groupsList: {
    marginTop: 8,
    gap: 8,
  },
  groupItem: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  groupItemColorBar: {
    width: 3,
  },
  groupItemContent: {
    flex: 1,
    padding: 12,
  },
  groupItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  groupItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  groupItemCreatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF4E6",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  groupItemCreatorText: {
    fontSize: 9,
    color: "#FFA500",
    fontWeight: "600",
  },
  groupItemDescription: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  groupItemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupItemMemberBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E6F4FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  groupItemMemberText: {
    fontSize: 10,
    color: "#4A90E2",
    fontWeight: "500",
  },
  groupItemTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0E0E0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  groupItemTypeText: {
    fontSize: 10,
    color: "#666",
    fontWeight: "500",
  },
});
