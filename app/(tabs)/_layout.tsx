import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Android에서 시스템 네비게이션 바 높이를 고려한 paddingBottom 계산
  // edgeToEdge 모드에서는 시스템 네비게이션 바가 겹칠 수 있으므로 충분한 여백 확보
  // Android 버튼 네비게이션 바는 보통 48-56px, gesture navigation은 0이지만 안전을 위해 최소값 보장
  const bottomPadding =
    Platform.OS === "ios" ? 24 + insets.bottom : Math.max(insets.bottom, 48); // Android는 최소 48px (시스템 네비게이션 바 높이 고려)

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4A90E2", // 하늘색
        tabBarInactiveTintColor: "#999",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#E0E0E0",
          paddingBottom: bottomPadding,
          paddingTop: 8,
          height: Platform.OS === "ios" ? 88 + insets.bottom : 56 + bottomPadding,
          elevation: 8, // Android에서 그림자 효과
          shadowColor: "#000", // iOS에서 그림자 효과
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: "모임",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "캘린더",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
