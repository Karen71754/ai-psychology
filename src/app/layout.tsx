import type { Metadata } from "next";
import "@neondatabase/auth-ui/css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "AI Psychology — пространство для разговора",
  description: "ИИ-помощник для саморефлексии, эмоциональной поддержки и жизненных трудностей."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><Providers>{children}</Providers></body></html>;
}
