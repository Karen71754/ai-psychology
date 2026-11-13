"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

type Message = { role: "user" | "assistant"; content: string };
type Chat = { id: string; profileId: string; title: string; messages: Message[]; updatedAt: number };
type Profile = { id: string; name: string };

const welcome: Message = {
  role: "assistant",
  content: "Привет! Я ИИ-собеседник. Здесь можно спокойно поговорить — о том, что тревожит, радует или просто крутится в голове.\n\nС чего начнём?",
};
const CHAT_KEY = "ai-psychology-chats-v1";
const PROFILE_KEY = "ai-psychology-profiles-v1";
const ACTIVE_PROFILE_KEY = "ai-psychology-active-profile-v1";

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function makeChat(profileId: string): Chat {
  return { id: makeId(), profileId, title: "Новый чат", messages: [welcome], updatedAt: Date.now() };
}

export default function Home() {
  const router = useRouter();
  const { data: session, isPending: authPending } = authClient.useSession();
  const [profiles, setProfiles] = useState<Profile[]>([{ id: "local-main", name: "Мой профиль" }]);
  const [activeProfileId, setActiveProfileId] = useState("local-main");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const savedProfiles = localStorage.getItem(PROFILE_KEY);
      const parsedProfiles = savedProfiles ? JSON.parse(savedProfiles) as Profile[] : null;
      const nextProfiles = parsedProfiles?.length ? parsedProfiles : [{ id: "local-main", name: "Мой профиль" }];
      const savedActive = localStorage.getItem(ACTIVE_PROFILE_KEY);
      const nextActive = nextProfiles.some((profile) => profile.id === savedActive) ? savedActive! : nextProfiles[0].id;
      const savedChats = localStorage.getItem(CHAT_KEY);
      const parsedChats = savedChats ? JSON.parse(savedChats) as Chat[] : [];
      const validChats = Array.isArray(parsedChats) ? parsedChats.filter((chat) =>
        chat && typeof chat.id === "string" && typeof chat.profileId === "string" && Array.isArray(chat.messages)
      ) : [];
      const profileChats = validChats.filter((chat) => chat.profileId === nextActive).sort((a, b) => b.updatedAt - a.updatedAt);
      const initialChats = profileChats.length ? validChats : [...validChats, makeChat(nextActive)];
      setProfiles(nextProfiles);
      setActiveProfileId(nextActive);
      setChats(initialChats);
      setActiveChatId(profileChats[0]?.id || initialChats[initialChats.length - 1].id);
    } catch {
      const initial = makeChat("local-main");
      setChats([initial]);
      setActiveChatId(initial.id);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
    localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
  }, [chats, profiles, activeProfileId, hydrated]);

  const visibleChats = useMemo(
    () => chats.filter((chat) => chat.profileId === activeProfileId).sort((a, b) => b.updatedAt - a.updatedAt),
    [chats, activeProfileId],
  );
  const activeChat = visibleChats.find((chat) => chat.id === activeChatId) || visibleChats[0];
  const messages = activeChat?.messages || [welcome];
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  function createNewChat() {
    const chat = makeChat(activeProfileId);
    setChats((current) => [...current, chat]);
    setActiveChatId(chat.id);
    setInput("");
    setError("");
    setSidebarOpen(false);
  }

  function switchProfile(profileId: string) {
    if (profileId === activeProfileId) {
      setProfileOpen(false);
      return;
    }
    const targetChat = chats.filter((chat) => chat.profileId === profileId).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const chat = targetChat || makeChat(profileId);
    if (!targetChat) setChats((current) => [...current, chat]);
    setActiveProfileId(profileId);
    setActiveChatId(chat.id);
    setProfileOpen(false);
    setSidebarOpen(false);
    setInput("");
    setError("");
  }

  function addProfile() {
    const name = window.prompt("Как назвать дополнительный профиль на этом устройстве?");
    if (!name?.trim()) return;
    const profile = { id: makeId(), name: name.trim().slice(0, 32) };
    const chat = makeChat(profile.id);
    setProfiles((current) => [...current, profile]);
    setChats((current) => [...current, chat]);
    setActiveProfileId(profile.id);
    setActiveChatId(chat.id);
    setProfileOpen(false);
    setInput("");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading || !activeChat) return;
    const nextMessages: Message[] = [...activeChat.messages, { role: "user", content: text }];
    setChats((current) => current.map((chat) => chat.id === activeChat.id ? {
      ...chat,
      title: chat.title === "Новый чат" ? text.slice(0, 34) + (text.length > 34 ? "…" : "") : chat.title,
      messages: nextMessages,
      updatedAt: Date.now(),
    } : chat));
    setInput("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(1) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось отправить сообщение.");
      setChats((current) => current.map((chat) => chat.id === activeChat.id ? {
        ...chat,
        messages: [...nextMessages, { role: "assistant", content: data.reply }],
        updatedAt: Date.now(),
      } : chat));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-layout">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Закрыть меню" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <a className="brand" href="#top"><span className="brand-mark">ψ</span><span>AI <b>Psychology</b></span></a>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Закрыть меню">×</button>
        </div>
        <button className="new-chat-button" onClick={createNewChat}><span>＋</span> Новый чат</button>
        <div className="history-label">ИСТОРИЯ</div>
        <div className="chat-history">
          {visibleChats.length === 0 ? <p className="empty-history">Здесь появятся твои разговоры</p> : visibleChats.map((chat) => (
            <button key={chat.id} className={`history-item ${chat.id === activeChat?.id ? "history-active" : ""}`} onClick={() => { setActiveChatId(chat.id); setSidebarOpen(false); setError(""); }}>
              <span className="history-icon">◷</span><span className="history-title">{chat.title}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="profile-menu-wrap">
            {profileOpen && <div className="profile-popover">
              <div className="popover-heading">Твой аккаунт</div>\n              <p className="account-email">{session.user.email}</p>
              {profiles.map((profile) => (
                <button key={profile.id} className="profile-option" onClick={() => switchProfile(profile.id)}>
                  <span className="profile-avatar small">{profile.name.slice(0, 1).toUpperCase()}</span>
                  <span>{profile.name}</span>
                  {profile.id === activeProfileId && <span className="profile-check">✓</span>}
                </button>
              ))}
              <div className="popover-divider" />
              <button className="profile-option add-profile" onClick={addProfile}><span className="add-profile-icon">＋</span> Добавить профиль</button>
              <p className="local-profile-note">Это локальные профили. Настоящий вход в аккаунт пока не подключён.</p>
            </div>}
            <button className="profile-button" onClick={() => setProfileOpen((open) => !open)}>
              <span className="profile-avatar">{(activeProfile?.name || "М").slice(0, 1).toUpperCase()}</span>
              <span className="profile-meta"><strong>{session.user.name || session.user.email}</strong><small>Аккаунт AI Psychology</small></span>
              <span className="profile-dots">•••</span>
            </button>
          </div>
        </div>
      </aside>

      <section className="main-panel" id="top">
        <header className="main-topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Открыть историю">☰</button>
          <div className="mobile-brand">AI <b>Psychology</b></div>
          <div className="topbar-status"><span className="status-dot" /> ИИ-собеседник</div>
          <button className="top-new-chat" onClick={createNewChat}>＋ <span>Новый чат</span></button>
        </header>
        <div className="conversation-area">
          <div className="conversation-heading">
            <div className="assistant-avatar">ψ</div>
            <div><strong>Твой собеседник</strong><span>Место, где можно быть собой</span></div>
          </div>
          <div className="messages" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`message-row ${message.role}`} key={`${activeChat?.id}-${index}-${message.role}`}>
                {message.role === "assistant" && <div className="mini-avatar">ψ</div>}
                <div className="bubble">{message.content}</div>
              </div>
            ))}
            {loading && <div className="message-row assistant"><div className="mini-avatar">ψ</div><div className="bubble typing">Подбираю слова…</div></div>}
            <div ref={messagesEndRef} />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="composer-wrap">
            <form className="composer" onSubmit={sendMessage}>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
              }} placeholder="Напиши, что у тебя на уме…" rows={2} maxLength={6000} aria-label="Твоё сообщение" />
              <button type="submit" disabled={loading || !input.trim()} aria-label="Отправить сообщение">↑</button>
            </form>
            <div className="composer-hint">Enter — отправить · Shift + Enter — новая строка</div>
            <p className="notice">AI Psychology — ИИ-помощник для эмоциональной поддержки и саморефлексии, не замена квалифицированной психологической или медицинской помощи. При непосредственной опасности обратись в местную экстренную службу.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
