import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // 部署后在环境变量里设置 NEXT_PUBLIC_SITE_URL（如 https://fate.example.com），OG 预览图才能解析为绝对地址
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
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
