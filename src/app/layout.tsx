import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Psychology — пространство для разговора",
  description: "ИИ-помощник для саморефлексии, эмоциональной поддержки и жизненных трудностей."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
