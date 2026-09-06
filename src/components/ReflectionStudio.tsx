import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import confetti from 'canvas-confetti';
import { 
  Sparkles, 
  Send, 
  RefreshCw, 
  Lightbulb, 
  CheckCircle2, 
  Copy, 
  Check, 
  Tag, 
  Plus, 
  X, 
  MessageSquare, 
  Brain, 
  FileText, 
  ListChecks, 
  HelpCircle,
  AlertCircle,
  Pin,
  Trash2,
  Share2,
  Clock,
  MapPin,
  Loader2
} from 'lucide-react';
import { ReflectionEntry, ChatMessage, ReflectionMode } from '../types';
import { requestGeminiReflection } from '../lib/gemini-client';
import { saveReflectionToFirestore } from '../lib/firebase';

interface ReflectionStudioProps {
  userId: string;
  activeEntry: ReflectionEntry | null;
  onUpdateActiveEntry: (entry: ReflectionEntry) => void;
  onDeleteEntry?: (id: string) => void;
  onSaveNotification?: (msg: string) => void;
}

const MODE_DEFINITIONS: {
  id: ReflectionMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  placeholder: string;
}[] = [
  {
    id: 'reflection',
    label: 'Deep Reflection',
    icon: Brain,
    description: 'Ground emotional thoughts, uncover mental patterns & gain perspective.',
    placeholder: 'What has been occupying your mind today? Write freely...',
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm & Ideas',
    icon: Lightbulb,
    description: 'Generate creative solutions, architectural pathways, and options.',
    placeholder: 'Describe a challenge, vision, or idea you want to explore...',
  },
  {
    id: 'summary',
    label: 'Executive Summary',
    icon: FileText,
    description: 'Distill messy thoughts or meeting notes into a structured summary.',
    placeholder: 'Paste notes, journal drafts, or logs to synthesize...',
  },
  {
    id: 'action_items',
    label: 'Action & Next Steps',
    icon: ListChecks,
    description: 'Extract concrete, prioritized milestones and micro-tasks.',
    placeholder: 'What are your goals or current blockers right now?',
  },
  {
    id: 'chat',
    label: 'Open Dialogue',
    icon: MessageSquare,
    description: 'Interactive multi-turn conversation with Gemini as your thought partner.',
    placeholder: 'Ask a question or continue discussing this reflection...',
  },
];

const INSPIRATION_STARTERS = [
  'What went unexpectedly well today and why?',
  'A difficult decision I am facing and the tradeoffs...',
  'Reflecting on a recent breakthrough or lesson learned',
  'Three things giving me energy versus draining me this week',
  'Brainstorm 5 creative approaches to my current project',
];

export const ReflectionStudio: React.FC<ReflectionStudioProps> = ({
  userId,
  activeEntry,
  onUpdateActiveEntry,
  onDeleteEntry,
  onSaveNotification,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ReflectionMode>(activeEntry?.mode || 'reflection');
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagField, setShowTagField] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkedTakeaways, setCheckedTakeaways] = useState<Record<string, boolean>>({});
  const [isLocating, setIsLocating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync mode when activeEntry changes
  useEffect(() => {
    if (activeEntry?.mode) {
      setSelectedMode(activeEntry.mode);
    }
  }, [activeEntry?.id]);

  // Auto scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeEntry?.messages, isLoading]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleTakeaway = (key: string) => {
    setCheckedTakeaways((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (next[key]) {
        confetti({
          particleCount: 30,
          spread: 45,
          origin: { y: 0.8 },
          colors: ['#F59E0B', '#10B981', '#6366F1'],
        });
      }
      return next;
    });
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const tag = newTagInput.trim().replace(/^#/, '').toLowerCase();
    const currentTags = activeEntry?.tags || [];
    if (!currentTags.includes(tag)) {
      const updatedTags = [...currentTags, tag];
      updateEntryData({ tags: updatedTags });
    }
    setNewTagInput('');
    setShowTagField(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = activeEntry?.tags || [];
    updateEntryData({ tags: currentTags.filter((t) => t !== tagToRemove) });
  };

  const handleTogglePin = () => {
    if (!activeEntry) return;
    updateEntryData({ pinned: !activeEntry.pinned });
  };

  const handleGetLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      if (onSaveNotification) onSaveNotification('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const lat = Number(position.coords.latitude.toFixed(4));
        const lng = Number(position.coords.longitude.toFixed(4));

        // Strict range validation (-90..90 lat, -180..180 lng)
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          if (onSaveNotification) onSaveNotification('Invalid coordinates received from browser.');
          return;
        }

        updateEntryData({ geo: { lat, lng } });
        if (onSaveNotification) onSaveNotification(`Location tagged (${lat}°, ${lng}°)`);
      },
      (error) => {
        setIsLocating(false);
        console.warn('Geolocation acquisition warning:', error?.message || error);
        // Non-blocking graceful notice: saving is never blocked
        if (onSaveNotification) {
          onSaveNotification('Location access denied or unavailable. Reflection continues without geotag.');
        }
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const updateEntryData = async (updates: Partial<ReflectionEntry>) => {
    if (!activeEntry) return;
    const updated: ReflectionEntry = {
      ...activeEntry,
      ...updates,
      updatedAt: Date.now(),
    };
    onUpdateActiveEntry(updated);

    try {
      setSaveError(null);
      await saveReflectionToFirestore(userId, updated);
      if (onSaveNotification) onSaveNotification('Saved to Firestore');
    } catch (err: any) {
      console.error('Failed to update reflection in Firestore:', err);
      setSaveError(err.message || 'Failed to save changes to Firestore.');
    }
  };

  const handleSendPrompt = async (forcedPrompt?: string) => {
    const textToSend = (forcedPrompt || promptInput).trim();
    if (!textToSend || isLoading) return;

    setPromptInput('');
    setSaveError(null);
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode: selectedMode,
    };

    // Prepare current or new entry
    const entryId = activeEntry?.id || `ref_${Date.now()}`;
    const previousMessages = activeEntry?.messages || [];
    const updatedMessages = [...previousMessages, userMessage];

    const currentEntryState: ReflectionEntry = {
      id: entryId,
      userId,
      title: activeEntry?.title || textToSend.slice(0, 40) + '...',
      primaryPrompt: activeEntry?.primaryPrompt || textToSend,
      messages: updatedMessages,
      summary: activeEntry?.summary || '',
      takeaways: activeEntry?.takeaways || [],
      tags: activeEntry?.tags || [],
      geo: activeEntry?.geo,
      mode: selectedMode,
      pinned: activeEntry?.pinned || false,
      createdAt: activeEntry?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onUpdateActiveEntry(currentEntryState);

    try {
      // Call Gemini API through resilient backend endpoint
      const response = await requestGeminiReflection({
        prompt: textToSend,
        mode: selectedMode,
        conversationHistory: updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        tags: currentEntryState.tags,
        title: currentEntryState.title,
      });

      const assistantMessage: ChatMessage = {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: selectedMode,
        takeaways: response.takeaways,
        suggestedQuestions: response.suggestedQuestions,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      const finalEntry: ReflectionEntry = {
        ...currentEntryState,
        title: activeEntry?.title && activeEntry.title !== 'Untitled Reflection' ? activeEntry.title : response.title,
        summary: response.summary,
        takeaways: response.takeaways?.length ? response.takeaways : currentEntryState.takeaways,
        messages: finalMessages,
        updatedAt: Date.now(),
      };

      onUpdateActiveEntry(finalEntry);

      // Persist to isolated Firestore
      await saveReflectionToFirestore(userId, finalEntry);
      if (onSaveNotification) onSaveNotification('Reflection & Takeaways saved');

      // Trigger subtle celebration on first completion
      if (finalMessages.length === 2) {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.7 },
        });
      }
    } catch (err: any) {
      console.error('Gemini reflection error:', err);
      setSaveError(err.message || 'Error communicating with Gemini. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  const activeModeConfig = MODE_DEFINITIONS.find((m) => m.id === selectedMode) || MODE_DEFINITIONS[0];

  return (
    <div className="flex flex-col h-full bg-white text-slate-900 rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
      {/* Studio Header: Title, Tags, Mode Selector, Pin */}
      <div className="p-4 sm:p-5 bg-white border-b border-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Editable Title */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <input
              id="input-reflection-title"
              type="text"
              value={activeEntry?.title || 'Untitled Reflection'}
              onChange={(e) => updateEntryData({ title: e.target.value })}
              className="bg-transparent text-lg sm:text-xl font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 -ml-1 w-full font-serif"
              placeholder="Give your reflection a title..."
            />
            {activeEntry && (
              <button
                onClick={handleTogglePin}
                className={`p-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                  activeEntry.pinned
                    ? 'text-indigo-600 bg-indigo-50 border border-indigo-200'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title={activeEntry.pinned ? 'Pinned reflection' : 'Pin reflection'}
              >
                <Pin className={`w-4 h-4 ${activeEntry.pinned ? 'fill-indigo-600 text-indigo-600' : ''}`} />
              </button>
            )}
          </div>

          {/* Quick Timestamps */}
          {activeEntry && (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date(activeEntry.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>

        {/* Tags Row */}
        <div className="flex flex-wrap items-center gap-2">
          {activeEntry?.tags?.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium"
            >
              #{tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-red-600 text-indigo-400 ml-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {showTagField ? (
            <div className="inline-flex items-center gap-1 bg-white rounded-full px-2 py-0.5 border border-slate-300">
              <span className="text-xs text-slate-400">#</span>
              <input
                id="input-new-tag"
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="tag name"
                className="bg-transparent text-xs text-slate-800 focus:outline-none w-20"
                autoFocus
              />
              <button onClick={handleAddTag} className="text-indigo-600 hover:text-indigo-800">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => setShowTagField(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTagField(true)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-500 hover:text-slate-800 border border-dashed border-slate-300 hover:border-slate-400 transition cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add tag</span>
            </button>
          )}

          {/* Location Geotag Pill / Toggle */}
          {activeEntry?.geo ? (
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium"
              title={`Geotagged: ${activeEntry.geo.lat.toFixed(4)}°, ${activeEntry.geo.lng.toFixed(4)}°`}
            >
              <MapPin className="w-3 h-3 text-emerald-600" />
              <span>{activeEntry.geo.lat.toFixed(2)}°, {activeEntry.geo.lng.toFixed(2)}°</span>
              <button
                onClick={() => updateEntryData({ geo: undefined })}
                className="hover:text-red-600 text-emerald-500 ml-0.5 cursor-pointer"
                title="Remove geotag"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ) : (
            <button
              onClick={handleGetLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-500 hover:text-slate-800 border border-dashed border-slate-300 hover:border-slate-400 transition cursor-pointer disabled:opacity-50"
              title="Tag this reflection with your current geolocation"
            >
              {isLocating ? (
                <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
              ) : (
                <MapPin className="w-3 h-3 text-slate-400" />
              )}
              <span>{isLocating ? 'Locating...' : 'Add location'}</span>
            </button>
          )}
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {MODE_DEFINITIONS.map((m) => {
            const Icon = m.icon;
            const isSelected = selectedMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMode(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold shadow-xs'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-slate-200'
                }`}
                title={m.description}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Save Error Banner with Retry */}
      {saveError && (
        <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-xs flex items-center justify-between gap-2 px-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{saveError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setSaveError(null);
                if (promptInput.trim()) {
                  handleSendPrompt();
                } else if (activeEntry) {
                  updateEntryData({});
                }
              }}
              className="px-2.5 py-1 rounded bg-red-100 text-red-800 hover:bg-red-200 text-[11px] font-medium transition cursor-pointer"
            >
              Retry
            </button>
            <button
              onClick={() => setSaveError(null)}
              className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Messages Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {(!activeEntry || activeEntry.messages.length === 0) ? (
          /* Empty State / Prompting Guidance */
          <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8 space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <activeModeConfig.icon className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-normal text-slate-900 font-serif">
                {activeModeConfig.label}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-sans max-w-md">
                {activeModeConfig.description}
              </p>
            </div>

            {/* Inspiration Prompt Starters */}
            <div className="w-full space-y-2 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono pl-1">
                Prompt Starters
              </p>
              <div className="grid grid-cols-1 gap-2">
                {INSPIRATION_STARTERS.map((starter, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPromptInput(starter);
                      textareaRef.current?.focus();
                    }}
                    className="p-2.5 text-xs text-slate-700 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-left transition flex items-center justify-between group cursor-pointer"
                  >
                    <span>{starter}</span>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Active Multi-Turn Messages */
          <div className="space-y-6 max-w-4xl mx-auto">
            {activeEntry.messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-full sm:max-w-3xl rounded-2xl p-5 space-y-3 shadow-sm ${
                      isUser
                        ? 'bg-slate-100 text-slate-900 border border-slate-200'
                        : 'bg-white text-slate-900 border border-slate-200/90'
                    }`}
                  >
                    {/* Message Header */}
                    <div className="flex items-center justify-between gap-4 text-xs text-slate-400 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        {isUser ? (
                          <span className="font-semibold text-slate-800">You</span>
                        ) : (
                          <span className="font-semibold text-indigo-700 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            ReflectAI (Gemini)
                          </span>
                        )}
                        {msg.mode && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                            {msg.mode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">{msg.timestamp}</span>
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="text-slate-400 hover:text-slate-700 transition cursor-pointer p-1"
                          title="Copy text"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Message Body with React Markdown */}
                    <div className="text-sm text-slate-800 leading-relaxed font-sans prose max-w-none prose-p:my-2 prose-headings:text-slate-900 prose-ul:my-2 prose-li:my-0.5">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>

                    {/* Structured Key Takeaways if available on assistant message */}
                    {msg.takeaways && msg.takeaways.length > 0 && (
                      <div className="mt-4 p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                            Key Takeaways &amp; Action Items
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">Click to track</span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-slate-700">
                          {msg.takeaways.map((item, tIdx) => {
                            const itemKey = `${msg.id}_takeaway_${tIdx}`;
                            const isChecked = checkedTakeaways[itemKey] || false;
                            return (
                              <li
                                key={tIdx}
                                onClick={() => handleToggleTakeaway(itemKey)}
                                className={`flex items-start gap-2.5 p-2 rounded-lg transition cursor-pointer ${
                                  isChecked
                                    ? 'bg-emerald-50 text-emerald-800 line-through opacity-75'
                                    : 'hover:bg-indigo-100/60 text-slate-800'
                                }`}
                              >
                                <span className="mt-0.5 shrink-0 text-indigo-600 font-bold">
                                  {isChecked ? '✓' : '•'}
                                </span>
                                <span>{item}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Suggested Follow-up Questions */}
                    {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                          Suggested Next Inquiries:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {msg.suggestedQuestions.map((q, qIdx) => (
                            <button
                              key={qIdx}
                              onClick={() => handleSendPrompt(q)}
                              disabled={isLoading}
                              className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 border border-slate-200 hover:border-indigo-200 transition text-left cursor-pointer flex items-center gap-1.5 shadow-xs"
                            >
                              <span>"{q}"</span>
                              <Sparkles className="w-3 h-3 text-indigo-600 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs animate-pulse max-w-md shadow-sm">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                <span>ReflectAI is synthesizing your thoughts and structuring insights...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer Area */}
      <div className="p-4 sm:p-5 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="relative rounded-xl bg-slate-50 border border-slate-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-400 transition shadow-inner">
            <textarea
              id="input-reflection-prompt"
              ref={textareaRef}
              rows={3}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeModeConfig.placeholder}
              className="w-full bg-transparent px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none resize-none font-sans"
            />

            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200/60 bg-white/60 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">⌘</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">Enter</kbd> to submit</span>
                <span>• {promptInput.trim().split(/\s+/).filter(Boolean).length} words</span>
              </div>

              <button
                id="btn-submit-reflection"
                onClick={() => handleSendPrompt()}
                disabled={!promptInput.trim() || isLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-indigo-100"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <span>Reflect</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
