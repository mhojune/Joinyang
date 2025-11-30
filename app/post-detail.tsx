import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { deleteDoc, doc, getDoc } from "firebase/firestore";
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
};

type UserData = {
  userId: string;
  email: string;
  intro: string;
  avatarUrl?: string;
  createdAt: any;
};

type Post = {
  id: string;
  groupId: string;
  authorId: string;
  title: string;
  content: string;
  type: "notice" | "assignment" | "general";
  createdAt: any;
};

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = React.useState<Post | null>(null);
  const [group, setGroup] = React.useState<Group | null>(null);
  const [author, setAuthor] = React.useState<UserData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (postId) {
      loadPostData();
    }
  }, [postId]);

  useFocusEffect(
    React.useCallback(() => {
      if (postId) {
        loadPostData();
      }
    }, [postId])
  );

  const loadPostData = async () => {
    if (!postId) return;

    setLoading(true);
    try {
      // 게시글 데이터 로드
      const postDoc = await getDoc(doc(db, "posts", postId));
      if (!postDoc.exists()) {
        router.back();
        return;
      }

      const postData = {
        id: postDoc.id,
        ...postDoc.data(),
      } as Post;
      setPost(postData);

      // 모임 데이터 로드
      const groupDoc = await getDoc(doc(db, "groups", postData.groupId));
      if (groupDoc.exists()) {
        setGroup({
          id: groupDoc.id,
          ...groupDoc.data(),
        } as Group);
      }

      // 작성자 정보 로드
      const authorDoc = await getDoc(doc(db, "users", postData.authorId));
      if (authorDoc.exists()) {
        setAuthor(authorDoc.data() as UserData);
      }
    } catch (error) {
      console.error("Error loading post data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPostTypeLabel = (type: string) => {
    switch (type) {
      case "notice":
        return "공지";
      case "assignment":
        return "과제";
      default:
        return "일반";
    }
  };

  const getPostTypeColor = (type: string) => {
    switch (type) {
      case "notice":
        return "#FF6B6B";
      case "assignment":
        return "#4A90E2";
      default:
        return "#999";
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDelete = () => {
    if (!post || !user || !group) return;

    // 권한 확인
    const isCreator = group.creatorId === user.uid;
    const isAuthor = post.authorId === user.uid;

    if (!isCreator && !isAuthor) {
      Alert.alert("오류", "게시글을 삭제할 권한이 없습니다.");
      return;
    }

    Alert.alert("게시글 삭제", "정말 이 게시글을 삭제하시겠습니까?", [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteDoc(doc(db, "posts", post.id));
            Alert.alert("완료", "게시글이 삭제되었습니다.", [
              {
                text: "확인",
                onPress: () => router.back(),
              },
            ]);
          } catch (error: any) {
            console.error("Error deleting post:", error);
            Alert.alert("오류", error?.message || "게시글 삭제에 실패했습니다.");
          } finally {
            setDeleting(false);
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
          <Text style={styles.headerTitle}>게시글</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!post || !group || !author) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>게시글</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>게시글을 불러올 수 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  const authorAvatar =
    author.avatarUrl ||
    `https://api.dicebear.com/9.x/identicon/png?seed=${encodeURIComponent(
      author.userId || "unknown"
    )}&size=128`;

  const isCreator = user && group && group.creatorId === user.uid;
  const isAuthor = user && post && post.authorId === user.uid;
  const canDelete = isCreator || isAuthor;
  const canEdit = isAuthor; // 본인이 작성한 글만 수정 가능

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>게시글</Text>
        <View style={styles.headerRight}>
          {canEdit && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                router.push(`/edit-post?postId=${post.id}` as any);
              }}
            >
              <Ionicons name="create-outline" size={24} color="#4A90E2" />
            </TouchableOpacity>
          )}
          {canDelete && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#FF4444" />
              ) : (
                <Ionicons name="trash-outline" size={24} color="#FF4444" />
              )}
            </TouchableOpacity>
          )}
          {!canEdit && !canDelete && <View style={styles.headerSpacer} />}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 작성자 정보 및 타입 */}
        <View style={styles.postHeader}>
          <View style={styles.authorSection}>
            {authorAvatar ? (
              <Image source={{ uri: authorAvatar }} style={styles.authorAvatar} />
            ) : (
              <View style={styles.authorAvatarPlaceholder}>
                <Ionicons name="person" size={20} color="#999" />
              </View>
            )}
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{author.userId || "알 수 없음"}</Text>
              <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
            </View>
          </View>
          <View
            style={[
              styles.postTypeBadge,
              { backgroundColor: getPostTypeColor(post.type) + "20" },
            ]}
          >
            <Text style={[styles.postTypeText, { color: getPostTypeColor(post.type) }]}>
              {getPostTypeLabel(post.type)}
            </Text>
          </View>
        </View>

        {/* 게시글 제목 */}
        <View style={styles.titleSection}>
          <Text style={styles.postTitle}>{post.title}</Text>
        </View>

        {/* 게시글 내용 */}
        <View style={styles.contentSection}>
          <Text style={styles.postContent}>{post.content}</Text>
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editButton: {
    padding: 4,
  },
  deleteButton: {
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
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  authorSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  authorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  authorAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  authorInfo: {
    flex: 1,
    gap: 4,
  },
  authorName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  postDate: {
    fontSize: 14,
    color: "#999",
  },
  postTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  postTypeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  titleSection: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  postTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    lineHeight: 32,
  },
  contentSection: {
    padding: 20,
    paddingTop: 16,
  },
  postContent: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
  },
});
