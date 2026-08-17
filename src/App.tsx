import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SendHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { sendChatMessage } from "./api";
import { loadConversations, saveConversations } from "./storage";
import type { Conversation, Message } from "./types";

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function newConversation(): Conversation {
  const timestamp = now();
  return {
    id: uid(),
    title: "New conversation",
    messages: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function titleFrom(prompt: string) {
  const clean = prompt.replace(/\s+/g, " ").trim();
  return clean.length > 38 ? `${clean.slice(0, 38)}…` : clean;
}

export default function App() {
  const initial = useMemo(() => loadConversations(), []);
  const [conversations, setConversations] = useState<Conversation[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;
  const filtered = conversations.filter((conversation) =>
    conversation.title.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages, loading]);
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
  }, [input]);

  const openNewChat = () => {
    abortRef.current?.abort();
    setLoading(false);
    setActiveId(null);
    setInput("");
    setMobileSidebarOpen(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const selectConversation = (id: string) => {
    abortRef.current?.abort();
    setLoading(false);
    setActiveId(id);
    setMobileSidebarOpen(false);
  };

  const removeConversation = (id: string) => {
    setConversations((items) => items.filter((item) => item.id !== id));
    if (activeId === id) setActiveId(null);
    setMenuFor(null);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userMessage: Message = {
      id: uid(),
      role: "user",
      content: prompt,
      createdAt: now(),
    };

    let conversation = active;
    if (!conversation) {
      conversation = newConversation();
      conversation.title = titleFrom(prompt);
      conversation.messages = [userMessage];
      setActiveId(conversation.id);
      setConversations((items) => [conversation!, ...items]);
    } else {
      const next: Conversation = {
        ...conversation,
        title: conversation.messages.length ? conversation.title : titleFrom(prompt),
        messages: [...conversation.messages, userMessage],
        updatedAt: now(),
      };
      conversation = next;
      setConversations((items) => [next, ...items.filter((item) => item.id !== next.id)]);
    }

    setInput("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await sendChatMessage(
        prompt,
        conversation.messages,
        controller.signal,
      );
      const assistantMessage: Message = {
        id: uid(),
        role: "assistant",
        content: response,
        createdAt: now(),
      };
      setConversations((items) =>
        items.map((item) =>
          item.id === conversation!.id
            ? { ...item, messages: [...item.messages, assistantMessage], updatedAt: now() }
            : item,
        ),
      );
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        const message: Message = {
          id: uid(),
          role: "assistant",
          content: error instanceof Error ? error.message : "Something went wrong. Please try again.",
          createdAt: now(),
          status: "error",
        };
        setConversations((items) =>
          items.map((item) =>
            item.id === conversation!.id ? { ...item, messages: [...item.messages, message] } : item,
          ),
        );
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="app-shell">
      {mobileSidebarOpen && (
        <button className="mobile-scrim" aria-label="Close sidebar" onClick={() => setMobileSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarOpen ? "" : "is-collapsed"} ${mobileSidebarOpen ? "is-mobile-open" : ""}`}>
        <div className="sidebar-top">
          <button className="brand-button" aria-label="AI chat home" onClick={openNewChat}>
            <span className="brand-mark"><Sparkles size={17} strokeWidth={2.2} /></span>
            <span className="brand-name">AI Chat</span>
          </button>
          <button className="icon-button desktop-collapse" aria-label="Collapse sidebar" onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose size={18} />
          </button>
          <button className="icon-button mobile-close" aria-label="Close sidebar" onClick={() => setMobileSidebarOpen(false)}>
            <X size={19} />
          </button>
        </div>

        <nav className="sidebar-actions" aria-label="Chat actions">
          <button className="nav-button primary" onClick={openNewChat}>
            <MessageSquarePlus size={18} />
            <span>New chat</span>
          </button>
          <button
            className={`nav-button ${searching ? "active" : ""}`}
            onClick={() => {
              setSearching((value) => !value);
              window.setTimeout(() => document.getElementById("history-search")?.focus(), 0);
            }}
          >
            <Search size={18} />
            <span>Search chats</span>
          </button>
        </nav>

        {searching && (
          <div className="search-box">
            <Search size={15} />
            <input
              id="history-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search history"
              aria-label="Search chat history"
            />
            {query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}
          </div>
        )}

        <div className="history">
          <div className="history-label">Chats</div>
          <div className="history-list">
            {filtered.map((conversation) => (
              <div className={`history-row ${conversation.id === activeId ? "selected" : ""}`} key={conversation.id}>
                <button className="history-button" onClick={() => selectConversation(conversation.id)}>
                  <span>{conversation.title}</span>
                </button>
                <button
                  className="history-menu"
                  aria-label={`Options for ${conversation.title}`}
                  onClick={() => setMenuFor(menuFor === conversation.id ? null : conversation.id)}
                >
                  <MoreHorizontal size={17} />
                </button>
                {menuFor === conversation.id && (
                  <div className="context-menu">
                    <button onClick={() => removeConversation(conversation.id)}>
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!filtered.length && (
              <p className="empty-history">{query ? "No matching chats" : "Your chats will appear here"}</p>
            )}
          </div>
        </div>

        <div className="profile">
          <div className="avatar">N</div>
          <div className="profile-copy"><strong>Nazmul Hogue</strong><span>Personal workspace</span></div>
          <MoreHorizontal size={18} />
        </div>
      </aside>

      {!sidebarOpen && (
        <button className="sidebar-reopen icon-button" aria-label="Open sidebar" onClick={() => setSidebarOpen(true)}>
          <PanelLeftOpen size={19} />
        </button>
      )}

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open sidebar" onClick={() => setMobileSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <button className="model-picker">Auto <ChevronDown size={15} /></button>
          <div className="topbar-right">
            <span className="saved-state"><Check size={14} /> Saved locally</span>
            <button className="icon-button" aria-label="More options"><MoreHorizontal size={20} /></button>
          </div>
        </header>

        <section className={`chat-area ${active?.messages.length ? "has-messages" : ""}`}>
          {!active?.messages.length ? (
            <div className="welcome">
              <div className="welcome-icon"><Sparkles size={24} /></div>
              <h1>Hi, what can I help you with?</h1>
              <p>Ask a question, draft content, or work through an idea.</p>
            </div>
          ) : (
            <div className="messages" aria-live="polite">
              {active.messages.map((message) => (
                <article className={`message ${message.role} ${message.status === "error" ? "error" : ""}`} key={message.id}>
                  <div className="message-avatar">
                    {message.role === "assistant" ? <Bot size={18} /> : <UserRound size={18} />}
                  </div>
                  <div className="message-content">
                    <div className="message-role">{message.role === "assistant" ? "AI Chat" : "You"}</div>
                    <p>{message.content}</p>
                  </div>
                </article>
              ))}
              {loading && (
                <article className="message assistant">
                  <div className="message-avatar"><Bot size={18} /></div>
                  <div className="message-content">
                    <div className="message-role">AI Chat</div>
                    <div className="typing" aria-label="AI is responding"><span /><span /><span /></div>
                  </div>
                </article>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <div className="composer-wrap">
          <form className="composer" onSubmit={submit}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder="Message AI Chat"
              aria-label="Message AI Chat"
              rows={1}
            />
            <button className="send-button" type="submit" disabled={!input.trim() || loading} aria-label="Send message">
              <SendHorizontal size={18} />
            </button>
          </form>
          <p className="composer-note">AI can make mistakes. Check important information.</p>
        </div>
      </main>
    </div>
  );
}
