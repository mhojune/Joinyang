import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, getDocs, limit, orderBy, query, startAt, where } from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
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
  description: string;
  type?: "study" | "hobby";
  location?: string;
  color?: string;
  memberCount: number;
  requiresApplication?: boolean;
};

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);
    setLoading(true);
    try {
      const groupsRef = collection(db, "groups");
      const queryText = searchQuery.trim().toLowerCase();
      
      // Firestore는 부분 일치 검색을 직접 지원하지 않으므로
      // 클라이언트 측에서 필터링하는 방식 사용 (Spark 플랜에서 가능)
      // 또는 "시작하는" 검색을 위해 범위 쿼리 사용
      
      // 방법 1: 모든 모임을 가져와서 클라이언트에서 필터링 (간단하지만 데이터가 많으면 비효율적)
      // 방법 2: 이름으로 시작하는 검색 (더 효율적)
      
      // 이름으로 시작하는 검색 시도
      const searchQueryUpper = queryText.charAt(0).toUpperCase() + queryText.slice(1);
      const searchQueryLower = queryText;
      const searchQueryEnd = queryText.slice(0, -1) + String.fromCharCode(queryText.charCodeAt(queryText.length - 1) + 1);
      
      // 대소문자 모두 고려한 범위 쿼리
      const q = query(
        groupsRef,
        where("name", ">=", searchQueryLower),
        where("name", "<", searchQueryEnd),
        orderBy("name"),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      const results: Group[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const groupName = data.name?.toLowerCase() || "";
        const groupDescription = data.description?.toLowerCase() || "";
        
        // 부분 일치 검색을 위해 클라이언트 측에서 추가 필터링
        if (
          groupName.includes(queryText) ||
          groupDescription.includes(queryText)
        ) {
          results.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            type: data.type,
            location: data.location,
            color: data.color,
            memberCount: data.memberCount || 0,
            requiresApplication: data.requiresApplication,
          });
        }
      });
      
      // 만약 범위 쿼리로 결과가 없으면 모든 모임을 가져와서 필터링
      if (results.length === 0) {
        const allGroupsQuery = query(groupsRef, orderBy("memberCount", "desc"), limit(100));
        const allSnapshot = await getDocs(allGroupsQuery);
        
        allSnapshot.forEach((doc) => {
          const data = doc.data();
          const groupName = data.name?.toLowerCase() || "";
          const groupDescription = data.description?.toLowerCase() || "";
          
          if (
            groupName.includes(queryText) ||
            groupDescription.includes(queryText)
          ) {
            results.push({
              id: doc.id,
              name: data.name,
              description: data.description,
              type: data.type,
              location: data.location,
              color: data.color,
              memberCount: data.memberCount || 0,
              requiresApplication: data.requiresApplication,
            });
          }
        });
      }
      
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching groups:", error);
      // 인덱스가 없어서 에러가 발생할 수 있으므로, 모든 모임을 가져와서 필터링
      try {
        const groupsRef = collection(db, "groups");
        const allGroupsQuery = query(groupsRef, orderBy("memberCount", "desc"), limit(100));
        const snapshot = await getDocs(allGroupsQuery);
        const results: Group[] = [];
        const queryText = searchQuery.trim().toLowerCase();
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const groupName = data.name?.toLowerCase() || "";
          const groupDescription = data.description?.toLowerCase() || "";
          
          if (
            groupName.includes(queryText) ||
            groupDescription.includes(queryText)
          ) {
            results.push({
              id: doc.id,
              name: data.name,
              description: data.description,
              type: data.type,
              location: data.location,
              color: data.color,
              memberCount: data.memberCount || 0,
              requiresApplication: data.requiresApplication,
            });
          }
        });
        
        setSearchResults(results);
      } catch (fallbackError) {
        console.error("Error in fallback search:", fallbackError);
        setSearchResults([]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              router.back();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="검색어를 입력하세요"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setHasSearched(false);
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={!searchQuery.trim()}
          >
            <Text
              style={[
                styles.searchButtonText,
                !searchQuery.trim() && styles.searchButtonTextDisabled,
              ]}
            >
              검색
            </Text>
          </TouchableOpacity>
        </View>

        {/* 검색 결과 */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.emptyText}>검색 중...</Text>
          </View>
        ) : hasSearched && searchResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
            <Text style={styles.emptySubtext}>다른 검색어를 시도해보세요</Text>
          </View>
        ) : !hasSearched ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>검색어를 입력하고 검색 버튼을 눌러주세요</Text>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            {searchResults.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.resultItem}
                onPress={() => router.push(`/group-detail?groupId=${group.id}`)}
              >
                <View style={[styles.groupColorBar, { backgroundColor: group.color || "#4A90E2" }]} />
                <View style={styles.groupContent}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  {group.description && (
                    <Text style={styles.groupDescription} numberOfLines={2}>
                      {group.description}
                    </Text>
                  )}
                  <View style={styles.groupMeta}>
                    {group.type && (
                      <View style={styles.groupTypeBadge}>
                        <Ionicons
                          name={group.type === "study" ? "school" : "heart"}
                          size={12}
                          color="#666"
                        />
                        <Text style={styles.groupTypeText}>
                          {group.type === "study" ? "스터디" : "취미 모임"}
                        </Text>
                      </View>
                    )}
                    {group.location && (
                      <View style={styles.groupLocation}>
                        <Ionicons name="location" size={12} color="#666" />
                        <Text style={styles.groupLocationText}>{group.location}</Text>
                      </View>
                    )}
                    <Text style={styles.memberCount}>
                      멤버 {group.memberCount || 0}명
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    gap: 8,
  },
  backButton: {
    padding: 4,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchIcon: {
    marginLeft: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchButtonText: {
    fontSize: 16,
    color: "#4A90E2",
    fontWeight: "600",
  },
  searchButtonTextDisabled: {
    color: "#CCC",
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 120,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    fontWeight: "500",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
  },
  resultsContainer: {
    padding: 16,
  },
  resultItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    overflow: "hidden",
    flexDirection: "row",
  },
  groupColorBar: {
    width: 4,
  },
  groupContent: {
    flex: 1,
    padding: 16,
  },
  groupName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    lineHeight: 20,
  },
  groupMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  groupTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  groupTypeText: {
    fontSize: 12,
    color: "#666",
  },
  groupLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  groupLocationText: {
    fontSize: 12,
    color: "#666",
  },
  memberCount: {
    fontSize: 12,
    color: "#999",
    marginLeft: "auto",
  },
});
