import React from 'react';
import { X, Sparkles, Brain, Flame, Calendar, Tag, CheckCircle2, TrendingUp } from 'lucide-react';
import { ReflectionEntry } from '../types';

interface InsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ReflectionEntry[];
}

export const InsightsModal: React.FC<InsightsModalProps> = ({ isOpen, onClose, entries }) => {
  if (!isOpen) return null;

  const totalEntries = entries.length;
  const totalWords = entries.reduce((acc, entry) => {
    const promptWords = entry.primaryPrompt?.split(/\s+/).filter(Boolean).length || 0;
    const msgWords = entry.messages?.reduce((mAcc, m) => mAcc + (m.content?.split(/\s+/).filter(Boolean).length || 0), 0) || 0;
    return acc + promptWords + msgWords;
  }, 0);

  const totalTakeaways = entries.reduce((acc, entry) => acc + (entry.takeaways?.length || 0), 0);

  // Tag distribution
  const tagCounts: Record<string, number> = {};
  entries.forEach((entry) => {
    entry.tags?.forEach((t) => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });

  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  // Mode distribution
  const modeCounts: Record<string, number> = {};
  entries.forEach((entry) => {
    modeCounts[entry.mode] = (modeCounts[entry.mode] || 0) + 1;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 font-serif">
                Journaling &amp; Reflection Analytics
              </h3>
              <p className="text-xs text-slate-500">
                Synthesis of your cognitive growth and reflections
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-center space-y-1">
            <span className="text-xs text-slate-500 font-medium">Total Entries</span>
            <p className="text-2xl font-bold text-slate-900 font-mono">{totalEntries}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-center space-y-1">
            <span className="text-xs text-slate-500 font-medium">Estimated Words</span>
            <p className="text-2xl font-bold text-indigo-600 font-mono">{totalWords.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-center space-y-1">
            <span className="text-xs text-slate-500 font-medium">Action Items</span>
            <p className="text-2xl font-bold text-emerald-600 font-mono">{totalTakeaways}</p>
          </div>
        </div>

        {/* Thematic Tags Cloud */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Recurring Themes &amp; Tags
          </h4>
          {sortedTags.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No tags created yet. Add tags in the studio to track themes.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sortedTags.map(([tag, count]) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-xs text-indigo-800 font-medium"
                >
                  <Tag className="w-3 h-3 text-indigo-600" />
                  <span>#{tag}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white text-indigo-600 font-mono border border-indigo-200">
                    {count}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Reflection Mode Distribution */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Modes Utilized
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {Object.entries(modeCounts).map(([mode, count]) => (
              <div key={mode} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <span className="capitalize text-slate-700 font-medium">{mode.replace('_', ' ')}</span>
                <span className="font-mono text-indigo-600 font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium transition cursor-pointer"
          >
            Close Insights
          </button>
        </div>
      </div>
    </div>
  );
};
