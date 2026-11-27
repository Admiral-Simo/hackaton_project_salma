import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "./firebase";
import type { DspPreset, VoiceProfile } from "../types/voice";

const profilesCol = (uid: string) => collection(db, "users", uid, "voiceProfiles");

export async function saveVoiceProfile(
  uid: string,
  preset: DspPreset,
  inferenceSource: "on-device" | "cloud"
): Promise<VoiceProfile> {
  const payload = {
    ...preset,
    createdAt: Date.now(),
    consentConfirmed: true,
    inferenceSource,
  };
  const ref = await addDoc(profilesCol(uid), payload);
  return { id: ref.id, ...payload };
}

export async function getUserProfiles(uid: string): Promise<VoiceProfile[]> {
  const q = query(profilesCol(uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VoiceProfile, "id">) }));
}

export async function deleteVoiceProfile(uid: string, profileId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "voiceProfiles", profileId));
}
