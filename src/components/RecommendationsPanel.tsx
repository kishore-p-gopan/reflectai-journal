import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Compass, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle, 
  LogIn, 
  BookmarkCheck,
  HeartHandshake,
  Zap
} from 'lucide-react';
import { RecommendationBatch, ReflectionEntry } from '../types';
import { requestGeminiRecommendations } from '../lib/gemini-client';
import { subscribeToUserRecommendations, saveRecommendationsToFirestore } from '../lib/firebase';

interface RecommendationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  entries?: ReflectionEntry[];
  activeEntryId?: string | null;
}

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  isOpen,
  onClose,
  userId,
  entries = [],
  activeEntryId = null,
}) => {
  const [batches, setBatches] = useState<RecommendationBatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGuest = !userId || userId.startsWith('guest_');

  // Subscribe to real-time recommendations persisted in Firestore for authenticated user
  useEffect(() => {
    if (!isOpen || isGuest) return;

    const unsubscribe = subscribeToUserRecommendations(
      userId,
      (userBatches) => {
        setBatches(userBatches);
      },
      (err) => {
        console.warn('Subscription error for recommendations:', err);
      }
    );

    return () => unsubscribe();
  }, [isOpen, userId, isGuest]);

  // Initial trigger if authenticated user has no existing recommendations
  useEffect(() => {
    if (isOpen && !isGuest && batches.length === 0 && !isLoading) {
      handleRefresh();
    }
  }, [isOpen, isGuest, batches.length]);

  const handleRefresh = async () => {
    if (isGuest) return;

    setIsLoading(true);
    setError(null);

    try {
      // Pass client-side reflections as context fallback for immediate relevance
      const clientPayload = entries.slice(0, 5).map((e) => ({
        title: e.title,
        summary: e.summary,
        primaryPrompt: e.primaryPrompt,
        tags: e.tags,
        mode: e.mode,
      }));

      const newBatch = await requestGeminiRecommendations(
        clientPayload,
        activeEntryId || undefined
      );
      // Ensure client-side persistence as well via Firebase Web SDK
      try {
        await saveRecommendationsToFirestore(userId, newBatch);
      } catch (saveErr) {
        console.warn('Client-side recommendation save notice:', saveErr);
      }
      // Optimistically add to state in case Firestore latency exists
      setBatches((prev) => [newBatch, ...prev.filter((b) => b.id !== newBatch.id)]);
    } catch (err: any) {
      console.error('Failed to generate recommendations:', err);
      setError(err?.message || 'Unable to generate recommendations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const latestBatch = batches[0];
  const suggestions = latestBatch?.suggestions || [];

  const getCategoryBadgeStyle = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('project') || cat.includes('strategy') || cat.includes('action')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (cat.includes('sprint') || cat.includes('prototyping') || cat.includes('review') || cat.includes('perspective')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (cat.includes('focus') || cat.includes('practice')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (cat.includes('grounding') || cat.includes('breathing')) {
      return 'bg-teal-50 text-teal-700 border-teal-200';
    }
    if (cat.includes('gratitude') || cat.includes('mindful')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-slate-900 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-slate-900 font-serif">
                  Personalized Guidance & Insights
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Zap className="w-2.5 h-2.5" />
                  Cost-Optimized (Flash-Lite)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                AI synthesis of your reflections, insights, and thought patterns
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isGuest && (
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer disabled:opacity-50"
                title="Synthesize new suggestions from recent reflections"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Synthesizing...' : 'Refresh'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {isGuest ? (
            /* Guest Mode State */
            <div className="py-12 px-6 rounded-xl bg-slate-50 border border-slate-200/70 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                <LogIn className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h4 className="text-base font-semibold text-slate-900 font-serif">
                  Sign In for Personalized Recommendations
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ReflectAI's recommendation engine evaluates the themes across your journal entries server-side to suggest customized follow-up reflections, actionable ideas, and focus practices.
                </p>
                <p className="text-xs text-slate-500 italic">
                  Sign in with your Google account to securely sync reflections and unlock tailored guidance.
                </p>
              </div>
            </div>
          ) : error ? (
            /* Error State */
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
              <button
                onClick={handleRefresh}
                className="text-xs font-semibold underline hover:text-red-900 cursor-pointer"
              >
                Retry generation
              </button>
            </div>
          ) : isLoading && suggestions.length === 0 ? (
            /* Loading State */
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-700">
                Evaluating recent reflections and themes...
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Synthesizing personalized guidance using high-speed, cost-efficient Gemini 3.1 Flash-Lite.
              </p>
            </div>
          ) : suggestions.length === 0 ? (
            /* Empty State */
            <div className="py-12 text-center space-y-3">
              <HeartHandshake className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-700">No suggestions recorded yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Click "Refresh" above to analyze your journal history and generate personalized guidance.
              </p>
            </div>
          ) : (
            /* Suggestions List */
            <div className="space-y-3">
              {suggestions.map((item, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition space-y-2 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${getCategoryBadgeStyle(item.category)}`}>
                          {item.category}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-900">
                          {item.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.reason}
                      </p>
                    </div>

                    {item.resourceLink && (
                      <a
                        href={item.resourceLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 hover:border-indigo-200 font-medium transition cursor-pointer"
                        title="Explore verified reference"
                      >
                        <span>Resource</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {latestBatch?.createdAt && (
                <div className="pt-2 text-right">
                  <span className="text-[11px] text-slate-400">
                    Generated on {new Date(latestBatch.createdAt).toLocaleDateString()} at{' '}
                    {new Date(latestBatch.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Guidance */}
        <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>Suggestions offer tailored insights, reflection prompts & focus practices.</span>
          <span className="font-mono text-[10px] text-slate-400">Token-budget: 500 max</span>
        </div>
      </div>
    </div>
  );
};
