import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  auth, 
  signInWithGoogle, 
  logOut, 
  subscribeToUserReflections, 
  deleteReflectionFromFirestore,
  saveReflectionToFirestore
} from './lib/firebase';
import { ReflectionEntry, AppUser } from './types';
import { Navbar } from './components/Navbar';
import { LandingHero } from './components/LandingHero';
import { ReflectionStudio } from './components/ReflectionStudio';
import { HistoryPanel } from './components/HistoryPanel';
import { InsightsModal } from './components/InsightsModal';
import { RecommendationsPanel } from './components/RecommendationsPanel';
import { JournalMapModal } from './components/JournalMapModal';
import { BookOpen, AlertCircle, CheckCircle, RefreshCw, PanelLeftOpen, PanelLeftClose } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Firestore Data State
  const [entries, setEntries] = useState<ReflectionEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<ReflectionEntry | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // UI Modals & Sidebars
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isRecommendationsOpen, setIsRecommendationsOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 1. Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          isAnonymous: user.isAnonymous,
        });
      } else {
        setCurrentUser((prev) => (prev?.uid.startsWith('guest_') ? prev : null));
      }
      setAuthInitialized(true);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Subscribe to reflections for current user
  useEffect(() => {
    if (!currentUser) {
      setEntries([]);
      setActiveEntry(null);
      return;
    }

    setEntriesLoading(true);
    const unsubscribe = subscribeToUserReflections(
      currentUser.uid,
      (userEntries) => {
        setEntries(userEntries);
        setEntriesLoading(false);

        // Keep active entry in sync if it exists in the updated list
        setActiveEntry((prev) => {
          if (!prev) return userEntries[0] || null;
          const matched = userEntries.find((e) => e.id === prev.id);
          return matched || prev;
        });
      },
      (err) => {
        console.error('Error fetching reflections:', err);
        setEntriesLoading(false);
        showToast('Sync notice: Working with current session data.');
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3000);
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
      showToast('Signed in successfully with Google');
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setAuthError(err?.message || 'Failed to complete Google Sign-In.');
      setAuthLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const guestUser: AppUser = {
        uid: 'guest_local_user',
        displayName: 'Guest Explorer',
        email: null,
        photoURL: null,
        isAnonymous: true,
      };
      setCurrentUser(guestUser);
      setAuthLoading(false);
      showToast('Started instant guest exploration session');
    } catch (err: any) {
      console.error('Guest sign-in error:', err);
      setAuthError('Failed to start guest session.');
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (currentUser?.uid.startsWith('guest_')) {
        setCurrentUser(null);
      } else {
        await logOut();
        setCurrentUser(null);
      }
      setActiveEntry(null);
      setEntries([]);
      showToast('Signed out securely');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };


  const handleNewReflection = () => {
    const newDraft: ReflectionEntry = {
      id: `ref_${Date.now()}`,
      userId: currentUser?.uid || 'guest',
      title: 'Untitled Reflection',
      primaryPrompt: '',
      messages: [],
      summary: '',
      takeaways: [],
      tags: [],
      mode: 'reflection',
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setActiveEntry(newDraft);
    showToast('New reflection thread opened');
  };

  const handleDeleteEntry = async (id: string) => {
    if (!currentUser) return;
    try {
      await deleteReflectionFromFirestore(currentUser.uid, id);
      if (activeEntry?.id === id) {
        const remaining = entries.filter((e) => e.id !== id);
        setActiveEntry(remaining[0] || null);
      }
      showToast('Reflection removed from Firestore');
    } catch (err) {
      console.error('Failed to delete entry:', err);
      showToast('Failed to delete reflection');
    }
  };

  const handleUpdateEntryLocation = async (entryId: string, geo: { lat: number; lng: number }) => {
    if (!currentUser) return;
    const target = entries.find((e) => e.id === entryId) || (activeEntry?.id === entryId ? activeEntry : null);
    if (!target) return;

    const updated: ReflectionEntry = {
      ...target,
      geo,
      updatedAt: Date.now(),
    };

    try {
      await saveReflectionToFirestore(currentUser.uid, updated);
      if (activeEntry?.id === entryId) {
        setActiveEntry(updated);
      }
      showToast(`Location updated for "${updated.title}"`);
    } catch (err) {
      console.error('Failed to update location:', err);
      showToast('Failed to update reflection location');
    }
  };

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex flex-col items-center justify-center text-slate-700 gap-4">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs font-mono text-slate-400">Initializing ReflectAI &amp; Firebase Security Context...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a] flex flex-col font-sans selection:bg-indigo-50 selection:text-indigo-900">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3 backdrop-blur-md">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Unauthenticated Landing / Sign-in */}
      {!currentUser ? (
        <LandingHero
          onSignInWithGoogle={handleGoogleSignIn}
          onSignInAsGuest={handleGuestSignIn}
          authLoading={authLoading}
          authError={authError}
        />
      ) : (
        /* Authenticated Private Dashboard */
        <div className="flex flex-col flex-1 h-screen overflow-hidden">
          <Navbar
            user={currentUser}
            entryCount={entries.length}
            onNewReflection={handleNewReflection}
            onOpenInsights={() => setIsInsightsOpen(true)}
            onOpenRecommendations={() => setIsRecommendationsOpen(true)}
            onOpenMap={() => setIsMapOpen(true)}
            onSignOut={handleSignOut}
            onSignInWithGoogle={handleGoogleSignIn}
            isSaving={isSaving}
          />

          <main className="flex-1 overflow-hidden max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-6 flex gap-4">
            {/* Sidebar History Drawer Toggle for Mobile / Small Screens */}
            <div
              className={`${
                isHistoryOpen ? 'w-80 lg:w-88 shrink-0' : 'hidden'
              } h-full transition-all duration-300`}
            >
              <HistoryPanel
                entries={entries}
                activeEntryId={activeEntry?.id || null}
                onSelectEntry={(entry) => setActiveEntry(entry)}
                onDeleteEntry={handleDeleteEntry}
                onNewReflection={handleNewReflection}
                loading={entriesLoading}
                isGuest={currentUser.uid.startsWith('guest_')}
              />
            </div>

            {/* Main Reflection Studio */}
            <div className="flex-1 h-full flex flex-col min-w-0 relative">
              {/* Toggle Sidebar Button */}
              <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className="absolute top-4 left-4 z-10 p-2 rounded-lg bg-white/90 text-slate-500 hover:text-slate-800 border border-slate-200 shadow-sm backdrop-blur-sm transition cursor-pointer"
                title={isHistoryOpen ? 'Collapse History' : 'Expand History'}
              >
                {isHistoryOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>

              <ReflectionStudio
                userId={currentUser.uid}
                activeEntry={activeEntry}
                onUpdateActiveEntry={(updated) => setActiveEntry(updated)}
                onDeleteEntry={handleDeleteEntry}
                onSaveNotification={(msg) => showToast(msg)}
              />
            </div>
          </main>

          {/* Insights Analytics Modal */}
          <InsightsModal
            isOpen={isInsightsOpen}
            onClose={() => setIsInsightsOpen(false)}
            entries={entries}
          />

          {/* Recommendations Panel Modal */}
          <RecommendationsPanel
            isOpen={isRecommendationsOpen}
            onClose={() => setIsRecommendationsOpen(false)}
            userId={currentUser.uid}
            entries={entries}
            activeEntryId={activeEntry?.id || null}
          />

          {/* Geotagged Reflections Map Modal */}
          <JournalMapModal
            isOpen={isMapOpen}
            onClose={() => setIsMapOpen(false)}
            entries={entries}
            activeEntryId={activeEntry?.id}
            onSelectEntry={(entry) => setActiveEntry(entry)}
            onUpdateEntryLocation={handleUpdateEntryLocation}
          />
        </div>
      )}
    </div>
  );
}
