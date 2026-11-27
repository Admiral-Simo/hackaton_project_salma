import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getRemoteConfig, fetchAndActivate, getString, getBoolean } from "firebase/remote-config";
import { getAI, GoogleAIBackend } from "firebase/ai";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// App Check: prints a debug token in the browser console during local dev
if (import.meta.env.DEV) {
  (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(
    import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
  ),
  isTokenAutoRefreshEnabled: true,
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const ai = getAI(app, { backend: new GoogleAIBackend() });

// Remote Config with safe defaults
export const remoteConfig = getRemoteConfig(app);
remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 60_000 : 3_600_000;
remoteConfig.defaultConfig = {
  system_prompt:
    "You are an audio DSP engineer. Convert the user's voice style request and baseline pitch (Hz) into realistic, safe Web Audio DSP parameters.",
  enable_experimental_fx: true,
};

export async function loadRemoteConfig() {
  try {
    await fetchAndActivate(remoteConfig);
  } catch {
    // Falls back to defaultConfig silently if offline
  }
  return {
    systemPrompt: getString(remoteConfig, "system_prompt"),
    enableExperimentalFx: getBoolean(remoteConfig, "enable_experimental_fx"),
  };
}

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logoutUser = () => signOut(auth);
