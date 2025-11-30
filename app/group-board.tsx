import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

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
  author?: UserData;
};

export default function GroupBoardScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [group, setGroup] = React.useState<Group | null>(null);
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (groupId) {
      loadBoardData();
    }
  }, [groupId]);

  useFocusEffect(
    React.useCallback(() => {
      if (groupId) {
        loadBoardData();
      }
    }, [groupId])
  );

  const loadBoardData = async () => {
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

        // 게시글 로드
        const postsRef = collection(db, "posts");
        const q = query(postsRef, where("groupId", "==", groupId));
        const postsSnapshot = await getDocs(q);
        const postsData: Post[] = [];

        for (const postDoc of postsSnapshot.docs) {
          const postData = {
            id: postDoc.id,
            ...postDoc.data(),
          } as Post;

          // 작성자 정보 로드
          try {
            const authorDoc = await getDoc(doc(db, "users", postData.authorId));
            if (authorDoc.exists()) {
              postData.author = authorDoc.data() as UserData;
            }
          } catch (error) {
            console.error(`Error loading author ${postData.authorId}:`, error);
          }

          postsData.push(postData);
        }

        // 최신순 정렬
        postsData.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });

        setPosts(postsData);
      }
    } catch (error) {
      console.error("Error loading board data:", error);
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
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return `${minutes}분 전`;
      }
      return `${hours}시간 전`;
    } else if (days < 7) {
      return `${days}일 전`;
    } else {
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>게시판</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  const isMember = user && group && group.members.includes(user.uid);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>게시판</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* 게시글 목록 */}
        {posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>아직 게시글이 없습니다</Text>
            <Text style={styles.emptySubText}>첫 게시글을 작성해보세요!</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.postsList}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
          >
            {posts.map((post) => {
              const authorAvatar =
                post.author?.avatarUrl ||
                `https://api.dicebear.com/9.x/identicon/png?seed=${encodeURIComponent(
                  post.author?.userId || "unknown"
                )}&size=128`;

              return (
                <TouchableOpacity
                  key={post.id}
                  style={styles.postItem}
                  onPress={() => {
                    router.push(`/post-detail?postId=${post.id}` as any);
                  }}
                >
                  <View style={styles.postHeader}>
                    <View style={styles.postAuthor}>
                      {authorAvatar ? (
                        <Image
                          source={{ uri: authorAvatar }}
                          style={styles.authorAvatar}
                        />
                      ) : (
                        <View style={styles.authorAvatarPlaceholder}>
                          <Ionicons name="person" size={16} color="#999" />
                        </View>
                      )}
                      <View style={styles.postAuthorInfo}>
                        <Text style={styles.authorName}>
                          {post.author?.userId || "알 수 없음"}
                        </Text>
                        <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.postTypeBadge,
                        { backgroundColor: getPostTypeColor(post.type) + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.postTypeText,
                          { color: getPostTypeColor(post.type) },
                        ]}
                      >
                        {getPostTypeLabel(post.type)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.postTitle} numberOfLines={2}>
                    {post.title}
                  </Text>
                  {post.content && (
                    <Text style={styles.postContent} numberOfLines={3}>
                      {post.content}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* 게시글 작성 버튼 (멤버만 표시) */}
      {isMember && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            router.push(`/create-post?groupId=${groupId}` as any);
          }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
  },
  postsList: {
    flex: 1,
  },
  postItem: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  postAuthor: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  authorAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  postAuthorInfo: {
    flex: 1,
    gap: 2,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  postDate: {
    fontSize: 12,
    color: "#999",
  },
  postTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  postTypeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  postTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    lineHeight: 22,
  },
  postContent: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4A90E2",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
