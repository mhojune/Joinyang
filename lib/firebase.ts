import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// React Native 환경에서는 analytics를 사용하지 않습니다.
const firebaseConfig = {
  apiKey: "AIzaSyAYBNhOBqIj-a2Z74R6ydB3vCTiyE_Uc-Y",
  authDomain: "joinyang-3aaab.firebaseapp.com",
  projectId: "joinyang-3aaab",
  storageBucket: "joinyang-3aaab.firebasestorage.app",
  messagingSenderId: "733964978335",
  appId: "1:733964978335:web:bc0003c9455d9f46a43aaa",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
