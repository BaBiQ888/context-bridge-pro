"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import { translateStream, ApiError, Direction } from "@/lib/api";
import {
  ArrowLeftRight,
  Loader2,
  Copy,
  Check,
  WifiOff,
  Briefcase,
  Code2,
  Zap,
} from "lucide-react";

const DIRECTIONS: { value: Direction; label: string; from: string; to: string }[] = [
  { value: "pm2rd", label: "PM → 工程师", from: "产品需求", to: "技术规格" },
  { value: "rd2pm", label: "工程师 → PM", from: "技术描述", to: "产品文档" },
];

const PLACEHOLDERS: Record<Direction, string> = {
  pm2rd: "在此粘贴产品需求描述...\n\n例如：我们需要一个智能推荐功能，根据用户的历史行为，在首页展示个性化内容，提升用户留存率。",
  rd2pm: "在此粘贴技术描述...\n\n例如：基于协同过滤算法实现推荐系统，采用 Redis 缓存热点数据，通过 Kafka 异步处理用户行为事件，P95 延迟控制在 100ms 内。等",
};

export default function HomePage() {
  const [direction, setDirection] = useState<Direction>("pm2rd");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Ref for auto-scroll to bottom during streaming
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll output panel to bottom whenever new chunks arrive
  useEffect(() => {
    if (streaming && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, streaming]);

  const currentDir = DIRECTIONS.find((d) => d.value === direction)!;

  const handleTranslate = useCallback(async () => {
    if (!input.trim()) {
      toast.error("请先输入需要翻译的内容");
      return;
    }

    // Abort any ongoing stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setStreaming(true);
    setOutput("");

    try {
      await translateStream(
        input,
        direction,
        (chunk) => {
          console.log('[page] chunk received, length:', chunk.length, 'preview:', chunk.substring(0, 20));
          setOutput((prev) => prev + chunk);
        },
        () => {
          setLoading(false);
          setStreaming(false);
          toast.success("翻译完成", { icon: "✨", duration: 2000 });
        },
        (code, message) => {
          setLoading(false);
          setStreaming(false);
          handleApiError(code, message);
        },
        controller.signal
      );
    } catch (err) {
      setLoading(false);
      setStreaming(false);

      if (err instanceof ApiError) {
        handleApiError(err.code, err.message);
      } else if (err instanceof Error && err.name === "AbortError") {
        // User cancelled
      } else {
        toast.error("网络连接失败，请检查后端服务是否已启动", {
          icon: <WifiOff size={16} />,
        });
      }
    }
  }, [input, direction]);

  const handleApiError = (code: string, message: string) => {
    const messages: Record<string, string> = {
      token_limit_exceeded: "📏 输入内容过长，请缩短后重试",
      invalid_api_key: "🔑 API Key 无效或已过期，请检查后端配置",
      rate_limit_exceeded: "⏱️ 请求过于频繁，请稍后再试",
      quota_exceeded: "💳 API 额度已耗尽，请检查账单设置",
    };
    toast.error(messages[code] || `翻译失败：${message}`, { duration: 6000 });
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setLoading(false);
    setStreaming(false);
  };

  return (
    <div className="relative min-h-screen z-10">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/20 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">ContextBridge Pro</h1>
              <p className="text-xs text-slate-500">PM ↔ RD 沟通翻译助手</p>
            </div>
          </div>

          {/* Direction switcher */}
          <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/5">
            {DIRECTIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => { setDirection(d.value); setOutput(""); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${direction === d.value
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
              >
                {d.value === "pm2rd" ? <Briefcase size={14} /> : <Code2 size={14} />}
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Direction context banner */}
        <div className="mb-6 flex items-center gap-3 text-sm text-slate-400">
          <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
            {currentDir.from}
          </span>
          <ArrowLeftRight size={14} className="text-slate-600" />
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
            {currentDir.to}
          </span>
          <span className="ml-2 flex items-center gap-1 text-indigo-400">
            <Zap size={12} />
            流式输出
          </span>
        </div>

        {/* Dual-panel layout — fixed height, internal scroll */}
        <div className="grid grid-cols-2 gap-6 h-[calc(100vh-220px)]">
          {/* Left panel — Input */}
          <div
            className="rounded-2xl border flex flex-col overflow-hidden transition-all duration-300"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                {direction === "pm2rd" ? <Briefcase size={14} className="text-indigo-400" /> : <Code2 size={14} className="text-indigo-400" />}
                {currentDir.from}
              </span>
              <span className="text-xs text-slate-500">{input.length} 字</span>
            </div>
            <textarea
              className="flex-1 resize-none bg-transparent p-5 text-slate-300 placeholder:text-slate-600 focus:outline-none text-sm leading-relaxed"
              placeholder={PLACEHOLDERS[direction]}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
            />
            <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => { setInput(""); setOutput(""); }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                disabled={loading}
              >
                清空
              </button>
              <div className="flex items-center gap-3">
                {loading && (
                  <button
                    onClick={handleStop}
                    className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    停止
                  </button>
                )}
                <button
                  onClick={handleTranslate}
                  disabled={loading || !input.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: loading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    color: "white",
                    boxShadow: loading ? "none" : "0 4px 20px rgba(99,102,241,0.3)",
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      翻译中…
                    </>
                  ) : (
                    <>
                      <Zap size={14} />
                      开始翻译
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right panel — Output */}
          <div
            className="rounded-2xl border flex flex-col overflow-hidden transition-all duration-300"
            style={{
              background: "var(--bg-card)",
              borderColor: output ? "rgba(99,102,241,0.2)" : "var(--border)",
              boxShadow: output ? "0 0 40px rgba(99,102,241,0.05)" : "none",
            }}
          >
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                {direction === "pm2rd" ? <Code2 size={14} className="text-emerald-400" /> : <Briefcase size={14} className="text-emerald-400" />}
                {currentDir.to}
                {streaming && (
                  <span className="flex items-center gap-1 text-xs text-indigo-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    实时输出
                  </span>
                )}
              </span>
              {output && !loading && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1 rounded-lg hover:bg-white/5"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copied ? "已复制" : "复制"}
                </button>
              )}
            </div>

            <div ref={outputRef} className="flex-1 overflow-y-auto p-5">
              {!output && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/5 flex items-center justify-center">
                    <ArrowLeftRight size={24} className="text-slate-700" />
                  </div>
                  <p className="text-sm">翻译结果将在此处显示</p>
                  <p className="text-xs">支持 Markdown 渲染</p>
                </div>
              )}

              {loading && !output && (
                <div className="h-full flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  </div>
                  <p className="text-sm text-slate-500">正在连接 AI 服务…</p>
                </div>
              )}

              {output && (
                <article className="markdown-body">
                  <ReactMarkdown
                    components={{
                      // Tables
                      table: ({ children }) => (
                        <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>{children}</table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left", color: "#e2e8f0", fontWeight: 600 }}>{children}</th>
                      ),
                      td: ({ children }) => (
                        <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#94a3b8" }}>{children}</td>
                      ),
                      // Code
                      code: ({ className, children, ...props }) => {
                        const isBlock = className?.includes("language-");
                        return isBlock ? (
                          <pre style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "1rem", overflowX: "auto", marginBottom: "1rem" }}>
                            <code style={{ color: "#a5f3fc", fontFamily: "monospace", fontSize: "0.85em" }} {...props}>{children}</code>
                          </pre>
                        ) : (
                          <code style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", padding: "0.15rem 0.4rem", borderRadius: "4px", fontSize: "0.85em", fontFamily: "monospace" }} {...props}>{children}</code>
                        );
                      },
                    }}
                  >
                    {output}
                  </ReactMarkdown>
                  {streaming && (
                    <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
                  )}
                </article>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
