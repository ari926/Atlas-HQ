import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Sparkles, Database, Globe, Loader2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { supabase } from '../../lib/supabase';

/* ─── Types ─── */
type AIMode = 'auto' | 'hq' | 'general';
type ResponseMode = 'hq' | 'general';

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  mode?: ResponseMode;
  timestamp: number;
}

interface Suggestion {
  text: string;
  query: string;
}

const AI_URL = 'https://buqopylxhqdiikzqctkb.supabase.co/functions/v1/atlas-ai';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cW9weWx4aHFkaWlrenFjdGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDI4MTcsImV4cCI6MjA4ODMxODgxN30.25tfyL75wNkkyUKBPsu_1cUiOvbgwtEgKxUp4nbbujc';

const MAX_HISTORY = 5;

/* ─── Component ─── */
export default function AtlasAI() {
  const { searchOpen, setSearchOpen } = useUIStore();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<AIMode>('auto');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  /* ─── Load suggestions from live data ─── */
  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    const items: Suggestion[] = [];
    try {
      // Overdue compliance items
      const { count: overdueCount } = await supabase
        .from('hq_compliance_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Overdue');
      if (overdueCount && overdueCount > 0) {
        items.push({
          text: `${overdueCount} compliance item${overdueCount > 1 ? 's' : ''} overdue`,
          query: `Show me the ${overdueCount} overdue compliance items with their due dates and categories`,
        });
      }

      // Due Soon compliance items
      const { count: dueSoonCount } = await supabase
        .from('hq_compliance_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Due Soon');
      if (dueSoonCount && dueSoonCount > 0) {
        items.push({
          text: `${dueSoonCount} compliance item${dueSoonCount > 1 ? 's' : ''} due soon`,
          query: `What compliance items are due soon? List them with due dates`,
        });
      }

      // Licenses without expiration
      const { count: noExpCount } = await supabase
        .from('hq_licenses')
        .select('*', { count: 'exact', head: true })
        .is('expiration_date', null);
      if (noExpCount && noExpCount > 0) {
        items.push({
          text: `${noExpCount} license${noExpCount > 1 ? 's' : ''} missing expiration date`,
          query: `Which licenses have no expiration date set? List them by state`,
        });
      }

      // Licenses expiring within 60 days
      const sixtyDaysOut = new Date();
      sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60);
      const { count: expiringCount } = await supabase
        .from('hq_licenses')
        .select('*', { count: 'exact', head: true })
        .lte('expiration_date', sixtyDaysOut.toISOString().split('T')[0])
        .gte('expiration_date', new Date().toISOString().split('T')[0]);
      if (expiringCount && expiringCount > 0) {
        items.push({
          text: `${expiringCount} license${expiringCount > 1 ? 's' : ''} expiring within 60 days`,
          query: `Show me licenses expiring in the next 60 days with renewal dates`,
        });
      }

      // Employee count
      const { count: empCount } = await supabase
        .from('hq_employees')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Active');
      if (empCount && empCount > 0) {
        items.push({
          text: `${empCount} active employee${empCount > 1 ? 's' : ''}`,
          query: `Give me a summary of all active employees by department and role`,
        });
      }

      // Fallback suggestions
      if (items.length === 0) {
        items.push(
          { text: 'Show compliance overview', query: 'Give me an overview of our compliance status across all states' },
          { text: 'License summary', query: 'Summarize our active licenses by state and type' },
          { text: 'HR summary', query: 'How many employees do we have and what are their roles?' },
        );
      }
    } catch {
      items.push(
        { text: 'Compliance overview', query: 'Give me an overview of our compliance status' },
        { text: 'License summary', query: 'Summarize our active licenses' },
      );
    }
    setSuggestions(items);
    setSuggestionsLoading(false);
  }, []);

  /* ─── Effects ─── */
  useEffect(() => {
    if (searchOpen) {
      loadSuggestions();
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [searchOpen, loadSuggestions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Global CMD+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen, setSearchOpen]);

  /* ─── Submit ─── */
  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = { role: 'user', content: trimmed, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setQuery('');
      setLoading(true);

      // Build history from last N exchanges
      const history = messages
        .reduce<Array<{ question: string; answer: string }>>((acc, msg, i, arr) => {
          if (msg.role === 'user' && arr[i + 1]?.role === 'ai') {
            acc.push({ question: msg.content, answer: arr[i + 1].content });
          }
          return acc;
        }, [])
        .slice(-MAX_HISTORY);

      try {
        const res = await fetch(AI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({
            question: trimmed,
            history,
            mode: mode === 'auto' ? undefined : mode,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const aiMsg: ChatMessage = {
          role: 'ai',
          content: data.answer || 'No response received.',
          mode: data.mode || 'general',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        const aiMsg: ChatMessage = {
          role: 'ai',
          content: `Sorry, I could not process that request. ${errMsg}`,
          mode: 'general',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, mode],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(query);
    }
    if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      setSearchOpen(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
  };

  /* ─── Render ─── */
  if (!searchOpen) return null;

  const hasMessages = messages.length > 0;

  return (
    <div className="ai-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="ai-modal">
        {/* Header */}
        <div className="ai-header">
          <div className="ai-header-left">
            <Sparkles size={18} className="ai-logo-icon" />
            <span className="ai-header-title">Atlas AI</span>
          </div>
          <div className="ai-header-right">
            {hasMessages && (
              <button className="ai-clear-btn" onClick={clearHistory}>
                Clear
              </button>
            )}
            <button className="ai-close-btn" onClick={() => setSearchOpen(false)}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="ai-modes">
          <button
            className={`ai-mode-btn ${mode === 'auto' ? 'active' : ''}`}
            onClick={() => setMode('auto')}
          >
            <Sparkles size={13} />
            Auto
          </button>
          <button
            className={`ai-mode-btn ${mode === 'hq' ? 'active' : ''}`}
            onClick={() => setMode('hq')}
          >
            <Database size={13} />
            HQ Data
          </button>
          <button
            className={`ai-mode-btn ${mode === 'general' ? 'active' : ''}`}
            onClick={() => setMode('general')}
          >
            <Globe size={13} />
            General
          </button>
        </div>

        {/* Messages area */}
        <div className="ai-messages">
          {!hasMessages && (
            <div className="ai-empty">
              <div className="ai-empty-icon">
                <Sparkles size={32} />
              </div>
              <h3 className="ai-empty-title">Ask Atlas AI anything</h3>
              <p className="ai-empty-subtitle">
                Query your HQ data, compliance status, licenses, employees, or ask general questions.
              </p>

              {/* Suggestions */}
              <div className="ai-suggestions">
                {suggestionsLoading ? (
                  <div className="ai-suggestions-loading">
                    <Loader2 size={14} className="ai-spinner" />
                    <span>Loading suggestions...</span>
                  </div>
                ) : (
                  suggestions.map((s, i) => (
                    <button
                      key={i}
                      className="ai-suggestion"
                      onClick={() => submit(s.query)}
                    >
                      {s.text}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`ai-msg ai-msg-${msg.role}`}>
              {msg.role === 'ai' && (
                <div className="ai-msg-header">
                  <span className={`ai-mode-badge ai-mode-badge-${msg.mode}`}>
                    {msg.mode === 'hq' ? (
                      <>
                        <Database size={11} /> HQ
                      </>
                    ) : (
                      <>
                        <Globe size={11} /> General
                      </>
                    )}
                  </span>
                </div>
              )}
              <div className="ai-msg-content">{msg.content}</div>
            </div>
          ))}

          {loading && (
            <div className="ai-msg ai-msg-ai ai-msg-loading">
              <div className="ai-msg-header">
                <Loader2 size={14} className="ai-spinner" />
                <span className="ai-thinking-text">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="ai-input-area">
          <div className="ai-input-row">
            <input
              ref={inputRef}
              type="text"
              className="ai-input"
              placeholder="Ask a question..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className="ai-send-btn"
              onClick={() => submit(query)}
              disabled={!query.trim() || loading}
            >
              {loading ? <Loader2 size={16} className="ai-spinner" /> : <Send size={16} />}
            </button>
          </div>
          <div className="ai-input-hints">
            <span>
              <kbd>Enter</kbd> send
            </span>
            <span>
              <kbd>Esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
