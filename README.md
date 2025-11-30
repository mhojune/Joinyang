# JoinYang

모임 관리 및 일정 조율을 위한 크로스 플랫폼 모바일 앱입니다.

## 📱 앱 소개

JoinYang은 스터디 그룹과 취미 모임을 만들고 관리할 수 있는 통합 플랫폼입니다. 모임 생성부터 일정 관리, 실시간 소통까지 모든 기능을 한 곳에서 제공합니다.

## ✨ 주요 기능

### 모임 관리

- **모임 생성**: 이름, 설명, 유형(스터디/취미), 일정, 장소 설정
- **신청서 시스템**: 커스텀 질문으로 모임 가입 신청서 작성
- **모임 검색**: 이름 및 설명으로 모임 검색
- **모임 수정**: 모임장이 모임 정보 수정 가능

### 캘린더

- **월간/주간 뷰**: 두 가지 캘린더 뷰 제공
- **통합 일정 관리**:
  - 모임 일정 (참여 모임의 정기 일정)
  - 개인 일정 (기간 지정 일정)
  - 주간 고정 일정 (매주 반복 일정)
- **일정 충돌 검사**: 모임 가입 시 기존 일정과의 충돌 확인
- **색상 구분**: 모임 및 일정별 색상 지정

### 홈 화면

- **오늘 일정**: 오늘 예정된 모든 일정을 시간순으로 표시
- **내 모임**: 참여 중인 모임 목록 및 정보

### 모임 상세 기능

- **모임 정보**: 소개, 일정, 장소, 참여 방식 표시
- **멤버 관리**: 멤버 목록 확인 및 신청서 승인/거절 (모임장)
- **게시판**: 공지, 과제, 일반 게시글 작성 및 조회
- **실시간 채팅**: 모임 멤버 간 실시간 소통
- **시간 계산기**: 멤버들의 가능한 시간을 시각화하여 최적 일정 조율 (8명 이하 모임)

### 기타 기능

- **프로필 관리**: 사용자 정보 및 프로필 수정
- **권한 관리**: 모임장/멤버별 기능 접근 권한 제어

## 🛠 기술 스택

### 프론트엔드

- **React Native** 0.81.5 - 크로스 플랫폼 모바일 개발
- **Expo** 54 - 개발 및 빌드 도구
- **TypeScript** 5.9 - 타입 안정성
- **Expo Router** - 파일 기반 라우팅

### 백엔드

- **Firebase** 11
  - **Authentication** - 사용자 인증
  - **Firestore** - 모임, 게시글, 사용자 데이터 저장
  - **Realtime Database** - 실시간 채팅

### UI/UX

- **React Native Paper** - Material Design 컴포넌트
- **Ionicons** - 아이콘 라이브러리
- **React Navigation** - 네비게이션

## 🚀 시작하기

### 사전 요구사항

- Node.js 18 이상
- npm 또는 yarn
- Expo CLI (선택사항)

### 설치 및 실행

1. **의존성 설치**

   ```bash
   npm install
   ```

2. **환경 변수 설정**
   `.env.local` 파일을 생성하고 Firebase 설정을 추가하세요:

   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
   EXPO_PUBLIC_FIREBASE_DATABASE_URL=your_database_url
   ```

3. **앱 실행**

   ```bash
   npx expo start
   ```

4. **플랫폼 선택**
   - iOS 시뮬레이터: `i` 키
   - Android 에뮬레이터: `a` 키
   - 웹 브라우저: `w` 키
   - Expo Go 앱: QR 코드 스캔

## 📦 빌드 및 배포

### EAS Build 사용

```bash
# iOS 빌드
eas build --platform ios

# Android 빌드
eas build --platform android

# 환경 변수 업로드
.\setup-eas-secrets.ps1
```

자세한 배포 가이드는 `DEPLOYMENT.md`를 참고하세요.

## 📁 프로젝트 구조

```
joinyang/
├── app/                    # 앱 화면 (Expo Router)
│   ├── (tabs)/             # 탭 네비게이션
│   │   ├── index.tsx       # 홈 화면
│   │   ├── groups.tsx      # 모임 목록
│   │   └── calendar.tsx    # 캘린더
│   ├── group-detail.tsx    # 모임 상세
│   ├── group-board.tsx     # 게시판
│   ├── group-chat.tsx      # 채팅
│   ├── group-time-calculator.tsx  # 시간 계산기
│   └── ...
├── components/              # 재사용 컴포넌트
├── lib/                     # 유틸리티 및 설정
│   ├── firebase.ts         # Firebase 설정
│   └── auth-context.tsx    # 인증 컨텍스트
└── assets/                  # 이미지 및 리소스
```

## 🔐 주요 기능 상세

### 모임 생성

- 모임 유형 선택 (스터디/취미)
- 일정 설정 (요일, 시간) 또는 일정 없는 모임
- 신청서 필요 여부 및 커스텀 질문 작성
- 자동 색상 할당

### 캘린더 시스템

- **월간 뷰**: 달력 형식으로 일정 확인
- **주간 뷰**: 시간대별 타임라인으로 상세 일정 확인
- 일정 추가/수정/삭제
- 일정 충돌 자동 감지

### 시간 계산기

- 각 멤버의 가능한 시간 입력
- 시각적 타임라인으로 겹치는 시간 확인
- 색상 밀도로 가능한 인원 수 표시
- 최적 시간대 추천

## 📱 지원 플랫폼

- ✅ iOS
- ✅ Android
- ✅ Web

## 📄 라이선스

Private

## 👨‍💻 개발자

개발 및 유지보수: mhojune

---

**JoinYang**으로 더 효율적인 모임 관리와 일정 조율을 경험해보세요! 🎉
