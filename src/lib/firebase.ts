import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, getToken, AppCheck } from 'firebase/app-check';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc, 
  getDocFromServer,
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
// Safely load local workspace configuration if present (which is gitignored)
const localConfigModules = import.meta.glob<Record<string, any>>('../../firebase-applet-config.json', {
  eager: true,
  import: 'default',
});
const localConfigFile = localConfigModules['../../firebase-applet-config.json'] || {};

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || localConfigFile.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || localConfigFile.authDomain || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || localConfigFile.projectId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || localConfigFile.storageBucket || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || localConfigFile.messagingSenderId || '',
  appId: env.VITE_FIREBASE_APP_ID || localConfigFile.appId || '',
};

import { ReflectionEntry, RecommendationBatch, AppUser, SearchMatch } from '../types';

// Helper to remove any undefined values prior to Firestore persistence
export function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    return value === undefined ? null : value;
  }));
}

// Initialize Firebase App instance
const hasConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const app = getApps().length === 0 
  ? initializeApp(hasConfig ? firebaseConfig : { apiKey: 'AIzaSyPlaceholderKey', projectId: 'placeholder-project' }) 
  : getApp();

// Initialize Firebase App Check if reCAPTCHA site key is present
export let appCheck: AppCheck | null = null;
const recaptchaKey = env.VITE_RECAPTCHA_SITE_KEY || localConfigFile.recaptchaSiteKey || '';

if (typeof window !== 'undefined' && typeof recaptchaKey === 'string' && recaptchaKey.trim().length > 0) {
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey.trim()),
      isTokenAutoRefreshEnabled: true,
    });
    console.info('Firebase App Check initialized successfully with reCAPTCHA v3.');
  } catch (appCheckErr) {
    console.warn('Firebase App Check initialization skipped/failed:', appCheckErr);
  }
}

/**
 * Retrieve current App Check token to include in server-side API calls.
 */
export async function getAppCheckToken(): Promise<string | null> {
  if (!appCheck) return null;
  try {
    const tokenResult = await getToken(appCheck, /* forceRefresh */ false);
    return tokenResult.token;
  } catch (err) {
    console.warn('Could not acquire App Check token:', err);
    return null;
  }
}

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with custom database ID if provided
const configuredDbId = env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || localConfigFile.firestoreDatabaseId;
const dbId = configuredDbId && configuredDbId !== '(default)'
  ? configuredDbId
  : undefined;

export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

// Validate connection to Firestore on initialization
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client appears offline. Please check network/Firebase configuration.");
    }
  }
}
testConnection();

// -------------------------------------------------------------
// Hardened Firestore Error Handling
// -------------------------------------------------------------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.warn('Popup sign in failed, attempting redirect or fallback:', error);
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectError) {
        console.error('Redirect auth error:', redirectError);
      }
    }
    throw error;
  }
}

export async function logOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// -------------------------------------------------------------
// Local Guest Persistence Helper for Instant Exploration
// -------------------------------------------------------------
const GUEST_STORAGE_KEY = 'reflectai_guest_reflections_v1';

function getLocalGuestReflections(): ReflectionEntry[] {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Could not load guest reflections from localStorage:', e);
    return [];
  }
}

function saveLocalGuestReflections(entries: ReflectionEntry[]): void {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Could not save guest reflections to localStorage:', e);
  }
}

// -------------------------------------------------------------
// Firestore User Data Access Layer (Strictly Isolated by userId)
// Path: /users/{userId}/reflections/{reflectionId}
// -------------------------------------------------------------

export async function saveReflectionToFirestore(
  userId: string, 
  entry: Omit<ReflectionEntry, 'id'> & { id?: string }
): Promise<string> {
  if (!userId) {
    throw new Error('User identifier must be provided to save reflection.');
  }

  const reflectionId = entry.id || `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const payload: ReflectionEntry = {
    ...entry,
    id: reflectionId,
    userId,
    updatedAt: Date.now(),
    createdAt: entry.createdAt || Date.now(),
  };

  // If in guest mode, persist to local storage seamlessly
  if (userId.startsWith('guest_')) {
    const current = getLocalGuestReflections();
    const filtered = current.filter(e => e.id !== reflectionId);
    const updated = [payload, ...filtered];
    saveLocalGuestReflections(updated);
    return reflectionId;
  }

  const docPath = `users/${userId}/reflections/${reflectionId}`;
  try {
    const docRef = doc(db, 'users', userId, 'reflections', reflectionId);
    const cleanPayload = sanitizeForFirestore(payload);
    await setDoc(docRef, cleanPayload, { merge: true });

    // Feature 3: Asynchronously generate and persist vector embedding on server for authenticated users
    if (!userId.startsWith('guest_') && (payload.title || payload.summary || payload.primaryPrompt)) {
      (async () => {
        try {
          const currentUser = auth.currentUser;
          if (currentUser) {
            const token = await currentUser.getIdToken();
            await fetch('/api/gemini/embed-reflection', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                reflectionId,
                title: payload.title,
                summary: payload.summary || payload.primaryPrompt?.slice(0, 300),
              }),
            });
          }
        } catch (embedErr) {
          // Non-blocking: background embedding generation error should never prevent or reject the save
          console.warn('Background reflection embedding notice:', embedErr);
        }
      })();
    }

    return reflectionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteReflectionFromFirestore(userId: string, reflectionId: string): Promise<void> {
  if (!userId || !reflectionId) return;

  if (userId.startsWith('guest_')) {
    const current = getLocalGuestReflections();
    const updated = current.filter(e => e.id !== reflectionId);
    saveLocalGuestReflections(updated);
    return;
  }

  const docPath = `users/${userId}/reflections/${reflectionId}`;
  try {
    const docRef = doc(db, 'users', userId, 'reflections', reflectionId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function subscribeToUserReflections(
  userId: string, 
  callback: (entries: ReflectionEntry[]) => void,
  onError?: (error: Error) => void
) {
  if (!userId) {
    callback([]);
    return () => {};
  }

  // If in guest mode, load local storage items and provide immediate callback
  if (userId.startsWith('guest_')) {
    const items = getLocalGuestReflections();
    items.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    callback(items);

    // Also listen to local storage events if another tab modifies
    const storageHandler = () => {
      const updated = getLocalGuestReflections();
      updated.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      callback(updated);
    };
    window.addEventListener('storage', storageHandler);
    return () => window.removeEventListener('storage', storageHandler);
  }

  const collectionPath = `users/${userId}/reflections`;
  const reflectionsRef = collection(db, 'users', userId, 'reflections');
  
  return onSnapshot(
    reflectionsRef,
    (snapshot) => {
      const items: ReflectionEntry[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as ReflectionEntry);
      });
      // Sort newest first
      items.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      callback(items);
    },
    (err) => {
      console.error('Firestore snapshot subscription error:', err);
      if (onError) {
        onError(err);
      } else {
        handleFirestoreError(err, OperationType.GET, collectionPath);
      }
    }
  );
}

// -------------------------------------------------------------
// Recommendations Persistence Layer
// Path: /users/{userId}/recommendations/{recId}
// -------------------------------------------------------------

export async function saveRecommendationsToFirestore(
  userId: string,
  batch: Omit<RecommendationBatch, 'id'> & { id?: string }
): Promise<string> {
  if (!userId) {
    throw new Error('User identifier must be provided to save recommendations.');
  }

  const recId = batch.id || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const payload: RecommendationBatch = {
    ...batch,
    id: recId,
    userId,
    createdAt: batch.createdAt || Date.now(),
  };

  if (userId.startsWith('guest_')) {
    return recId;
  }

  const docPath = `users/${userId}/recommendations/${recId}`;
  try {
    const docRef = doc(db, 'users', userId, 'recommendations', recId);
    const cleanPayload = sanitizeForFirestore(payload);
    await setDoc(docRef, cleanPayload, { merge: true });
    return recId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export function subscribeToUserRecommendations(
  userId: string,
  callback: (recommendations: RecommendationBatch[]) => void,
  onError?: (error: Error) => void
) {
  if (!userId || userId.startsWith('guest_')) {
    callback([]);
    return () => {};
  }

  const collectionPath = `users/${userId}/recommendations`;
  const recsRef = collection(db, 'users', userId, 'recommendations');

  return onSnapshot(
    recsRef,
    (snapshot) => {
      const items: RecommendationBatch[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as RecommendationBatch);
      });
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(items);
    },
    (err) => {
      console.error('Firestore recommendations subscription error:', err);
      if (onError) {
        onError(err);
      } else {
        handleFirestoreError(err, OperationType.GET, collectionPath);
      }
    }
  );
}

// -------------------------------------------------------------
// Feature 3: Semantic Journal Search Helper
// -------------------------------------------------------------
export interface SemanticSearchResult {
  query: string;
  count: number;
  matches: SearchMatch[];
  indexRequired?: boolean;
  indexNotice?: string;
}

export async function searchReflectionsSemantically(
  query: string,
  limit = 5
): Promise<SemanticSearchResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform semantic search.');
  }

  const token = await currentUser.getIdToken();
  const res = await fetch('/api/gemini/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: query.trim(),
      limit,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Semantic search failed with status ${res.status}`);
  }

  return await res.json();
}


