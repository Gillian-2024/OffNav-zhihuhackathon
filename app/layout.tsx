import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OffNav — 知乎求职导航",
  description: "把知乎的经验长文，按权威度重排成一条带证据链的求职路径",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
