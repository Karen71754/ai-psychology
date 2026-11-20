import type { Metadata, Viewport } from "next";
import "@neondatabase/auth-ui/css";
import "./globals.css";
import { Providers } from "./providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "AI Psychology — пространство для разговора",
  description: "ИИ-помощник для саморефлексии, эмоциональной поддержки и жизненных трудностей.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><Providers>{children}</Providers></body></html>;
}
