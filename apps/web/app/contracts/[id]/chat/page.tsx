"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { explainClause, getToken, type ExplainResponse } from "@/lib/api";
import { LawBackground } from "@/components/LawBackground";
import { Sidebar } from "@/components/Sidebar";

interface Message {
  role: "user" | "assistant" | "system";
  text: string;
  routed?: boolean;
  sourceClause?: string;
}

export default function ChatPage() {
  const { id: contractId } = useParams<{ id: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    { role: "system", text: "Ask any question about this contract in plain English. If it requires specific legal advice, I will recommend a lawyer review." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res: ExplainResponse = await explainClause(token, q, contractId);
      if (res.decision === "route_to_advocate") {
        setMessages((m) => [...m, { role: "assistant", text: "This question requires qualified legal counsel. I'm recommending you file for a lawyer review.", routed: true }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", text: res.answer ?? "No answer available.", sourceClause: res.source_clause }]);
      }
    } catch (e: unknown) {
      setMessages((m) => [...m, { role: "system", text: `Error: ${e instanceof Error ? e.message : "Unknown"}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    }
  }

  return (
    <div className="page-shell" style={{ overflow: "hidden" }}>
      <LawBackground />
      <Sidebar />
      <main style={{ marginLeft: 248, display: "flex", flexDirection: "column", height: "100vh", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ padding: "1.5rem 2.5rem 1rem", borderBottom: "1px solid rgba(201,168,76,0.1)", background: "rgba(7,11,24,0.6)", backdropFilter: "blur(20px)", flexShrink: 0 }}>
          <div className="section-title mb-0.5">Counsel · AI Assistant</div>
          <h1 style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "1.1rem", fontWeight: 700, color: "var(--parchment)" }}>Contract Explainer</h1>
          <div style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "var(--parchment-dim)", opacity: 0.4, marginTop: 2 }}>{contractId?.slice(0, 16)}…</div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 2.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {messages.map((m, i) => (
            <div key={i} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
              {m.role === "system" && (
                <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.1)", fontSize: "0.85rem", color: "var(--parchment-dim)", fontStyle: "italic" }}>
                  ⚖ {m.text}
                </div>
              )}
              {m.role === "user" && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: "75%", padding: "0.75rem 1rem", borderRadius: "10px 10px 2px 10px", background: "linear-gradient(135deg,#8a6f2a,#c9a84c)", color: "#0a0d18", fontSize: "0.9rem", fontWeight: 500, boxShadow: "0 4px 16px rgba(201,168,76,0.25)" }}>
                    {m.text}
                  </div>
                </div>
              )}
              {m.role === "assistant" && (
                <div style={{ maxWidth: "80%" }}>
                  <div style={{
                    padding: "0.875rem 1.1rem",
                    borderRadius: "10px 10px 10px 2px",
                    background: m.routed ? "rgba(251,146,60,0.07)" : "rgba(15,24,48,0.8)",
                    border: `1px solid ${m.routed ? "rgba(251,146,60,0.25)" : "rgba(201,168,76,0.12)"}`,
                    backdropFilter: "blur(12px)",
                    fontSize: "0.9rem",
                    color: "var(--parchment)",
                    lineHeight: 1.65,
                  }}>
                    {m.routed && <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#fdba74", marginBottom: "0.4rem" }}>⚠ Routed to Counsel</div>}
                    {m.text}
                    {m.routed && (
                      <Link href={`/contracts/${contractId}/review`} style={{ display: "inline-block", marginTop: "0.6rem", fontFamily: "var(--font-cinzel, serif)", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gold)", textDecoration: "none", borderBottom: "1px solid rgba(201,168,76,0.3)" }}>
                        File for lawyer review →
                      </Link>
                    )}
                    {m.sourceClause && (
                      <details style={{ marginTop: "0.5rem" }}>
                        <summary style={{ fontSize: "0.72rem", color: "var(--parchment-dim)", opacity: 0.5, cursor: "pointer", fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Source clause</summary>
                        <div style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: "var(--parchment-dim)", background: "rgba(0,0,0,0.2)", padding: "0.5rem 0.75rem", borderRadius: 6, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{m.sourceClause}</div>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: "0.3rem", padding: "0.875rem 1.1rem", borderRadius: "10px 10px 10px 2px", background: "rgba(15,24,48,0.8)", border: "1px solid rgba(201,168,76,0.12)", width: "fit-content" }}>
              {[0,1,2].map((n) => (
                <span key={n} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--gold)", opacity: 0.7, animation: "float 1.2s ease-in-out infinite", animationDelay: `${n * 200}ms` }} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "1.25rem 2.5rem", borderTop: "1px solid rgba(201,168,76,0.1)", background: "rgba(7,11,24,0.7)", backdropFilter: "blur(20px)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Ask about a clause, term, or obligation…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              disabled={loading}
            />
            <button className="btn-primary" onClick={send} disabled={loading || !input.trim()} style={{ padding: "0.6rem 1.25rem" }}>
              Send
            </button>
          </div>
          <div style={{ marginTop: "0.4rem", fontSize: "0.65rem", color: "rgba(184,169,138,0.3)", fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center" }}>
            For legal advice, use Lawyer Review
          </div>
        </div>
      </main>
    </div>
  );
}
