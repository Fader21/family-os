import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAE7GQrSkHCxPq4ZyMD5aItAzuUa8kkMfc",
  authDomain: "family-os-df2eb.firebaseapp.com",
  databaseURL: "https://family-os-df2eb-default-rtdb.firebaseio.com",
  projectId: "family-os-df2eb",
  storageBucket: "family-os-df2eb.firebasestorage.app",
  messagingSenderId: "990149142658",
  appId: "1:990149142658:web:b2065d10532328d334ac9b",
  measurementId: "G-F1JFM53WBJ"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);