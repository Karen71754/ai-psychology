import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { PSYCHOLOGY_SYSTEM_PROMPT } from "@/lib/prompts";

export const runtime = "nodejs";
const MAX_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 6000;
type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "На сервере не настроен GROQ_API_KEY." }, { status: 503 });
    }
    const body = await request.json();
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "Добавь сообщение, чтобы начать разговор." }, { status: 400 });
    }
    const messages: ChatMessage[] = body.messages
      .slice(-MAX_MESSAGES)
      .filter((item: unknown): item is ChatMessage => {
        if (!item || typeof item !== "object") return false;
        const value = item as Record<string, unknown>;
        return (value.role === "user" || value.role === "assistant") && typeof value.content === "string";
      })
      .map((item: ChatMessage) => ({
        role: item.role,
        content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH),
      }))
      .filter((item: ChatMessage) => item.content.length > 0);

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return NextResponse.json({ error: "Последнее сообщение должно быть сообщением пользователя." }, { status: 400 });
    }

    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
    const response = await client.responses.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      instructions: PSYCHOLOGY_SYSTEM_PROMPT,
      input: messages.map((message) => ({ role: message.role, content: message.content })),
      max_output_tokens: 1100,
      store: false,
    });
    return NextResponse.json({ reply: response.output_text || "Я здесь. Можешь рассказать немного подробнее?" });
  } catch (error) {
    console.error("Chat API error", error);
    return NextResponse.json({ error: "Не удалось получить ответ. Проверь настройки API и попробуй ещё раз." }, { status: 500 });
  }
}
