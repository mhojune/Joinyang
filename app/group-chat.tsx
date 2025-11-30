import { useAuth } from "@/lib/auth-context";
import { db, realtimeDb } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { off, onValue, push, ref, set } from "firebase/database";
import { doc, getDoc } from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
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

type UserData = {
  userId: string;
  email: string;
  intro: string;
  avatarUrl?: string;
  createdAt: any;
};

type Message = {
  id: string;
  userId: string;
  message: string;
  timestamp: number;
  author?: UserData;
};

export default function GroupChatScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets() || { top: 0, bottom: 0, left: 0, right: 0 };
  const [group, setGroup] = React.useState<Group | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [messageText, setMessageText] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [isMember, setIsMember] = React.useState(false);
  const [userCache, setUserCache] = React.useState<Record<string, UserData>>({});
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = React.useState(false);

  // 키보드 상태 추적 및 스크롤 조정
  React.useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        setIsKeyboardOpen(true);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        // 키보드가 완전히 닫힌 후 상태 업데이트
        setTimeout(() => {
          setIsKeyboardOpen(false);
        }, 100);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (groupId && user) {
        loadGroupData();
      }
      // 화면에 포커스가 돌아올 때 키보드 닫기 (레이아웃 리셋)
      Keyboard.dismiss();
      return () => {
        // 컴포넌트 언마운트 시 리스너 제거
        if (groupId) {
          const messagesRef = ref(realtimeDb, `chats/${groupId}/messages`);
          off(messagesRef);
        }
      };
    }, [groupId, user])
  );

  const loadGroupData = async () => {
    if (!groupId || !user) return;

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

        // 멤버 확인
        const memberCheck = groupData.members.includes(user.uid);
        setIsMember(memberCheck);

        if (!memberCheck) {
          Alert.alert("접근 불가", "이 모임의 멤버만 채팅방에 접근할 수 있습니다.", [
            {
              text: "확인",
              onPress: () => router.back(),
            },
          ]);
          setLoading(false);
          return;
        }

        // Realtime Database에 그룹 멤버 정보 저장 (보안 규칙용)
        try {
          const memberRef = ref(realtimeDb, `groupMembers/${groupId}/${user.uid}`);
          await set(memberRef, true);
        } catch (dbError) {
          console.error("Error setting member ref:", dbError);
          // Realtime Database 에러는 치명적이지 않으므로 계속 진행
        }

        // 메시지 리스너 설정
        setupMessageListener(groupId);

        // 리스너 설정 후 로딩 해제
        setLoading(false);
      } else {
        Alert.alert("오류", "모임을 찾을 수 없습니다.", [
          {
            text: "확인",
            onPress: () => router.back(),
          },
        ]);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error loading group data:", error);
      Alert.alert("오류", "데이터를 불러오는 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  const setupMessageListener = (groupId: string) => {
    try {
      const messagesRef = ref(realtimeDb, `chats/${groupId}/messages`);

      onValue(messagesRef, async (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const messagesArray: Message[] = Object.entries(data)
            .map(([id, msg]: [string, any]) => ({
              id,
              userId: msg.userId,
              message: msg.message,
              timestamp: msg.timestamp || 0,
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

          // 사용자 정보 로드 (캐시 사용)
          const messagesWithAuthors = await Promise.all(
            messagesArray.map(async (msg) => {
              if (userCache[msg.userId]) {
                return { ...msg, author: userCache[msg.userId] };
              }

              try {
                const userDoc = await getDoc(doc(db, "users", msg.userId));
                if (userDoc.exists()) {
                  const userData = userDoc.data() as UserData;
                  setUserCache((prev) => ({ ...prev, [msg.userId]: userData }));
                  return { ...msg, author: userData };
                }
              } catch (error) {
                console.error(`Error loading user ${msg.userId}:`, error);
              }
              return msg;
            })
          );

          setMessages(messagesWithAuthors);

          // 스크롤을 맨 아래로
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } else {
          setMessages([]);
        }
      });
    } catch (error) {
      console.error("Error setting up message listener:", error);
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !user || !groupId || sending) return;

    setSending(true);
    try {
      const messagesRef = ref(realtimeDb, `chats/${groupId}/messages`);
      await push(messagesRef, {
        userId: user.uid,
        message: messageText.trim(),
        timestamp: Date.now(),
      });

      setMessageText("");
      // 키보드 닫기
      Keyboard.dismiss();
      setIsKeyboardOpen(false);
    } catch (error: any) {
      console.error("Error sending message:", error);
      Alert.alert("오류", "메시지 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`;

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();

    return `${month}/${day} ${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>채팅방</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!isMember || !group) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>채팅방</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>접근 권한이 없습니다</Text>
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
        <Text style={styles.headerTitle}>{group.name} 채팅방</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 메시지 리스트 및 입력 */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 50 : 0}
        enabled={isKeyboardOpen}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>아직 메시지가 없습니다</Text>
              <Text style={styles.emptySubText}>첫 메시지를 보내보세요!</Text>
            </View>
          ) : (
            messages.map((message) => {
              const isMyMessage = user && message.userId === user.uid;
              const authorAvatar =
                message.author?.avatarUrl ||
                `https://api.dicebear.com/9.x/identicon/png?seed=${message.userId}&size=128`;

              return (
                <View
                  key={message.id}
                  style={[styles.messageWrapper, isMyMessage && styles.myMessageWrapper]}
                >
                  {!isMyMessage && (
                    <View style={styles.avatarContainer}>
                      <Image source={{ uri: authorAvatar }} style={styles.avatar} />
                      <Text style={styles.authorName}>
                        {message.author?.userId || "알 수 없음"}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[styles.messageBubble, isMyMessage && styles.myMessageBubble]}
                  >
                    <Text
                      style={[styles.messageText, isMyMessage && styles.myMessageText]}
                    >
                      {message.message}
                    </Text>
                    <Text
                      style={[styles.messageTime, isMyMessage && styles.myMessageTime]}
                    >
                      {formatTime(message.timestamp)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* 메시지 입력 */}
        <View
          style={[
            styles.inputContainer,
            {
              // 키보드가 열려있을 때는 KeyboardAvoidingView가 처리하므로 최소 패딩
              // 키보드가 닫혀있을 때는 소프트키 영역만 고려
              paddingBottom: isKeyboardOpen ? 8 : Math.max(insets.bottom, 8),
            },
          ]}
        >
          <TextInput
            style={styles.input}
            placeholder="메시지를 입력하세요..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
            editable={!sending}
            onFocus={() => {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 300);
            }}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
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
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 16,
    fontWeight: "500",
  },
  emptySubText: {
    fontSize: 14,
    color: "#CCC",
    marginTop: 8,
  },
  messageWrapper: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
  },
  myMessageWrapper: {
    flexDirection: "row-reverse",
  },
  avatarContainer: {
    alignItems: "center",
    marginHorizontal: 8,
    minWidth: 48,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: "70%",
    backgroundColor: "#F0F0F0",
    borderRadius: 16,
    padding: 12,
    borderBottomLeftRadius: 4,
  },
  myMessageBubble: {
    backgroundColor: "#4A90E2",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  authorName: {
    fontSize: 10,
    fontWeight: "500",
    color: "#999",
    textAlign: "center",
  },
  messageText: {
    fontSize: 15,
    color: "#333",
    lineHeight: 20,
  },
  myMessageText: {
    color: "#fff",
  },
  messageTime: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  myMessageTime: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    backgroundColor: "#fff",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    maxHeight: 100,
    fontSize: 15,
    backgroundColor: "#F9F9F9",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4A90E2",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#CCC",
  },
});
