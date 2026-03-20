import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDaFENyoEF_hlO_USOAyylUMJ6gdabJcMQ",
  authDomain: "suicune-9b865.firebaseapp.com",
  projectId: "suicune-9b865",
  appId: "1:862441558474:web:c2dcdf5b2127cb9ab33f33",
};

export const firebaseApp =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp);
