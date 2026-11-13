"use client";

import { FormEvent, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
const welcome: Message = { role: "assistant", content: "Привет. Я здесь, чтобы внимательно тебя выслушать и помочь разобраться в том, что происходит.\n\nМожешь начать с любого места: что сейчас больше всего занимает твои мысли?" };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages); setInput(""); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: nextMessages.slice(1) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось отправить сообщение.");
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch (err) { setError(err instanceof Error ? err.message : "Что-то пошло не так."); }
    finally { setLoading(false); }
  }

  return <main className="shell">
    <header className="topbar"><a className="brand" href="#top" aria-label="AI Psychology — главная"><span className="brand-mark">ψ</span><span>AI <b>Psychology</b></span></a><span className="top-note">Пространство для разговора</span></header>
    <section className="hero" id="top"><div className="eyebrow"><span className="pulse" /> ВНИМАНИЕ · ПОНИМАНИЕ · ДВИЖЕНИЕ ВПЕРЁД</div><h1>Иногда важно,<br/><em>чтобы тебя услышали.</em></h1><p className="intro">Спокойное пространство, где можно разобраться в мыслях, чувствах и непростых жизненных ситуациях — без осуждения и спешки.</p></section>
    <section className="chat-card" aria-label="Чат с ИИ-помощником"><div className="chat-heading"><div className="avatar">ψ</div><div><strong>Твой собеседник</strong><span>Готов внимательно выслушать</span></div><span className="online"><i/> онлайн</span></div>
      <div className="messages" aria-live="polite">{messages.map((message,index)=><div className={`message-row ${message.role}`} key={`${index}-${message.role}`}>{message.role==="assistant"&&<div className="mini-avatar">ψ</div>}<div className="bubble">{message.content}</div></div>)}{loading&&<div className="message-row assistant"><div className="mini-avatar">ψ</div><div className="bubble typing">Думаю…</div></div>}</div>
      {error&&<p className="error" role="alert">{error}</p>}<form className="composer" onSubmit={sendMessage}><textarea value={input} onChange={event=>setInput(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();event.currentTarget.form?.requestSubmit();}}} placeholder="Расскажи, что у тебя на душе…" rows={2} maxLength={6000} aria-label="Твоё сообщение"/><button type="submit" disabled={loading||!input.trim()} aria-label="Отправить сообщение">↑</button></form><div className="composer-hint">Enter — отправить · Shift + Enter — новая строка</div>
    </section><p className="notice">AI Psychology — ИИ-помощник для эмоциональной поддержки и саморефлексии, не замена квалифицированной психологической или медицинской помощи. При непосредственной опасности обратись в местную экстренную службу.</p><footer>Тебе не обязательно разбираться во всём прямо сейчас.</footer>
  </main>;
}
