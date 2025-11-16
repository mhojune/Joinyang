import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import React from "react";

type AuthContextValue = {
  user: User | null;
  isLoadingUser: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userId: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = React.useState<boolean>(true);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoadingUser(false);
    });
    return () => unsub();
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = React.useCallback(
    async (email: string, password: string, userId: string) => {
      // 클라이언트에서 Firestore 쿼리로 userId 중복 체크
      const trimmedUserId = userId.trim();
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("userId", "==", trimmedUserId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        throw new Error("이미 사용 중인 프로필 아이디입니다.");
      }

      // Firebase Auth로 회원가입
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // DiceBear Identicon URL 생성 (userId를 seed로 사용)
      const avatarUrl = `https://api.dicebear.com/9.x/identicon/png?seed=${encodeURIComponent(
        trimmedUserId
      )}&size=128`;

      // Firestore에 유저 정보 저장
      await setDoc(doc(db, "users", uid), {
        userId: trimmedUserId,
        email: email,
        intro: "", // 기본값, 나중에 프로필 설정에서 변경 가능
        avatarUrl: avatarUrl, // DiceBear Identicon URL
        createdAt: serverTimestamp(),
        joinedGroups: [], // 참가 중인 모임 ID 리스트
      });
    },
    []
  );

  const signOutFn = React.useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = React.useMemo(
    () => ({ user, isLoadingUser, signIn, signUp, signOut: signOutFn }),
    [user, isLoadingUser, signIn, signUp, signOutFn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
