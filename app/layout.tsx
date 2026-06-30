import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fate — Social Matching",
  description: "Birth data becomes a language for understanding connection.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
