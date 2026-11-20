"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

type Message = { role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number; pinned?: boolean; archived?: boolean };
const STORAGE_KEY = "ai-psychology-chats-v3";
const welcome: Message = { role: "assistant", content: "Привет. Это пространство, где можно выдохнуть, разобраться в мыслях и поговорить без осуждения.\n\nЧто сейчас у тебя на уме?" };
const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const makeChat = (): Chat => ({ id: makeId(), title: "Новый чат", messages: [welcome], updatedAt: Date.now() });
const day = (value: number) => new Date(value).toLocaleDateString("ru-RU");

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [menuId, setMenuId] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [archivedView, setArchivedView] = useState(false);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { if (!isPending && !session) router.replace("/auth/sign-in"); }, [isPending, session, router]);
  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as Chat[];
      const valid = Array.isArray(parsed) ? parsed.filter(c => c && typeof c.id === "string" && Array.isArray(c.messages)) : [];
      const list = valid.length ? valid : [makeChat()];
      setChats(list);
      setActiveId(list.find(c => !c.archived)?.id || list[0].id);
    } catch { const c = makeChat(); setChats([c]); setActiveId(c.id); }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); }, [chats, ready]);
  const active = chats.find(c => c.id === activeId) || chats.find(c => !c.archived) || chats[0];
  const messages = active?.messages || [welcome];
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);

  const filtered = useMemo(() => chats.filter(c => (archivedView ? c.archived : !c.archived) && c.title.toLowerCase().includes(search.toLowerCase())).sort((a,b) => Number(!!b.pinned)-Number(!!a.pinned) || b.updatedAt-a.updatedAt), [chats, search, archivedView]);
  const groups = useMemo(() => {
    const today = day(Date.now()), yesterday = day(Date.now()-86400000);
    return [
      { title: "Закреплённые", items: filtered.filter(c=>c.pinned) },
      { title: "Сегодня", items: filtered.filter(c=>!c.pinned && day(c.updatedAt)===today) },
      { title: "Вчера", items: filtered.filter(c=>!c.pinned && day(c.updatedAt)===yesterday) },
      { title: "Предыдущие", items: filtered.filter(c=>!c.pinned && day(c.updatedAt)!==today && day(c.updatedAt)!==yesterday) },
    ].filter(g=>g.items.length);
  }, [filtered]);

  function patchChat(id: string, patch: Partial<Chat>) { setChats(prev=>prev.map(c=>c.id===id?{...c,...patch}:c)); }
  function newChat() { const c=makeChat(); setChats(prev=>[c,...prev]); setActiveId(c.id); setInput(""); setError(""); setSearch(""); setArchivedView(false); setMobileOpen(false); }
  function rename(c: Chat) { const title=window.prompt("Название чата",c.title); if(title?.trim()) patchChat(c.id,{title:title.trim().slice(0,80)}); setMenuId(""); }
  function remove(c: Chat) {
    if(!window.confirm(`Удалить «${c.title}»? Это действие нельзя отменить.`)) return;
    const rest=chats.filter(x=>x.id!==c.id);
    if(!rest.length){const fresh=makeChat();setChats([fresh]);setActiveId(fresh.id);}
    else {setChats(rest);if(activeId===c.id)setActiveId(rest.find(x=>!x.archived)?.id||rest[0].id);}
    setMenuId("");
  }
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const text=input.trim();
    if(!text||loading||!active) return;
    const chatId=active.id;
    const next=[...active.messages,{role:"user" as const,content:text}];
    const title=active.title==="Новый чат"?text.slice(0,42)+(text.length>42?"…":""):active.title;
    patchChat(chatId,{messages:next,title,updatedAt:Date.now()}); setInput("");setError("");setLoading(true);
    const controller=new AbortController();abortRef.current=controller;
    try {
      const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:next.slice(1)}),signal:controller.signal});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Не удалось получить ответ.");
      setChats(prev=>prev.map(c=>c.id===chatId?{...c,messages:[...next,{role:"assistant",content:data.reply}],updatedAt:Date.now()}:c));
    } catch(err) {
      if(err instanceof Error && err.name==="AbortError") return;
      setError(err instanceof Error?err.message:"Произошла ошибка. Попробуй ещё раз.");
    } finally {setLoading(false);abortRef.current=null;}
  }
  function stop(){abortRef.current?.abort();setLoading(false);}
  function copy(text:string){navigator.clipboard?.writeText(text).catch(()=>{});}

  if(isPending||!session) return <main className="auth-loading"><img src="/icon.svg" width="52" height="52" alt=""/><p>Открываем твоё пространство…</p></main>;

  return <main className="app-shell">
    {mobileOpen&&<button className="mobile-scrim" aria-label="Закрыть меню" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`sidebar ${mobileOpen?"sidebar-open":""}`}>
      <div className="sidebar-head"><a className="brand" href="#top"><img src="/icon.svg" alt=""/><span>AI <b>Psychology</b></span></a><button className="icon-btn mobile-close" onClick={()=>setMobileOpen(false)} aria-label="Закрыть меню">×</button></div>
      <button className="new-chat" onClick={newChat}><span>＋</span> Новый чат <kbd>Ctrl K</kbd></button>
      <label className="search-box"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по чатам" aria-label="Поиск по чатам"/></label>
      <button className={`archive-toggle ${archivedView?"selected":""}`} onClick={()=>setArchivedView(v=>!v)}>{archivedView?"← Все чаты":"▣ Архив"}</button>
      <div className="history-scroll">
        {groups.length?groups.map(g=><section className="history-group" key={g.title}><div className="group-title">{g.title}</div>{g.items.map(c=><div className={`chat-entry ${active?.id===c.id?"active":""}`} key={c.id}>
          <button className="chat-select" onClick={()=>{setActiveId(c.id);setMobileOpen(false);setError("");}}><span className="chat-glyph">◌</span><span className="chat-name">{c.title}</span></button>
          <button className="chat-more" onClick={()=>setMenuId(menuId===c.id?"":c.id)} aria-label="Действия с чатом">•••</button>
          {menuId===c.id&&<div className="chat-menu"><button onClick={()=>{patchChat(c.id,{pinned:!c.pinned});setMenuId("");}}>{c.pinned?"Открепить":"Закрепить"}</button><button onClick={()=>rename(c)}>Переименовать</button><button onClick={()=>{patchChat(c.id,{archived:!c.archived});setMenuId("");if(activeId===c.id){const next=chats.find(x=>x.id!==c.id&&!x.archived);if(next)setActiveId(next.id);}}}>{c.archived?"Вернуть из архива":"В архив"}</button><button className="danger" onClick={()=>remove(c)}>Удалить</button></div>}
        </div>)}</section>):<div className="no-chats">{search?"Ничего не найдено":"Здесь появятся твои разговоры"}</div>}
      </div>
      <div className="sidebar-footer"><div className="user-chip"><span className="user-avatar">{(session.user.name||session.user.email||"A").slice(0,1).toUpperCase()}</span><span className="user-meta"><b>{session.user.name||"Мой аккаунт"}</b><small>{session.user.email}</small></span><button className="logout" title="Выйти" onClick={()=>authClient.signOut().then(()=>router.replace("/auth/sign-in"))}>↗</button></div></div>
    </aside>
    <section className="main" id="top">
      <header className="topbar"><button className="icon-btn mobile-open" onClick={()=>setMobileOpen(true)} aria-label="Открыть меню">☰</button><div className="top-brand"><img src="/icon.svg" alt=""/><span>Тихое место для важных мыслей</span></div><div className="top-actions"><span className="online-dot"/> На связи <button className="top-new" onClick={newChat}>＋ Новый чат</button></div></header>
      <div className="conversation">
        <div className="conversation-title"><div className="assistant-mark"><img src="/icon.svg" alt="AI Psychology"/></div><div><h1>{active?.title==="Новый чат"?"Рад, что ты здесь":active?.title}</h1><p>AI Psychology <span>·</span> пространство без осуждения</p></div></div>
        <div className="messages" aria-live="polite">{messages.map((m,i)=><div className={`message-line ${m.role}`} key={`${active?.id}-${i}`}><div className="message-avatar">{m.role==="assistant"?<img src="/icon.svg" alt="AI"/>:<span>{(session.user.name||session.user.email||"Я").slice(0,1).toUpperCase()}</span>}</div><div className="message-content"><div className="message-author">{m.role==="assistant"?"AI Psychology":"Ты"}</div><div className="message-text">{m.content}</div><div className="message-tools"><button onClick={()=>copy(m.content)}>Копировать</button></div></div></div>)}{loading&&<div className="message-line assistant"><div className="message-avatar"><img src="/icon.svg" alt="AI"/></div><div className="message-content"><div className="message-author">AI Psychology</div><div className="message-text typing"><i/><i/><i/> Думаю над ответом…</div></div></div>}<div ref={endRef}/></div>
        {error&&<div className="error-banner" role="alert">{error}</div>}
        <div className="composer-area"><form className="composer" onSubmit={send}><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit();}}} placeholder="Расскажи, что у тебя на душе…" rows={1} maxLength={6000} aria-label="Сообщение"/>{loading?<button type="button" className="stop-btn" onClick={stop} aria-label="Остановить ответ">■</button>:<button type="submit" disabled={!input.trim()} aria-label="Отправить">↑</button>}</form><div className="composer-bottom"><span>Enter — отправить · Shift + Enter — новая строка</span><span>{input.length}/6000</span></div><p className="disclaimer">AI Psychology — ИИ-помощник для эмоциональной поддержки и саморефлексии, не замена профессиональной помощи.</p></div>
      </div>
    </section>
  </main>;
}
