import Header from "@/components/Header";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type CalendarView = "month" | "week";

type Group = {
  id: string;
  name: string;
  schedule?: {
    daysOfWeek?: number[];
    startTime?: string;
    endTime?: string;
  } | null;
  color?: string;
};

type CalendarEvent = {
  id?: string;
  groupId?: string;
  groupName: string;
  dayOfWeek: number; // 0: 일요일, 1: 월요일, ..., 6: 토요일
  daysOfWeek?: number[]; // 주간 고정 일정용 (여러 요일)
  startDate?: Date; // 개인 일정용
  endDate?: Date; // 개인 일정용
  startTime: string;
  endTime: string;
  color: string;
  isPersonal?: boolean; // 개인 일정 여부
  isWeekly?: boolean; // 주간 고정 일정 여부
};

export default function CalendarScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [viewMode, setViewMode] = React.useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddEventModal, setShowAddEventModal] = React.useState(false);
  const [showAddWeeklyModal, setShowAddWeeklyModal] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<CalendarEvent | null>(null);

  // 일정 추가/수정 폼 상태
  const [eventTitle, setEventTitle] = React.useState("");
  const [startDate, setStartDate] = React.useState(new Date());
  const [endDate, setEndDate] = React.useState(new Date());
  const [startTime, setStartTime] = React.useState(new Date());
  const [endTime, setEndTime] = React.useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = React.useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = React.useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = React.useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // 주간 고정 일정 폼 상태
  const [weeklyTitle, setWeeklyTitle] = React.useState("");
  const [selectedDays, setSelectedDays] = React.useState<number[]>([]);
  const [weeklyStartTime, setWeeklyStartTime] = React.useState(new Date());
  const [weeklyEndTime, setWeeklyEndTime] = React.useState(new Date());
  const [showWeeklyStartTimePicker, setShowWeeklyStartTimePicker] = React.useState(false);
  const [showWeeklyEndTimePicker, setShowWeeklyEndTimePicker] = React.useState(false);
  const [savingWeekly, setSavingWeekly] = React.useState(false);
  const [weeklyError, setWeeklyError] = React.useState("");
  const [weeklyColor, setWeeklyColor] = React.useState("#4A90E2");
  const [editingWeeklyEvent, setEditingWeeklyEvent] =
    React.useState<CalendarEvent | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadEvents();
      }
    }, [user, currentDate])
  );

  const loadEvents = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const eventsData: CalendarEvent[] = [];

      // 사용자가 참여한 모임들 가져오기
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      const joinedGroupIds = userData?.joinedGroups || [];

      // 모임 데이터 가져오기
      for (const groupId of joinedGroupIds) {
        try {
          const groupDoc = await getDoc(doc(db, "groups", groupId));
          if (groupDoc.exists()) {
            const groupData = groupDoc.data() as Group;
            if (
              groupData.schedule?.daysOfWeek &&
              groupData.schedule.daysOfWeek.length > 0
            ) {
              // 각 요일에 대해 이벤트 생성
              groupData.schedule.daysOfWeek.forEach((dayOfWeek) => {
                eventsData.push({
                  groupId: groupDoc.id,
                  groupName: groupData.name,
                  dayOfWeek,
                  startTime: groupData.schedule?.startTime || "",
                  endTime: groupData.schedule?.endTime || "",
                  color: groupData.color || "#4A90E2",
                  isPersonal: false,
                });
              });
            }
          }
        } catch (error) {
          // 에러 무시
        }
      }

      // 개인 일정 가져오기
      try {
        const personalEventsQuery = query(
          collection(db, "personalEvents"),
          where("userId", "==", user.uid)
        );
        const personalEventsSnapshot = await getDocs(personalEventsQuery);
        personalEventsSnapshot.forEach((doc) => {
          const data = doc.data();
          const startDateObj = data.startDate?.toDate() || new Date();
          const endDateObj = data.endDate?.toDate() || new Date();
          eventsData.push({
            id: doc.id,
            groupName: data.title,
            dayOfWeek: startDateObj.getDay(),
            startDate: startDateObj,
            endDate: endDateObj,
            startTime: data.startTime || "",
            endTime: data.endTime || "",
            color: data.color || "#4A90E2",
            isPersonal: true,
          });
        });
      } catch (error) {
        // 에러 무시
      }

      // 주간 고정 일정 가져오기
      try {
        const weeklyEventsQuery = query(
          collection(db, "weeklyEvents"),
          where("userId", "==", user.uid)
        );
        const weeklyEventsSnapshot = await getDocs(weeklyEventsQuery);
        weeklyEventsSnapshot.forEach((doc) => {
          const data = doc.data();
          const daysOfWeek = data.daysOfWeek || [];
          // 각 요일에 대해 이벤트 생성
          daysOfWeek.forEach((dayOfWeek: number) => {
            eventsData.push({
              id: doc.id,
              groupName: data.title,
              dayOfWeek,
              daysOfWeek,
              startTime: data.startTime || "",
              endTime: data.endTime || "",
              color: data.color || "#4A90E2",
              isWeekly: true,
              isPersonal: false,
            });
          });
        });
      } catch (error) {
        // 에러 무시
      }

      setEvents(eventsData);
    } catch (error) {
      // 에러 무시
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];
    // 빈 칸 추가 (첫 날 이전)
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // 날짜 추가
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const getEventsForDay = (dayOfWeek: number) => {
    return events.filter((event) => {
      // 모든 일정은 dayOfWeek로 필터링 (주간 고정 일정은 이미 각 요일마다 별도 이벤트로 생성됨)
      return event.dayOfWeek === dayOfWeek;
    });
  };

  // 시간 문자열을 분 단위로 변환하는 헬퍼 함수
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || timeStr.trim() === "") {
      return 24 * 60; // 시간이 없으면 맨 뒤로 정렬
    }
    const [hours, minutes] = timeStr.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      return 24 * 60; // 잘못된 시간이면 맨 뒤로 정렬
    }
    return hours * 60 + minutes;
  };

  const getEventsForSelectedDate = (date: Date): CalendarEvent[] => {
    const dayOfWeek = date.getDay();
    const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

    const filteredEvents = events.filter((event) => {
      // 개인 일정인 경우 (주간 고정 일정 제외)
      if (
        event.isPersonal === true &&
        event.isWeekly !== true &&
        event.startDate &&
        event.endDate
      ) {
        // 날짜 범위 확인
        const startStr = `${event.startDate.getFullYear()}-${
          event.startDate.getMonth() + 1
        }-${event.startDate.getDate()}`;
        const endStr = `${event.endDate.getFullYear()}-${
          event.endDate.getMonth() + 1
        }-${event.endDate.getDate()}`;
        return dateStr >= startStr && dateStr <= endStr;
      }
      // 주간 고정 일정인 경우 (loadEvents에서 이미 각 요일마다 별도 이벤트로 생성됨)
      if (event.isWeekly === true) {
        return event.dayOfWeek === dayOfWeek;
      }
      // 그룹 일정인 경우 (isPersonal이 false이거나 undefined)
      if (event.isPersonal === false || event.isPersonal === undefined) {
        // 요일 확인
        return event.dayOfWeek === dayOfWeek;
      }
      return false;
    });

    // 시작 시간 기준으로 정렬 (빠른 시간이 위로)
    return filteredEvents.sort((a, b) => {
      const aMinutes = timeToMinutes(a.startTime);
      const bMinutes = timeToMinutes(b.startTime);
      return aMinutes - bMinutes;
    });
  };

  const handleStartDateChange = (selectedDate: Date) => {
    setStartDate(selectedDate);
    // 마침일정을 시작일정과 동일하게 설정
    setEndDate(new Date(selectedDate));
    if (Platform.OS === "android") {
      setShowStartDatePicker(false);
    }
  };

  const handleSaveEvent = async () => {
    if (!user || !eventTitle.trim()) {
      return;
    }

    setSaving(true);
    try {
      const startTimeStr = `${startTime
        .getHours()
        .toString()
        .padStart(2, "0")}:${startTime.getMinutes().toString().padStart(2, "0")}`;
      const endTimeStr = `${endTime.getHours().toString().padStart(2, "0")}:${endTime
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;

      if (editingEvent && editingEvent.id) {
        // 수정
        await updateDoc(doc(db, "personalEvents", editingEvent.id), {
          title: eventTitle,
          startDate: startDate,
          endDate: endDate,
          startTime: startTimeStr,
          endTime: endTimeStr,
        });
      } else {
        // 추가
        await addDoc(collection(db, "personalEvents"), {
          userId: user.uid,
          title: eventTitle,
          startDate: startDate,
          endDate: endDate,
          startTime: startTimeStr,
          endTime: endTimeStr,
          color: "#4A90E2",
          createdAt: new Date(),
        });
      }

      // 폼 초기화
      setEventTitle("");
      setStartDate(new Date());
      setEndDate(new Date());
      setStartTime(new Date());
      setEndTime(new Date());
      setEditingEvent(null);
      setShowAddEventModal(false);

      // 일정 다시 불러오기
      await loadEvents();
    } catch (error) {
      // 에러 무시
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!user) return;

    try {
      await deleteDoc(doc(db, "personalEvents", eventId));
      await loadEvents();
    } catch (error) {
      // 에러 무시
    }
  };

  const handleSaveWeeklyEvent = async () => {
    // 에러 메시지 초기화
    setWeeklyError("");

    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

    // 기본 유효성 검사
    if (!user) {
      setWeeklyError("로그인이 필요합니다.");
      return;
    }

    if (!weeklyTitle.trim()) {
      setWeeklyError("일정 제목을 입력해주세요.");
      return;
    }

    if (selectedDays.length === 0) {
      setWeeklyError("최소 하나 이상의 요일을 선택해주세요.");
      return;
    }

    // 시간 유효성 검사
    const startHours = weeklyStartTime.getHours();
    const startMinutes = weeklyStartTime.getMinutes();
    const endHours = weeklyEndTime.getHours();
    const endMinutes = weeklyEndTime.getMinutes();

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    // 시작 시간이 종료 시간보다 늦거나 같은 경우
    if (startTotalMinutes >= endTotalMinutes) {
      setWeeklyError("시작 시간은 종료 시간보다 이전이어야 합니다.");
      return;
    }

    // 시간이 같은 경우 (시작 시간과 종료 시간이 동일)
    if (startTotalMinutes === endTotalMinutes) {
      setWeeklyError("시작 시간과 종료 시간이 같을 수 없습니다.");
      return;
    }

    // 시간 겹침 검사
    const startTimeStr = `${startHours.toString().padStart(2, "0")}:${startMinutes
      .toString()
      .padStart(2, "0")}`;
    const endTimeStr = `${endHours.toString().padStart(2, "0")}:${endMinutes
      .toString()
      .padStart(2, "0")}`;

    // 시간 문자열을 분 단위로 변환하는 헬퍼 함수
    const timeToMinutes = (timeStr: string): number => {
      if (!timeStr || timeStr.trim() === "") {
        return 0;
      }
      const [hours, minutes] = timeStr.split(":").map(Number);
      if (isNaN(hours) || isNaN(minutes)) {
        return 0;
      }
      return hours * 60 + minutes;
    };

    // 선택된 요일들에 대해 기존 일정과 시간 겹침 확인
    for (const dayOfWeek of selectedDays) {
      // 해당 요일의 기존 일정들 가져오기
      const dayEvents = events.filter((event) => {
        // 수정 중인 일정은 제외
        if (editingWeeklyEvent && event.id === editingWeeklyEvent.id) {
          return false;
        }

        // 그룹 일정 (모임에서 정한 일정)
        if (event.isPersonal === false || event.isPersonal === undefined) {
          return event.dayOfWeek === dayOfWeek;
        }

        // 주간 고정 일정 (자신이 추가한 일정)
        if (event.isWeekly === true) {
          return event.daysOfWeek?.includes(dayOfWeek) || event.dayOfWeek === dayOfWeek;
        }

        return false;
      });

      // 각 기존 일정과 시간 겹침 확인
      for (const existingEvent of dayEvents) {
        const existingStartMinutes = timeToMinutes(existingEvent.startTime);
        const existingEndMinutes = timeToMinutes(existingEvent.endTime);

        // 시간이 겹치는 경우: 새 일정의 시작 시간이 기존 일정의 종료 시간보다 이전이고,
        // 새 일정의 종료 시간이 기존 일정의 시작 시간보다 이후인 경우
        if (
          startTotalMinutes < existingEndMinutes &&
          endTotalMinutes > existingStartMinutes
        ) {
          const eventName = existingEvent.groupName || "기존 일정";
          setWeeklyError(
            `${dayNames[dayOfWeek]}요일에 "${eventName}" 일정과 시간이 겹칩니다.`
          );
          return;
        }
      }
    }

    setSavingWeekly(true);
    try {
      if (editingWeeklyEvent && editingWeeklyEvent.id) {
        // 수정
        await updateDoc(doc(db, "weeklyEvents", editingWeeklyEvent.id), {
          title: weeklyTitle,
          daysOfWeek: selectedDays.sort(),
          startTime: startTimeStr,
          endTime: endTimeStr,
          color: weeklyColor,
        });
      } else {
        // 추가
        await addDoc(collection(db, "weeklyEvents"), {
          userId: user.uid,
          title: weeklyTitle,
          daysOfWeek: selectedDays.sort(),
          startTime: startTimeStr,
          endTime: endTimeStr,
          color: weeklyColor,
          createdAt: new Date(),
        });
      }

      // 폼 초기화
      setWeeklyTitle("");
      setSelectedDays([]);
      setWeeklyStartTime(new Date());
      setWeeklyEndTime(new Date());
      setWeeklyColor("#4A90E2");
      setWeeklyError("");
      setEditingWeeklyEvent(null);
      setShowAddWeeklyModal(false);

      // 일정 다시 불러오기
      await loadEvents();
    } catch (error) {
      setWeeklyError("일정 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingWeekly(false);
    }
  };

  const toggleDaySelection = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleEditWeeklyEvent = (event: CalendarEvent) => {
    if (!event.id || !event.isWeekly) return;

    // 주간일정의 원본 데이터 찾기 (같은 id를 가진 첫 번째 이벤트)
    const weeklyEvent = events.find((e) => e.id === event.id && e.isWeekly);
    if (!weeklyEvent) return;

    setEditingWeeklyEvent(weeklyEvent);
    setWeeklyTitle(weeklyEvent.groupName);
    setSelectedDays(weeklyEvent.daysOfWeek || []);
    setWeeklyColor(weeklyEvent.color || "#4A90E2");

    // 시간 설정
    if (weeklyEvent.startTime) {
      const [hours, minutes] = weeklyEvent.startTime.split(":").map(Number);
      const startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);
      setWeeklyStartTime(startDate);
    }

    if (weeklyEvent.endTime) {
      const [hours, minutes] = weeklyEvent.endTime.split(":").map(Number);
      const endDate = new Date();
      endDate.setHours(hours, minutes, 0, 0);
      setWeeklyEndTime(endDate);
    }

    setShowAddWeeklyModal(true);
  };

  const handleDeleteWeeklyEvent = async (eventId: string) => {
    if (!user) return;

    try {
      await deleteDoc(doc(db, "weeklyEvents", eventId));
      await loadEvents();
    } catch (error) {
      // 에러 무시
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    if (!event.isPersonal || !event.startDate || !event.endDate) return;

    setEditingEvent(event);
    setEventTitle(event.groupName);
    setStartDate(event.startDate);
    setEndDate(event.endDate);

    // 시간 문자열을 Date 객체로 변환
    const [startHour, startMinute] = event.startTime.split(":").map(Number);
    const [endHour, endMinute] = event.endTime.split(":").map(Number);
    const startTimeDate = new Date();
    startTimeDate.setHours(startHour, startMinute);
    const endTimeDate = new Date();
    endTimeDate.setHours(endHour, endMinute);

    setStartTime(startTimeDate);
    setEndTime(endTimeDate);
    setShowAddEventModal(true);
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (direction === "prev") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const formatMonthYear = (date: Date) => {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  };

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header />

      {/* 뷰 모드 선택 */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[
            styles.viewModeButton,
            viewMode === "month" && styles.viewModeButtonActive,
          ]}
          onPress={() => setViewMode("month")}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={viewMode === "month" ? "#fff" : "#666"}
          />
          <Text
            style={[
              styles.viewModeText,
              viewMode === "month" && styles.viewModeTextActive,
            ]}
          >
            월간
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.viewModeButton,
            viewMode === "week" && styles.viewModeButtonActive,
          ]}
          onPress={() => setViewMode("week")}
        >
          <Ionicons
            name="calendar-number-outline"
            size={20}
            color={viewMode === "week" ? "#fff" : "#666"}
          />
          <Text
            style={[
              styles.viewModeText,
              viewMode === "week" && styles.viewModeTextActive,
            ]}
          >
            주간
          </Text>
        </TouchableOpacity>
      </View>

      {/* 네비게이션 및 날짜 표시 */}
      {viewMode === "month" && (
        <View style={styles.navigationContainer}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateMonth("prev")}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatMonthYear(currentDate)}</Text>
          <View style={styles.navRightContainer}>
            <TouchableOpacity
              style={styles.addButtonSmall}
              onPress={() => {
                setEditingEvent(null);
                setEventTitle("");
                setStartDate(new Date());
                setEndDate(new Date());
                setStartTime(new Date());
                setEndTime(new Date());
                setShowAddEventModal(true);
              }}
            >
              <Ionicons name="add" size={20} color="#4A90E2" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateMonth("next")}
            >
              <Ionicons name="chevron-forward" size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      {viewMode === "week" && (
        <View style={styles.navigationContainer}>
          <Text style={styles.dateText}>주간 뷰</Text>
          <TouchableOpacity
            style={styles.addButtonSmall}
            onPress={() => {
              setEditingWeeklyEvent(null);
              setWeeklyTitle("");
              setSelectedDays([]);
              setWeeklyStartTime(new Date());
              setWeeklyEndTime(new Date());
              setWeeklyColor("#4A90E2");
              setWeeklyError("");
              setShowAddWeeklyModal(true);
            }}
          >
            <Ionicons name="add" size={20} color="#4A90E2" />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : viewMode === "month" ? (
        <MonthView
          currentDate={currentDate}
          events={events}
          getEventsForDay={getEventsForDay}
          getDaysInMonth={getDaysInMonth}
          getEventsForSelectedDate={getEventsForSelectedDate}
          handleEditEvent={handleEditEvent}
          handleDeleteEvent={handleDeleteEvent}
          handleEditWeeklyEvent={handleEditWeeklyEvent}
          handleDeleteWeeklyEvent={handleDeleteWeeklyEvent}
        />
      ) : (
        <WeekView
          events={events}
          getEventsForDay={getEventsForDay}
          getEventsForSelectedDate={getEventsForSelectedDate}
          currentDate={currentDate}
          handleEditWeeklyEvent={handleEditWeeklyEvent}
          handleDeleteWeeklyEvent={handleDeleteWeeklyEvent}
        />
      )}

      {/* 일정 추가 모달 */}
      <Modal
        visible={showAddEventModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddEventModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingEvent ? "일정 수정" : "일정 추가"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddEventModal(false);
                  setEditingEvent(null);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* 제목 */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>제목</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="일정 제목을 입력하세요"
                  value={eventTitle}
                  onChangeText={setEventTitle}
                />
              </View>

              {/* 시작일정 */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>시작일정</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Text style={styles.dateTimeText}>
                    {startDate.toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* 시작시간 */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>시작시간</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Text style={styles.dateTimeText}>
                    {startTime.toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Ionicons name="time-outline" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* 마침일정 */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>마침일정</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={styles.dateTimeText}>
                    {endDate.toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* 마침시간 */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>마침시간</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Text style={styles.dateTimeText}>
                    {endTime.toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Ionicons name="time-outline" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveEvent}
                disabled={saving || !eventTitle.trim()}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingEvent ? "수정" : "저장"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* 날짜/시간 피커 (iOS는 모달 안에 표시) */}
            {Platform.OS === "ios" && (
              <>
                {showStartDatePicker && (
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={startDate}
                      mode="date"
                      display="spinner"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          handleStartDateChange(selectedDate);
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={styles.pickerConfirmButton}
                      onPress={() => setShowStartDatePicker(false)}
                    >
                      <Text style={styles.pickerConfirmText}>확인</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {showEndDatePicker && (
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={endDate}
                      mode="date"
                      display="spinner"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setEndDate(selectedDate);
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={styles.pickerConfirmButton}
                      onPress={() => setShowEndDatePicker(false)}
                    >
                      <Text style={styles.pickerConfirmText}>확인</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {showStartTimePicker && (
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={startTime}
                      mode="time"
                      display="spinner"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setStartTime(selectedDate);
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={styles.pickerConfirmButton}
                      onPress={() => setShowStartTimePicker(false)}
                    >
                      <Text style={styles.pickerConfirmText}>확인</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {showEndTimePicker && (
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={endTime}
                      mode="time"
                      display="spinner"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setEndTime(selectedDate);
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={styles.pickerConfirmButton}
                      onPress={() => setShowEndTimePicker(false)}
                    >
                      <Text style={styles.pickerConfirmText}>확인</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>

        {/* 날짜/시간 피커 (Android는 모달 밖에 표시) */}
        {Platform.OS === "android" && (
          <>
            {showStartDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowStartDatePicker(false);
                  if (selectedDate) {
                    handleStartDateChange(selectedDate);
                  }
                }}
              />
            )}
            {showEndDatePicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowEndDatePicker(false);
                  if (selectedDate) {
                    setEndDate(selectedDate);
                  }
                }}
              />
            )}
            {showStartTimePicker && (
              <DateTimePicker
                value={startTime}
                mode="time"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowStartTimePicker(false);
                  if (selectedDate) {
                    setStartTime(selectedDate);
                  }
                }}
              />
            )}
            {showEndTimePicker && (
              <DateTimePicker
                value={endTime}
                mode="time"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowEndTimePicker(false);
                  if (selectedDate) {
                    setEndTime(selectedDate);
                  }
                }}
              />
            )}
          </>
        )}
      </Modal>

      {/* 주간 고정 일정 추가 모달 */}
      <Modal
        visible={showAddWeeklyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowAddWeeklyModal(false);
          setWeeklyError("");
          setEditingWeeklyEvent(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingWeeklyEvent ? "주간 고정 일정 수정" : "주간 고정 일정 추가"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddWeeklyModal(false);
                  setWeeklyError("");
                  setEditingWeeklyEvent(null);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* 제목 */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>제목</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="일정 제목을 입력하세요"
                  value={weeklyTitle}
                  onChangeText={setWeeklyTitle}
                />
              </View>

              {/* 요일 선택 */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>요일 선택</Text>
                <View style={styles.daySelectionContainer}>
                  {dayNames.map((dayName, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dayButton,
                        selectedDays.includes(index) && styles.dayButtonSelected,
                      ]}
                      onPress={() => toggleDaySelection(index)}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          selectedDays.includes(index) && styles.dayButtonTextSelected,
                        ]}
                      >
                        {dayName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 시작시간 */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>시작시간</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowWeeklyStartTimePicker(true)}
                >
                  <Text style={styles.dateTimeText}>
                    {weeklyStartTime.toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Ionicons name="time-outline" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* 마침시간 */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>마침시간</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowWeeklyEndTimePicker(true)}
                >
                  <Text style={styles.dateTimeText}>
                    {weeklyEndTime.toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Ionicons name="time-outline" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* 색상 선택 */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>색상</Text>
                <View style={styles.colorSelectionContainer}>
                  {[
                    "#4A90E2",
                    "#FF6B6B",
                    "#4ECDC4",
                    "#45B7D1",
                    "#FFA07A",
                    "#98D8C8",
                    "#F7DC6F",
                    "#BB8FCE",
                    "#85C1E2",
                    "#F8B88B",
                    "#82E0AA",
                    "#F1948A",
                    "#5DADE2",
                    "#AED6F1",
                    "#A9DFBF",
                    "#F9E79F",
                  ].map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        weeklyColor === color && styles.colorOptionSelected,
                      ]}
                      onPress={() => setWeeklyColor(color)}
                    >
                      {weeklyColor === color && (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 에러 메시지 */}
              {weeklyError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={16} color="#FF6B6B" />
                  <Text style={styles.errorText}>{weeklyError}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (savingWeekly || !weeklyTitle.trim() || selectedDays.length === 0) &&
                    styles.saveButtonDisabled,
                ]}
                onPress={handleSaveWeeklyEvent}
                disabled={
                  savingWeekly || !weeklyTitle.trim() || selectedDays.length === 0
                }
              >
                {savingWeekly ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>저장</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* 시간 피커 (iOS는 모달 안에 표시) */}
            {Platform.OS === "ios" && (
              <>
                {showWeeklyStartTimePicker && (
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={weeklyStartTime}
                      mode="time"
                      display="spinner"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setWeeklyStartTime(selectedDate);
                          setWeeklyError("");
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={styles.pickerConfirmButton}
                      onPress={() => setShowWeeklyStartTimePicker(false)}
                    >
                      <Text style={styles.pickerConfirmText}>확인</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {showWeeklyEndTimePicker && (
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={weeklyEndTime}
                      mode="time"
                      display="spinner"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setWeeklyEndTime(selectedDate);
                          setWeeklyError("");
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={styles.pickerConfirmButton}
                      onPress={() => setShowWeeklyEndTimePicker(false)}
                    >
                      <Text style={styles.pickerConfirmText}>확인</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>

        {/* 시간 피커 (Android는 모달 밖에 표시) */}
        {Platform.OS === "android" && (
          <>
            {showWeeklyStartTimePicker && (
              <DateTimePicker
                value={weeklyStartTime}
                mode="time"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowWeeklyStartTimePicker(false);
                  if (selectedDate) {
                    setWeeklyStartTime(selectedDate);
                    setWeeklyError("");
                  }
                }}
              />
            )}
            {showWeeklyEndTimePicker && (
              <DateTimePicker
                value={weeklyEndTime}
                mode="time"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowWeeklyEndTimePicker(false);
                  if (selectedDate) {
                    setWeeklyEndTime(selectedDate);
                    setWeeklyError("");
                  }
                }}
              />
            )}
          </>
        )}
      </Modal>
    </SafeAreaView>
  );
}

// 월간 뷰 컴포넌트
function MonthView({
  currentDate,
  events,
  getEventsForDay,
  getDaysInMonth,
  getEventsForSelectedDate,
  handleEditEvent,
  handleDeleteEvent,
  handleEditWeeklyEvent,
  handleDeleteWeeklyEvent,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  getEventsForDay: (dayOfWeek: number) => CalendarEvent[];
  getDaysInMonth: (date: Date) => (number | null)[];
  getEventsForSelectedDate: (date: Date) => CalendarEvent[];
  handleEditEvent: (event: CalendarEvent) => void;
  handleDeleteEvent: (eventId: string) => void;
  handleEditWeeklyEvent: (event: CalendarEvent) => void;
  handleDeleteWeeklyEvent: (eventId: string) => void;
}) {
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const days = getDaysInMonth(currentDate);
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <ScrollView style={styles.calendarContainer} showsVerticalScrollIndicator={false}>
      {/* 요일 헤더 */}
      <View style={styles.dayHeader}>
        {dayNames.map((day, index) => (
          <View key={index} style={styles.dayHeaderCell}>
            <Text
              style={[
                styles.dayHeaderText,
                (index === 0 || index === 6) && styles.dayHeaderTextWeekend,
              ]}
            >
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* 캘린더 그리드 */}
      <View style={styles.calendarGrid}>
        {days.map((day, index) => {
          if (day === null) {
            return <View key={index} style={styles.calendarCell} />;
          }

          const cellDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            day
          );
          const dayOfWeek = cellDate.getDay();
          // 모든 일정 가져오기 (그룹 일정, 주간 고정 일정, 개인 일정)
          const dateEvents = getEventsForSelectedDate(cellDate);
          const displayEvents = dateEvents;

          const isToday =
            day === new Date().getDate() &&
            currentDate.getMonth() === new Date().getMonth() &&
            currentDate.getFullYear() === new Date().getFullYear();

          const isSelected =
            selectedDate &&
            selectedDate.getDate() === day &&
            selectedDate.getMonth() === currentDate.getMonth() &&
            selectedDate.getFullYear() === currentDate.getFullYear();

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.calendarCell,
                isToday && styles.calendarCellToday,
                (dayOfWeek === 0 || dayOfWeek === 6) && styles.calendarCellWeekend,
                isSelected && styles.calendarCellSelected,
              ]}
              onPress={() => setSelectedDate(cellDate)}
            >
              <Text
                style={[
                  styles.calendarDayText,
                  isToday && styles.calendarDayTextToday,
                  (dayOfWeek === 0 || dayOfWeek === 6) && styles.calendarDayTextWeekend,
                  isSelected && styles.calendarDayTextSelected,
                ]}
              >
                {day}
              </Text>
              {displayEvents.length > 0 && (
                <View style={styles.eventsContainer}>
                  {displayEvents.slice(0, 3).map((event, eventIndex) => (
                    <View
                      key={eventIndex}
                      style={[styles.eventBadge, { backgroundColor: event.color }]}
                    >
                      <Text
                        style={styles.eventBadgeText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {event.groupName}
                      </Text>
                    </View>
                  ))}
                  {displayEvents.length > 3 && (
                    <Text style={styles.eventMoreText}>+{displayEvents.length - 3}</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 선택된 날짜의 일정 표시 */}
      {selectedDate && (
        <View style={styles.selectedDateEventsContainer}>
          <View style={styles.selectedDateHeader}>
            <Text style={styles.selectedDateTitle}>
              {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 일정
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedDate(null)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          {getEventsForSelectedDate(selectedDate).length > 0 ? (
            getEventsForSelectedDate(selectedDate).map(
              (event: CalendarEvent, index: number) => {
                const eventDate =
                  event.isPersonal && event.startDate ? event.startDate : selectedDate;
                const dateStr = eventDate
                  ? `${eventDate.getMonth() + 1}/${eventDate.getDate()}`
                  : dayNames[event.dayOfWeek];

                return (
                  <View key={index} style={styles.eventItem}>
                    <View
                      style={[styles.eventColorBar, { backgroundColor: event.color }]}
                    />
                    <View style={styles.eventContent}>
                      <Text style={styles.eventGroupName}>{event.groupName}</Text>
                      <Text style={styles.eventTime}>
                        {dateStr} {event.startTime} - {event.endTime}
                      </Text>
                    </View>
                    {event.isPersonal && event.id && (
                      <View style={styles.eventActions}>
                        <TouchableOpacity
                          style={styles.eventActionButton}
                          onPress={() => handleEditEvent(event)}
                        >
                          <Ionicons name="create-outline" size={18} color="#4A90E2" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.eventActionButton}
                          onPress={() => {
                            if (event.id) {
                              handleDeleteEvent(event.id);
                            }
                          }}
                        >
                          <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }
            )
          ) : (
            <View style={styles.noEventsContainer}>
              <Text style={styles.noEventsText}>이 날짜에는 일정이 없습니다.</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// 주간 뷰 컴포넌트
function WeekView({
  events,
  getEventsForDay,
  getEventsForSelectedDate,
  currentDate,
  handleEditWeeklyEvent,
  handleDeleteWeeklyEvent,
}: {
  events: CalendarEvent[];
  getEventsForDay: (dayOfWeek: number) => CalendarEvent[];
  getEventsForSelectedDate: (date: Date) => CalendarEvent[];
  currentDate: Date;
  handleEditWeeklyEvent: (event: CalendarEvent) => void;
  handleDeleteWeeklyEvent: (eventId: string) => void;
}) {
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null);
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const hours = Array.from({ length: 24 }, (_, i) => i); // 0시부터 23시까지

  // 현재 주의 시작일(일요일) 계산
  const getWeekStartDate = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  const weekStart = getWeekStartDate(currentDate);

  // 시간 문자열을 분 단위로 변환 (예: "09:30" -> 570분)
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || timeStr.trim() === "") {
      return 0; // 기본값: 00:00
    }
    const [hours, minutes] = timeStr.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      return 0; // 기본값: 00:00
    }
    return hours * 60 + minutes;
  };

  // 분을 픽셀 위치로 변환 (1시간 = 40px)
  const minutesToTop = (minutes: number): number => {
    const startMinutes = 0; // 00:00 = 0분
    return ((minutes - startMinutes) / 60) * 40;
  };

  // 분을 높이로 변환
  const minutesToHeight = (startMinutes: number, endMinutes: number): number => {
    return ((endMinutes - startMinutes) / 60) * 40;
  };

  return (
    <ScrollView style={styles.weekContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.weekTimelineContainer}>
        {/* 시간대 표시 */}
        <View style={styles.timeColumn}>
          <View style={styles.timeColumnHeader} />
          {hours.map((hour) => (
            <View key={hour} style={styles.timeSlot}>
              <Text style={styles.timeText}>{hour}</Text>
            </View>
          ))}
        </View>

        {/* 요일별 컬럼 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.weekGrid}
        >
          {dayNames.map((dayName, dayIndex) => {
            const dayOfWeek = dayIndex;
            // 현재 주의 해당 날짜 계산
            const currentDayDate = new Date(weekStart);
            currentDayDate.setDate(weekStart.getDate() + dayIndex);
            // 그룹 일정과 주간 고정 일정은 요일로 필터링
            const allDayEvents = getEventsForDay(dayOfWeek);
            const groupAndWeeklyEvents = allDayEvents.filter(
              (e) =>
                e.isPersonal === false ||
                e.isPersonal === undefined ||
                e.isWeekly === true
            );
            // 개인 일정은 날짜로 필터링 (주간 고정 일정 제외)
            const personalEvents = getEventsForSelectedDate(currentDayDate).filter(
              (e) => e.isPersonal === true && e.isWeekly !== true
            );
            // 두 가지 일정 합치기
            const dayEvents = [...groupAndWeeklyEvents, ...personalEvents];

            return (
              <View
                key={dayIndex}
                style={[
                  styles.weekDayColumn,
                  (dayOfWeek === 0 || dayOfWeek === 6) && styles.weekDayColumnWeekend,
                ]}
              >
                <View style={styles.weekDayHeader}>
                  <Text
                    style={[
                      styles.weekDayName,
                      (dayOfWeek === 0 || dayOfWeek === 6) && styles.weekDayNameWeekend,
                    ]}
                  >
                    {dayName}
                  </Text>
                </View>
                <View style={styles.weekTimeline}>
                  {/* 시간대 구분선 */}
                  {hours.map((hour) => (
                    <View key={hour} style={styles.timeLine} />
                  ))}

                  {/* 일정 카드 */}
                  {dayEvents.map((event, eventIndex) => {
                    // 시간이 없거나 잘못된 경우 스킵
                    if (
                      !event.startTime ||
                      !event.endTime ||
                      event.startTime.trim() === "" ||
                      event.endTime.trim() === ""
                    ) {
                      return null;
                    }

                    const startMinutes = timeToMinutes(event.startTime);
                    const endMinutes = timeToMinutes(event.endTime);

                    // 화면 범위 상수
                    const screenStart = 0; // 00:00
                    const screenEnd = 24 * 60; // 24:00

                    // 시간이 유효하지 않은 경우 스킵
                    if (startMinutes >= endMinutes) {
                      return null;
                    }

                    // 화면 범위(00:00-24:00)와 겹치지 않으면 스킵
                    if (endMinutes <= screenStart || startMinutes >= screenEnd) {
                      return null;
                    }

                    // 화면 범위 내로 클리핑
                    const clippedStart = Math.max(startMinutes, screenStart);
                    const clippedEnd = Math.min(endMinutes, screenEnd);

                    const top = minutesToTop(clippedStart);
                    const height = Math.max(
                      minutesToHeight(clippedStart, clippedEnd),
                      20
                    );

                    // top이 음수이거나 타임라인 높이를 넘어가는 경우 조정
                    const adjustedTop = Math.max(0, Math.min(top, 960 - height));

                    return (
                      <TouchableOpacity
                        key={`${event.id || eventIndex}-${dayOfWeek}-${eventIndex}`}
                        style={[
                          styles.weekEventCard,
                          {
                            backgroundColor: event.color || "#4A90E2",
                            top: adjustedTop,
                            height: height,
                            zIndex: 10,
                          },
                        ]}
                        onPress={() => {
                          // 모든 일정에 대해 모달 표시
                          setSelectedEvent(event);
                        }}
                      >
                        <Text style={styles.weekEventName} numberOfLines={2}>
                          {event.groupName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* 주간일정 상세 모달 */}
      <Modal
        visible={selectedEvent !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedEvent && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {selectedEvent.isWeekly
                      ? "주간 고정 일정"
                      : selectedEvent.isPersonal
                      ? "개인 일정"
                      : "모임 일정"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSelectedEvent(null)}
                    style={styles.modalCloseButton}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.eventDetailContainer}>
                    <View
                      style={[
                        styles.eventDetailColorBar,
                        { backgroundColor: selectedEvent.color },
                      ]}
                    />
                    <View style={styles.eventDetailContent}>
                      <Text style={styles.eventDetailTitle}>
                        {selectedEvent.groupName}
                      </Text>
                      <View style={styles.eventDetailInfo}>
                        <Ionicons name="time-outline" size={16} color="#666" />
                        <Text style={styles.eventDetailText}>
                          {selectedEvent.startTime} - {selectedEvent.endTime}
                        </Text>
                      </View>
                      {selectedEvent.isWeekly && selectedEvent.daysOfWeek && (
                        <View style={styles.eventDetailInfo}>
                          <Ionicons name="calendar-outline" size={16} color="#666" />
                          <Text style={styles.eventDetailText}>
                            {selectedEvent.daysOfWeek
                              .map((day) => dayNames[day])
                              .join(", ")}
                          </Text>
                        </View>
                      )}
                      {selectedEvent.isPersonal && selectedEvent.startDate && (
                        <View style={styles.eventDetailInfo}>
                          <Ionicons name="calendar-outline" size={16} color="#666" />
                          <Text style={styles.eventDetailText}>
                            {selectedEvent.startDate.getMonth() + 1}월{" "}
                            {selectedEvent.startDate.getDate()}일
                            {selectedEvent.endDate &&
                            selectedEvent.endDate.getTime() !==
                              selectedEvent.startDate.getTime()
                              ? ` - ${
                                  selectedEvent.endDate.getMonth() + 1
                                }월 ${selectedEvent.endDate.getDate()}일`
                              : ""}
                          </Text>
                        </View>
                      )}
                      {!selectedEvent.isPersonal &&
                        !selectedEvent.isWeekly &&
                        selectedEvent.dayOfWeek !== undefined && (
                          <View style={styles.eventDetailInfo}>
                            <Ionicons name="calendar-outline" size={16} color="#666" />
                            <Text style={styles.eventDetailText}>
                              {dayNames[selectedEvent.dayOfWeek]}요일
                            </Text>
                          </View>
                        )}
                    </View>
                  </View>

                  {/* 주간 고정 일정만 수정/삭제 버튼 표시 */}
                  {selectedEvent.isWeekly && selectedEvent.id && (
                    <View style={styles.eventDetailActions}>
                      <TouchableOpacity
                        style={[styles.eventDetailButton, styles.editButton]}
                        onPress={() => {
                          setSelectedEvent(null);
                          handleEditWeeklyEvent(selectedEvent);
                        }}
                      >
                        <Ionicons name="create-outline" size={20} color="#fff" />
                        <Text style={styles.eventDetailButtonText}>수정</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.eventDetailButton, styles.deleteButton]}
                        onPress={() => {
                          if (selectedEvent.id) {
                            handleDeleteWeeklyEvent(selectedEvent.id);
                            setSelectedEvent(null);
                          }
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color="#fff" />
                        <Text style={styles.eventDetailButtonText}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  viewModeContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  viewModeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    gap: 6,
  },
  viewModeButtonActive: {
    backgroundColor: "#4A90E2",
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  viewModeTextActive: {
    color: "#fff",
  },
  navigationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  navRightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navButton: {
    padding: 4,
  },
  addButtonSmall: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#E6F4FE",
  },
  dateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  calendarContainer: {
    flex: 1,
  },
  dayHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  dayHeaderCell: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  dayHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  dayHeaderTextWeekend: {
    color: "#FF6B6B",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.28%",
    minHeight: 80,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E0E0E0",
    padding: 8,
    backgroundColor: "#fff",
  },
  calendarCellToday: {
    backgroundColor: "#E6F4FE",
  },
  calendarCellWeekend: {
    backgroundColor: "#FAFAFA",
  },
  calendarCellSelected: {
    backgroundColor: "#E6F4FE",
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  calendarDayTextToday: {
    color: "#4A90E2",
    fontWeight: "700",
  },
  calendarDayTextWeekend: {
    color: "#FF6B6B",
  },
  calendarDayTextSelected: {
    color: "#4A90E2",
    fontWeight: "700",
  },
  eventsContainer: {
    flexDirection: "column",
    gap: 2,
    marginTop: 2,
  },
  eventBadge: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    overflow: "hidden",
  },
  eventBadgeText: {
    fontSize: 9,
    fontWeight: "500",
    color: "#333",
    lineHeight: 12,
  },
  eventMoreText: {
    fontSize: 8,
    color: "#999",
    marginTop: 2,
  },
  eventsListContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  eventsListTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  eventItem: {
    flexDirection: "row",
    backgroundColor: "#F9F9F9",
    borderRadius: 8,
    marginBottom: 8,
    overflow: "hidden",
    alignItems: "center",
  },
  eventColorBar: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: 12,
  },
  eventActions: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 12,
  },
  eventActionButton: {
    padding: 4,
  },
  eventGroupName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 13,
    color: "#666",
  },
  weekContainer: {
    flex: 1,
  },
  weekTimelineContainer: {
    flexDirection: "row",
    flex: 1,
  },
  timeColumn: {
    width: 40,
    borderRightWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FAFAFA",
  },
  timeColumnHeader: {
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  timeSlot: {
    height: 40,
    justifyContent: "flex-start",
    paddingTop: 2,
    paddingRight: 4,
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  timeText: {
    fontSize: 11,
    color: "#666",
  },
  weekGrid: {
    flex: 1,
  },
  weekDayColumn: {
    width: 50,
    borderRightWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
  },
  weekDayColumnWeekend: {
    backgroundColor: "#FAFAFA",
  },
  weekDayHeader: {
    height: 36,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    backgroundColor: "#fff",
  },
  weekDayName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  weekDayNameWeekend: {
    color: "#FF6B6B",
  },
  weekTimeline: {
    position: "relative",
    height: 960, // 24시간 * 40px
  },
  timeLine: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  weekEventCard: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: 0,
    paddingVertical: 2,
    paddingHorizontal: 4,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
    minHeight: 20,
  },
  weekEventName: {
    fontSize: 10,
    fontWeight: "500",
    color: "#fff",
    lineHeight: 12,
  },
  selectedDateEventsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    backgroundColor: "#fff",
  },
  selectedDateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  selectedDateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  closeButton: {
    padding: 4,
  },
  noEventsContainer: {
    padding: 20,
    alignItems: "center",
  },
  noEventsText: {
    fontSize: 14,
    color: "#999",
  },
  addButton: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4A90E2",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fff",
  },
  dateTimeButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  dateTimeText: {
    fontSize: 16,
    color: "#333",
  },
  saveButton: {
    backgroundColor: "#4A90E2",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  pickerContainer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    paddingVertical: 12,
  },
  pickerConfirmButton: {
    padding: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  pickerConfirmText: {
    color: "#4A90E2",
    fontSize: 16,
    fontWeight: "600",
  },
  daySelectionContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  dayButton: {
    width: 45,
    height: 45,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  dayButtonSelected: {
    backgroundColor: "#4A90E2",
    borderColor: "#4A90E2",
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  dayButtonTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FFE0E0",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#FF6B6B",
    fontWeight: "500",
  },
  colorSelectionContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  colorOptionSelected: {
    borderColor: "#333",
    borderWidth: 3,
  },
  eventDetailContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  eventDetailColorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  eventDetailContent: {
    flex: 1,
  },
  eventDetailTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  eventDetailInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  eventDetailText: {
    fontSize: 14,
    color: "#666",
  },
  eventDetailActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  eventDetailButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  editButton: {
    backgroundColor: "#4A90E2",
  },
  deleteButton: {
    backgroundColor: "#FF6B6B",
  },
  eventDetailButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
