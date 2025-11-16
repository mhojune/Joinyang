import Header from "@/components/Header";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header />

      {/* 메인 컨텐츠 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 오늘 일정 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>오늘 일정</Text>
          <View style={styles.scheduleCard}>
            <Text style={styles.emptyText}>오늘 예정된 일정이 없습니다</Text>
          </View>
        </View>

        {/* 인기 모임 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>인기 모임</Text>
          <View style={styles.groupCard}>
            <Text style={styles.emptyText}>인기 모임이 없습니다</Text>
          </View>
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
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  scheduleCard: {
    backgroundColor: "#E6F4FE", // 하늘색 배경
    borderRadius: 12,
    padding: 20,
    minHeight: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  groupCard: {
    backgroundColor: "#E6F4FE", // 하늘색 배경
    borderRadius: 12,
    padding: 20,
    minHeight: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
  },
});
