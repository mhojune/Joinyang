import { useAuth } from "@/lib/auth-context";
import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";

export default function MainScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>메인</Text>
      <Text style={styles.subtitle}>
        {user?.email ? `${user.email}님 환영합니다!` : "환영합니다!"}
      </Text>
      <View style={{ height: 12 }} />
      <Button title="로그아웃" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
  },
});
