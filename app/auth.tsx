import { useAuth } from "@/lib/auth-context";
import React from "react";
import {
  Button,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AuthScreen() {
  const { signIn, signUp, isLoadingUser, user } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [isSignup, setIsSignup] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async () => {
    try {
      setError(null);
      if (isSignup) {
        if (!userId.trim()) {
          setError("프로필 아이디를 입력해주세요.");
          return;
        }
        await signUp(email.trim(), password, userId.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e: any) {
      setError(e?.message ?? "에러가 발생했습니다.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>{isSignup ? "회원가입" : "로그인"}</Text>
          {isSignup && (
            <TextInput
              placeholder="프로필 아이디"
              autoCapitalize="none"
              value={userId}
              onChangeText={setUserId}
              style={styles.input}
            />
          )}
          <TextInput
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={isSignup ? "회원가입" : "로그인"}
            onPress={onSubmit}
            disabled={isLoadingUser}
          />
          <View style={{ height: 8 }} />
          <Button
            title={isSignup ? "로그인으로" : "회원가입으로"}
            onPress={() => {
              setIsSignup((v) => !v);
              setUserId("");
              setError(null);
            }}
          />
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    alignItems: "stretch",
    justifyContent: "center",
    gap: 12,
  },
  logo: {
    width: 160,
    height: 160,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  error: {
    color: "crimson",
    textAlign: "center",
    marginTop: 4,
  },
});
