import { NextRequest, NextResponse } from "next/server";
import { PSYCHOLOGY_SYSTEM_PROMPT } from "@/lib/prompts";

export const runtime = "nodejs";
const MAX_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 6000;
type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "На сервере не настроен GEMINI_API_KEY." }, { status: 503 });
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

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: PSYCHOLOGY_SYSTEM_PROMPT }],
          },
          contents: messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: {
            maxOutputTokens: 1100,
            temperature: 0.7,
          },
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const providerError = await response.json().catch(() => null);
      const providerMessage =
        typeof providerError?.error?.message === "string" ? providerError.error.message : "";
      console.error("Gemini API request failed", {
        status: response.status,
        statusText: response.statusText,
        reason: providerError?.error?.status,
      });
      const safeMessage = response.status === 429
        ? "Бесплатный лимит запросов временно исчерпан. Попробуй позже."
        : response.status === 400 || response.status === 403 || response.status === 404
          ? "Google Gemini отклонил запрос. Проверь API-ключ, доступ к модели и настройки проекта."
          : "Сервис ИИ временно недоступен. Попробуй ещё раз позже.";
      return NextResponse.json({ error: safeMessage }, { status: 502 });
    }

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();

    return NextResponse.json({
      reply: reply || "Я здесь. Можешь рассказать немного подробнее?",
    });
  } catch (error) {
    console.error("Chat API error", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Не удалось получить ответ. Попробуй ещё раз." },
      { status: 500 },
    );
  }
}
