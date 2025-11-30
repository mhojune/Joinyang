import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  Alert,
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

type Group = {
  id: string;
  name: string;
  creatorId: string;
  members: string[];
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

export default function EditPostScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [group, setGroup] = React.useState<Group | null>(null);
  const [post, setPost] = React.useState<Post | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [postType, setPostType] = React.useState<"notice" | "assignment" | "general">(
    "general"
  );
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [titleError, setTitleError] = React.useState(false);
  const [contentError, setContentError] = React.useState(false);

  React.useEffect(() => {
    if (postId) {
      loadPostData();
    }
  }, [postId]);

  const loadPostData = async () => {
    if (!postId) return;

    setLoading(true);
    try {
      // 게시글 데이터 로드
      const postDoc = await getDoc(doc(db, "posts", postId));
      if (!postDoc.exists()) {
        Alert.alert("오류", "게시글을 찾을 수 없습니다.", [
          {
            text: "확인",
            onPress: () => router.back(),
          },
        ]);
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
        const groupData = {
          id: groupDoc.id,
          ...groupDoc.data(),
        } as Group;
        setGroup(groupData);

        // 본인이 작성한 글인지 확인
        if (!user || postData.authorId !== user.uid) {
          Alert.alert("오류", "본인이 작성한 글만 수정할 수 있습니다.", [
            {
              text: "확인",
              onPress: () => router.back(),
            },
          ]);
          return;
        }
      }

      // 게시글 데이터로 폼 초기화
      setPostType(postData.type);
      setTitle(postData.title);
      setContent(postData.content);
    } catch (error: any) {
      console.error("Error loading post data:", error);
      Alert.alert("오류", error?.message || "게시글 데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const isCreator = user && group && group.creatorId === user.uid;

  const handleSubmit = async () => {
    if (!user || !postId || !post) return;

    // 유효성 검사
    let hasError = false;
    if (!title.trim()) {
      setTitleError(true);
      hasError = true;
    } else {
      setTitleError(false);
    }

    if (!content.trim()) {
      setContentError(true);
      hasError = true;
    } else {
      setContentError(false);
    }

    if (hasError) {
      Alert.alert("입력 오류", "제목과 내용을 모두 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      // 게시글 수정
      await updateDoc(doc(db, "posts", postId), {
        title: title.trim(),
        content: content.trim(),
        type: postType,
      });

      Alert.alert("성공", "게시글이 수정되었습니다.", [
        {
          text: "확인",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error updating post:", error);
      Alert.alert("오류", error?.message || "게시글 수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>게시글 수정</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!post || !group) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>게시글 수정</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>게시글을 불러올 수 없습니다</Text>
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
        <Text style={styles.headerTitle}>게시글 수정</Text>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#4A90E2" />
          ) : (
            <Text style={styles.submitButtonText}>완료</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 게시글 타입 선택 (모임장만) */}
          {isCreator && (
            <View style={styles.typeSection}>
              <Text style={styles.sectionLabel}>게시글 타입</Text>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    postType === "notice" && styles.typeButtonActive,
                    postType === "notice" && { borderColor: "#FF6B6B" },
                  ]}
                  onPress={() => setPostType("notice")}
                >
                  <Ionicons
                    name="megaphone"
                    size={18}
                    color={postType === "notice" ? "#FF6B6B" : "#999"}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      postType === "notice" && styles.typeButtonTextActive,
                      postType === "notice" && { color: "#FF6B6B" },
                    ]}
                  >
                    공지
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    postType === "assignment" && styles.typeButtonActive,
                    postType === "assignment" && { borderColor: "#4A90E2" },
                  ]}
                  onPress={() => setPostType("assignment")}
                >
                  <Ionicons
                    name="document-text"
                    size={18}
                    color={postType === "assignment" ? "#4A90E2" : "#999"}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      postType === "assignment" && styles.typeButtonTextActive,
                      postType === "assignment" && { color: "#4A90E2" },
                    ]}
                  >
                    과제
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    postType === "general" && styles.typeButtonActive,
                    postType === "general" && { borderColor: "#999" },
                  ]}
                  onPress={() => setPostType("general")}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={18}
                    color={postType === "general" ? "#999" : "#999"}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      postType === "general" && styles.typeButtonTextActive,
                      postType === "general" && { color: "#999" },
                    ]}
                  >
                    일반
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 제목 입력 */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>
              제목 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.titleInput, titleError && styles.inputError]}
              placeholder="제목을 입력하세요"
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (titleError) setTitleError(false);
              }}
              maxLength={100}
            />
            {titleError && <Text style={styles.errorText}>제목을 입력해주세요</Text>}
          </View>

          {/* 내용 입력 */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>
              내용 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.contentInput, contentError && styles.inputError]}
              placeholder="내용을 입력하세요"
              value={content}
              onChangeText={(text) => {
                setContent(text);
                if (contentError) setContentError(false);
              }}
              multiline
              numberOfLines={10}
              textAlignVertical="top"
              maxLength={2000}
            />
            {contentError && <Text style={styles.errorText}>내용을 입력해주세요</Text>}
            <Text style={styles.charCount}>{content.length}/2000</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  submitButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4A90E2",
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
    fontSize: 12,
    color: "#FF4444",
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  typeSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  required: {
    color: "#FF4444",
  },
  typeButtons: {
    flexDirection: "row",
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    backgroundColor: "#F9F9F9",
    gap: 6,
  },
  typeButtonActive: {
    backgroundColor: "#fff",
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
  },
  typeButtonTextActive: {
    fontWeight: "700",
  },
  inputSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  titleInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fff",
  },
  contentInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#333",
    backgroundColor: "#fff",
    minHeight: 200,
  },
  inputError: {
    borderColor: "#FF4444",
    borderWidth: 2,
  },
  charCount: {
    fontSize: 12,
    color: "#999",
    textAlign: "right",
    marginTop: 4,
  },
});
