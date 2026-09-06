import React, { useState } from 'react';
import { Sparkles, Shield, Lock, Brain, FileText, ArrowRight, CheckCircle2, Key, Database, RefreshCw } from 'lucide-react';

interface LandingHeroProps {
  onSignInWithGoogle: () => Promise<void>;
  onSignInAsGuest: () => Promise<void>;
  authLoading: boolean;
  authError: string | null;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onSignInWithGoogle,
  onSignInAsGuest,
  authLoading,
  authError,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'security'>('preview');

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center my-auto">
        {/* Left Column: Hero Copy & Auth CTA */}
        <div className="lg:col-span-6 space-y-8 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Gemini 3.6 Flash &bull; Cloud Firestore Isolated Storage</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-slate-900 font-serif leading-[1.15]">
              Intelligent journaling for <span className="italic text-indigo-600 font-normal">clarity</span>, <span className="italic text-slate-700 font-normal">brainstorming</span> &amp; focus.
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed font-sans max-w-xl">
              Write stream-of-consciousness reflections, untangle complex thoughts, and collaborate with Gemini in structured multi-turn sessions. All data is securely locked to your authenticated user profile.
            </p>
          </div>

          {/* Authentication Actions */}
          <div className="space-y-4 max-w-md">
            {authError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <span className="font-semibold">Auth Notice:</span>
                <span>{authError}</span>
              </div>
            )}

            <button
              id="btn-google-sign-in"
              onClick={onSignInWithGoogle}
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold text-sm hover:bg-slate-50 transition shadow-sm active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {authLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin text-slate-600" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Continue with Google Sign-In</span>
            </button>

            <div className="flex items-center gap-3 justify-center text-xs text-slate-400">
              <span className="h-px bg-slate-200 flex-1" />
              <span>or try immediate exploration</span>
              <span className="h-px bg-slate-200 flex-1" />
            </div>

            <button
              id="btn-guest-sign-in"
              onClick={onSignInAsGuest}
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200/80 transition border border-slate-200/80 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <span>Explore Instant Anonymous Session</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>

          {/* Key Value Points */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-slate-600 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Multi-turn Gemini Reflections</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Zero Shared Database Bleed</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Automated Key Takeaways</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Server-side API Protection</span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Mockup / Architecture Card */}
        <div className="lg:col-span-6">
          <div className="rounded-2xl bg-white border border-slate-200/80 p-6 shadow-xl space-y-5">
            {/* View Switcher */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Interactive Workspace Preview
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition cursor-pointer ${
                    activeTab === 'security'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Security &amp; Data Isolation
                </button>
              </div>
              <span className="text-[11px] font-mono text-slate-400">v1.0.0</span>
            </div>

            {activeTab === 'preview' ? (
              <div className="space-y-4">
                {/* Simulated User Entry */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      Reflection: Untangling Work Priorities
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Mode: Brainstorm</span>
                  </div>
                  <p className="text-xs text-slate-700 italic">
                    "I feel overwhelmed with competing deadlines between project architecture and team mentorship. How do I regain flow?"
                  </p>
                </div>

                {/* Simulated Gemini Response */}
                <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-indigo-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      Gemini 3.6 Flash Response
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 font-mono">
                      Synthesized in 420ms
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-700">
                    <p className="font-medium text-slate-900">
                      💡 Key Synthesis &amp; Takeaways:
                    </p>
                    <ul className="space-y-1 text-slate-600 pl-3 list-disc">
                      <li>Establish clear 90-minute timeboxes for deep architecture.</li>
                      <li>Group mentorship syncs into dedicated afternoon office hours.</li>
                      <li>Define binary completion criteria for urgent deliverables.</li>
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-indigo-100 flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">Suggested follow-up:</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200">
                      "Draft my weekly timebox schedule"
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-start gap-3">
                  <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-slate-800">Owner-Bound Firestore Rules</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Enforces <code className="text-indigo-600 font-mono">request.auth.uid == userId</code> on path <code className="text-indigo-600 font-mono">/users/{'{userId}'}/reflections/*</code>.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-start gap-3">
                  <Key className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-slate-800">Zero Client-Side Secret Leakage</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Gemini API key is held exclusively on the server runtime via Secret Manager / environment variables.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-start gap-3">
                  <Database className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-slate-800">Strict Undefined-Stripping Hygiene</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      All document payloads are recursively sanitized to prevent undefined field persistence errors.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="pt-8 text-center text-xs text-slate-400 font-sans border-t border-slate-100">
        ReflectAI &bull; Cloud Run Container Verified &bull; Firebase Authentication &amp; Firestore Integration
      </div>
    </div>
  );
};
