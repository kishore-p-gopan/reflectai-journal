import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  BookOpen, 
  BarChart3, 
  LogOut, 
  LogIn,
  ShieldCheck, 
  Plus, 
  User as UserIcon, 
  Compass, 
  MapPin,
  Database,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { AppUser } from '../types';

interface NavbarProps {
  user: AppUser | null;
  entryCount: number;
  onNewReflection: () => void;
  onOpenInsights: () => void;
  onOpenRecommendations: () => void;
  onOpenMap: () => void;
  onSignOut: () => void;
  onSignInWithGoogle?: () => void;
  isSaving?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  entryCount,
  onNewReflection,
  onOpenInsights,
  onOpenRecommendations,
  onOpenMap,
  onSignOut,
  onSignInWithGoogle,
  isSaving,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isProfileOpen]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Status */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold italic shadow-sm">
            R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg tracking-tight text-slate-900 font-sans">
                Reflect<span className="text-indigo-600">.ai</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                <ShieldCheck className="w-3 h-3" /> Firestore Isolated
              </span>
            </div>
            <p className="hidden md:block text-xs text-slate-400 font-sans">
              Private Gemini Reflection &amp; Journaling
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {isSaving && (
            <span className="text-xs text-indigo-600 font-medium animate-pulse flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
              Saving to Firestore...
            </span>
          )}

          <button
            id="btn-new-reflection"
            onClick={onNewReflection}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-md shadow-indigo-100 font-sans cursor-pointer active:scale-95"
            title="Start a new reflection thread"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Reflection</span>
          </button>

          <button
            id="btn-open-recommendations"
            onClick={onOpenRecommendations}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition border border-slate-200 shadow-xs cursor-pointer"
            title="Personalized Wellbeing Guidance"
          >
            <Compass className="w-4 h-4 text-indigo-600" />
            <span className="hidden md:inline">Guidance</span>
          </button>

          <button
            id="btn-open-map"
            onClick={onOpenMap}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition border border-slate-200 shadow-xs cursor-pointer"
            title="Geotagged Reflections Map"
          >
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span className="hidden md:inline">Map</span>
          </button>

          <button
            id="btn-open-insights"
            onClick={onOpenInsights}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition border border-slate-200 shadow-xs cursor-pointer"
            title="View Reflection Analytics & Insights"
          >
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span className="hidden md:inline">Insights</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {entryCount}
            </span>
          </button>

          {/* User Profile / Menu / Logout */}
          <div className="flex items-center gap-3 pl-2 border-l border-slate-100 relative" ref={profileMenuRef}>
            <div className="hidden lg:flex flex-col items-end">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                {user?.isAnonymous ? 'Guest Mode' : 'Connected'}
              </span>
              <span className="text-xs font-medium text-slate-800 truncate max-w-[140px]">
                {user?.displayName || (user?.isAnonymous ? 'Guest User' : user?.email)}
              </span>
            </div>

            {/* Clickable User Avatar Button */}
            <button
              id="btn-user-avatar"
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className="relative flex items-center gap-1.5 p-0.5 rounded-full hover:ring-2 hover:ring-indigo-300 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="User Account Menu"
              aria-expanded={isProfileOpen}
              aria-haspopup="true"
              title={user?.isAnonymous ? 'Guest Account - Click to manage or sign in' : `${user?.displayName || user?.email} - Account settings`}
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-9 h-9 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={`w-9 h-9 rounded-full ${user?.isAnonymous ? 'bg-amber-100 text-amber-800 ring-amber-300' : 'bg-slate-100 text-slate-600 ring-slate-200'} border-2 border-white shadow-sm ring-1 flex items-center justify-center text-xs font-bold transition hover:scale-105`}>
                  {user?.email ? user.email.slice(0, 2).toUpperCase() : <UserIcon className="w-4 h-4" />}
                </div>
              )}
              {user?.isAnonymous && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 border-2 border-white rounded-full shadow-xs" title="Guest Mode Active" />
              )}
            </button>

            {/* User Profile Dropdown Popover */}
            {isProfileOpen && (
              <div
                id="menu-user-profile-dropdown"
                className="absolute right-0 top-12 mt-2 w-76 sm:w-84 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95"
              >
                {/* User Header */}
                <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-10 h-10 rounded-full border border-slate-200 object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-full ${user?.isAnonymous ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-700'} flex items-center justify-center font-bold text-sm shrink-0`}>
                      {user?.email ? user.email.slice(0, 2).toUpperCase() : <UserIcon className="w-5 h-5" />}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-sm font-semibold text-slate-900 truncate">
                        {user?.displayName || (user?.isAnonymous ? 'Guest Explorer' : 'ReflectAI User')}
                      </h4>
                      {user?.isAnonymous ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Guest Mode
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {user?.email || (user?.isAnonymous ? 'Temporary browser session' : 'Authenticated User')}
                    </p>
                  </div>
                </div>

                {/* Account Details or Guest Call-to-Action */}
                {user?.isAnonymous ? (
                  <div className="py-3 space-y-3">
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900">
                      <p className="font-semibold mb-1">Exploring in Guest Mode</p>
                      <p className="text-[11px] text-amber-800/90 leading-relaxed">
                        Reflections are stored locally in your browser. Sign in with Google to sync across devices, persist securely to Cloud Firestore, and enable personalized AI wellbeing recommendations.
                      </p>
                    </div>

                    {onSignInWithGoogle && (
                      <button
                        id="btn-dropdown-google-signin"
                        onClick={() => {
                          setIsProfileOpen(false);
                          onSignInWithGoogle();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium text-xs shadow-sm cursor-pointer active:scale-98"
                      >
                        <LogIn className="w-4 h-4" />
                        Sign In with Google
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="py-3 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-500">Reflections Logged</span>
                      <span className="font-semibold text-slate-900 font-mono">{entryCount}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-500">Firestore Database</span>
                      <span className="font-mono text-[10px] text-indigo-600 truncate max-w-[150px]">
                        ai-studio-...182d
                      </span>
                    </div>
                  </div>
                )}

                {/* Footer / Sign Out */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    id="btn-dropdown-sign-out"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-xs font-medium transition border border-slate-200 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {user?.isAnonymous ? 'Exit Guest Session' : 'Sign Out'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

