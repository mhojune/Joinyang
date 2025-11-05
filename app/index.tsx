import { StyleSheet, Text, View } from "react-native";

export default function AppIndex() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello</Text>
      <Text>빈 프로젝트 시작 화면입니다.</Text>
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
    fontWeight: "600",
  },
});
