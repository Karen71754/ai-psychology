import type { Metadata, Viewport } from "next";
import "@neondatabase/auth-ui/css";
import "./globals.css";
import { Providers } from "./providers";

export const viewport: Viewport = {\n  width: "device-width",\n  initialScale: 1,\n  maximumScale: 1,\n  userScalable: false,\n};\n\nexport const metadata: Metadata = {
  title: "AI Psychology — пространство для разговора",
  description: "ИИ-помощник для саморефлексии, эмоциональной поддержки и жизненных трудностей."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><Providers>{children}</Providers></body></html>;
}
