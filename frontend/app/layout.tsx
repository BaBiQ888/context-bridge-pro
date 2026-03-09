import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ContextBridge Pro — PM ↔ RD 沟通翻译助手",
  description:
    "将产品经理的需求描述与工程师的技术实现自动双向翻译，消除跨职能沟通障碍。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={inter.className}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#1a1d2e",
              color: "#e2e8f0",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              fontSize: "14px",
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#1a1d2e" },
              duration: 5000,
            },
          }}
        />
      </body>
    </html>
  );
}
