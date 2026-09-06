import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Trash2, 
  Pin, 
  Sparkles, 
  FileText, 
  Calendar, 
  Clock, 
  Download, 
  Tag, 
  Brain, 
  Lightbulb, 
  ListChecks, 
  MessageSquare,
  ChevronRight,
  BookOpen,
  ArrowRight,
  AlertCircle,
  XCircle,
  Terminal
} from 'lucide-react';
import { ReflectionEntry, ReflectionMode, SearchMatch } from '../types';
import { searchReflectionsSemantically } from '../lib/firebase';

interface HistoryPanelProps {
  entries: ReflectionEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: ReflectionEntry) => void;
  onDeleteEntry: (id: string) => void;
  onNewReflection: () => void;
  loading: boolean;
  isGuest?: boolean;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onDeleteEntry,
  onNewReflection,
  loading,
  isGuest = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  // Feature 3: Semantic Journal Search state
  const [isSemanticMode, setIsSemanticMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [semanticMatches, setSemanticMatches] = useState<SearchMatch[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [indexNotice, setIndexNotice] = useState<string | null>(null);

  const handleSemanticSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    // Per security & cost directives: guest mode avoids billable endpoints
    if (isGuest) {
      setSearchError('Semantic vector search requires an authenticated account. Please sign in with Google or use standard keyword search.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setIndexNotice(null);

    try {
      const result = await searchReflectionsSemantically(searchQuery.trim(), 8);
      setSemanticMatches(result.matches);
      if (result.indexRequired && result.indexNotice) {
        setIndexNotice(result.indexNotice);
      }
    } catch (err: any) {
      console.error('Semantic search error:', err);
      setSearchError(err?.message || 'Semantic search encountered an issue. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const clearSemanticSearch = () => {
    setSemanticMatches(null);
    setSearchError(null);
    setIndexNotice(null);
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Standard search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        entry.title?.toLowerCase().includes(q) ||
        entry.summary?.toLowerCase().includes(q) ||
        entry.tags?.some((t) => t.toLowerCase().includes(q)) ||
        entry.messages?.some((m) => m.content.toLowerCase().includes(q));

      // Mode filter
      const matchesMode = filterMode === 'all' || entry.mode === filterMode;

      // Pinned filter
      const matchesPin = !showPinnedOnly || entry.pinned;

      return matchesQuery && matchesMode && matchesPin;
    });
  }, [entries, searchQuery, filterMode, showPinnedOnly]);

  const handleExportAll = () => {
    if (entries.length === 0) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(entries, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `reflect_ai_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getModeIcon = (mode: ReflectionMode) => {
    switch (mode) {
      case 'reflection':
        return Brain;
      case 'brainstorm':
        return Lightbulb;
      case 'summary':
        return FileText;
      case 'action_items':
        return ListChecks;
      case 'chat':
      default:
        return MessageSquare;
    }
  };

  return (
    <aside className="flex flex-col h-full bg-white text-slate-900 rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Journal Archive</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {entries.length}
            </span>
          </div>

          <button
            onClick={handleExportAll}
            disabled={entries.length === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition disabled:opacity-40 cursor-pointer"
            title="Export all reflections as JSON"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search Mode Selector (Standard vs Semantic AI) */}
        <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => {
              setIsSemanticMode(false);
              clearSemanticSearch();
            }}
            className={`flex-1 py-1 text-center font-medium rounded-md transition cursor-pointer flex items-center justify-center gap-1.5 ${
              !isSemanticMode ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Search className="w-3 h-3" />
            <span>Keyword</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSemanticMode(true);
            }}
            className={`flex-1 py-1 text-center font-medium rounded-md transition cursor-pointer flex items-center justify-center gap-1.5 ${
              isSemanticMode ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>AI Semantic</span>
          </button>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={isSemanticMode ? handleSemanticSearch : (e) => e.preventDefault()} className="relative">
          {isSemanticMode ? (
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2" />
          ) : (
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          )}

          <input
            id="input-search-history"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isSemanticMode
                ? "Describe a thought, emotion, or theme..."
                : "Search entries, tags, or topics..."
            }
            className="w-full pl-8 pr-16 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 border border-slate-200 font-sans"
          />

          {isSemanticMode && (
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-medium hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer flex items-center gap-1"
            >
              {isSearching ? '...' : 'Find'}
            </button>
          )}
        </form>

        {/* Guest Mode Advisory for Semantic Search */}
        {isSemanticMode && isGuest && (
          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200/70 text-[11px] text-amber-800 flex items-start gap-1.5 leading-relaxed">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Guest mode uses keyword search. <strong>Sign in with Google</strong> to enable Gemini vector embeddings and Firestore KNN search.
            </span>
          </div>
        )}

        {/* Index Creation Notice Banner */}
        {indexNotice && (
          <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-[11px] text-slate-700 space-y-1">
            <div className="flex items-center gap-1 text-slate-900 font-semibold">
              <Terminal className="w-3 h-3 text-indigo-600" />
              <span>Vector Index Notice</span>
            </div>
            <p className="text-[10px] text-slate-600 leading-snug">
              Manual step required: Run the <code className="bg-slate-200 px-1 py-0.5 rounded">gcloud firestore indexes composite create</code> command for native KNN acceleration. Displaying fallback similarity results.
            </p>
          </div>
        )}

        {searchError && (
          <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700 flex items-center justify-between">
            <span>{searchError}</span>
            <button onClick={() => setSearchError(null)} className="text-red-500 hover:text-red-800 cursor-pointer">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Standard Filters (when not in active semantic results mode) */}
        {(!isSemanticMode || !semanticMatches) && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <select
              id="select-filter-mode"
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="bg-white text-slate-700 text-xs rounded-md px-2 py-1 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Modes</option>
              <option value="reflection">Reflections</option>
              <option value="brainstorm">Brainstorms</option>
              <option value="summary">Summaries</option>
              <option value="action_items">Action Items</option>
              <option value="chat">Dialogues</option>
            </select>

            <button
              onClick={() => setShowPinnedOnly(!showPinnedOnly)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition cursor-pointer ${
                showPinnedOnly
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium'
                  : 'text-slate-500 hover:text-slate-800 bg-white border border-slate-200'
              }`}
            >
              <Pin className={`w-3 h-3 ${showPinnedOnly ? 'fill-indigo-600 text-indigo-600' : ''}`} />
              <span>Pinned</span>
            </button>
          </div>
        )}

        {/* Active Semantic Results Header */}
        {isSemanticMode && semanticMatches && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="font-semibold text-indigo-700">
              {semanticMatches.length} Semantic Match{semanticMatches.length === 1 ? '' : 'es'}
            </span>
            <button
              onClick={clearSemanticSearch}
              className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              Clear Results
            </button>
          </div>
        )}
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading || isSearching ? (
          <div className="p-8 text-center text-xs text-slate-400 space-y-2">
            <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
            <p>{isSearching ? 'Embedding query & searching vault...' : 'Loading your reflections from Firestore...'}</p>
          </div>
        ) : isSemanticMode && semanticMatches ? (
          /* Semantic Results View */
          semanticMatches.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 space-y-2">
              <p>No reflections closely matched your concept.</p>
              <p className="text-[11px] text-slate-400">
                Try phrasing in different words or write a new reflection on this topic.
              </p>
              <button
                onClick={clearSemanticSearch}
                className="text-indigo-600 hover:underline text-xs"
              >
                Back to all entries
              </button>
            </div>
          ) : (
            semanticMatches.map((match) => {
              const fullEntry = entries.find((e) => e.id === match.id);
              const isSelected = activeEntryId === match.id;
              const matchPercent = Math.round(match.score * 100);

              return (
                <div
                  key={match.id}
                  onClick={() => {
                    if (fullEntry) {
                      onSelectEntry(fullEntry);
                    }
                  }}
                  className={`group relative p-3 rounded-xl transition border text-left cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-300 shadow-sm ring-1 ring-indigo-200'
                      : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-semibold text-slate-800 truncate font-serif">
                      {match.title || 'Untitled Reflection'}
                    </h4>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 font-mono">
                      {matchPercent}% match
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 font-sans">
                    {match.summary || (fullEntry?.primaryPrompt ?? 'No summary available')}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1 text-indigo-600 font-medium">
                      <span>View in Studio</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>

                    {fullEntry && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteEntry(fullEntry.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                        title="Delete reflection"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : filteredEntries.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 space-y-3">
            <p>No reflections matching your criteria.</p>
            {entries.length === 0 ? (
              <button
                onClick={onNewReflection}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-medium border border-indigo-200 transition cursor-pointer"
              >
                Write First Reflection
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('all');
                  setShowPinnedOnly(false);
                  clearSemanticSearch();
                }}
                className="text-indigo-600 hover:underline text-xs"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isSelected = activeEntryId === entry.id;
            const ModeIcon = getModeIcon(entry.mode);
            const dateStr = new Date(entry.createdAt || entry.updatedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry)}
                className={`group relative p-3 rounded-xl transition border text-left cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50/70 border-indigo-300 shadow-sm ring-1 ring-indigo-200'
                    : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ModeIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <h4 className="text-xs font-semibold text-slate-800 truncate font-serif">
                      {entry.title || 'Untitled Reflection'}
                    </h4>
                  </div>
                  {entry.pinned && (
                    <Pin className="w-3 h-3 text-indigo-600 fill-indigo-600 shrink-0" />
                  )}
                </div>

                {entry.summary ? (
                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 font-sans">
                    {entry.summary}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 italic font-sans">
                    {entry.primaryPrompt || 'No prompt content'}
                  </p>
                )}

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {dateStr}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {entry.tags && entry.tags.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        #{entry.tags[0]}
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEntry(entry.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                      title="Delete reflection"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
