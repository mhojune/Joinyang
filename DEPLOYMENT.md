# 앱 배포 가이드

이 문서는 joinyang 앱을 배포하는 방법을 안내합니다.

## 사전 준비

1. **Expo 계정 생성**

   - [expo.dev](https://expo.dev)에서 계정을 생성하세요.

2. **EAS CLI 설치**

   ```bash
   npm install -g eas-cli
   ```

3. **EAS 로그인**
   ```bash
   eas login
   ```

## APK 파일로 직접 배포 (권장)

### 1. EAS Build 설정

프로젝트 루트에서 다음 명령어를 실행하여 EAS Build를 설정합니다:

```bash
eas build:configure
```

이 명령어는 `eas.json` 파일을 생성합니다.

### 2. APK 파일 생성

다음 명령어로 APK 파일을 생성합니다:

```bash
eas build --platform android --profile preview
```

또는 프로덕션 빌드:

```bash
eas build --platform android --profile production
```

### 3. eas.json 설정 (APK 빌드용)

`eas.json` 파일을 생성하거나 수정하여 APK 빌드가 되도록 설정:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### 4. APK 파일 다운로드

빌드가 완료되면:

1. 빌드 완료 알림을 받거나 `eas build:list`로 상태 확인
2. 빌드 완료 후 제공되는 다운로드 링크로 APK 파일 다운로드
3. 또는 다음 명령어로 다운로드:

```bash
eas build:download
```

### 5. APK 파일 설치

생성된 APK 파일을 Android 기기에 설치:

1. **USB 연결 방식**

   ```bash
   adb install path/to/your-app.apk
   ```

2. **직접 설치 방식**
   - APK 파일을 Android 기기로 전송 (이메일, 클라우드 등)
   - 기기에서 "알 수 없는 소스" 설치 허용 설정
   - APK 파일을 탭하여 설치

## 스토어 배포 방법

### 1. Android 앱 배포 (Google Play Store)

1. **빌드 생성**

   ```bash
   eas build --platform android
   ```

2. **Google Play Console 설정**

   - [Google Play Console](https://play.google.com/console)에 개발자 계정 등록
   - 앱 서명 키 설정 (EAS가 자동으로 관리)

3. **앱 번들 업로드**
   - 빌드가 완료되면 Google Play Console에 APK/AAB 파일 업로드
   - 앱 정보, 스크린샷, 설명 등 입력
   - 검토 제출

### 3. iOS 앱 배포

#### App Store 배포

1. **Apple Developer 계정 필요**

   - [Apple Developer Program](https://developer.apple.com/programs/) 가입 (연간 $99)

2. **빌드 생성**

   ```bash
   eas build --platform ios
   ```

3. **App Store Connect 설정**

   - [App Store Connect](https://appstoreconnect.apple.com)에서 앱 등록
   - 앱 정보 입력

4. **앱 제출**
   ```bash
   eas submit --platform ios
   ```

#### TestFlight 배포

```bash
eas build --platform ios --profile preview
```

빌드 완료 후 App Store Connect에서 TestFlight로 배포할 수 있습니다.

### 4. 웹 배포

```bash
npx expo export:web
```

생성된 `web-build` 폴더를 원하는 호스팅 서비스에 배포할 수 있습니다:

- Vercel: `vercel deploy`
- Netlify: Netlify에 폴더 드래그 앤 드롭
- GitHub Pages: `gh-pages` 브랜치에 배포

## 빌드 프로필 설정

APK 빌드를 위한 `eas.json` 파일 예시:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

이 설정으로 APK 파일이 생성됩니다.

## 환경 변수 설정

Firebase 설정을 위한 환경 변수는 `.env` 파일에 저장되어 있습니다. 배포 시 다음을 확인하세요:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_DATABASE_URL`

EAS Build에서 환경 변수를 설정하려면:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "your-api-key"
```

## 앱 아이콘 및 스플래시 스크린

현재 설정:

- 아이콘: `./assets/images/icon.png`
- 스플래시 스크린: `./assets/images/splash-icon.png`

필요시 `app.json`에서 경로를 수정할 수 있습니다.

## 업데이트 배포 (OTA 업데이트)

코드 변경사항을 앱 스토어 재심사 없이 배포하려면:

```bash
eas update --branch production --message "업데이트 내용"
```

## 유용한 명령어

- 빌드 상태 확인: `eas build:list`
- 빌드 로그 확인: `eas build:view [BUILD_ID]`
- 프로젝트 정보 확인: `eas project:info`

## 참고 자료

- [EAS Build 문서](https://docs.expo.dev/build/introduction/)
- [EAS Submit 문서](https://docs.expo.dev/submit/introduction/)
- [EAS Update 문서](https://docs.expo.dev/eas-update/introduction/)
