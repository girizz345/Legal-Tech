"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken, getToken, listContracts, listTemplates, type ContractSummary, type TemplateSummary } from "@/lib/api";
import { LawBackground } from "@/components/LawBackground";
import { Sidebar } from "@/components/Sidebar";

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:     { bg: "rgba(201,168,76,0.12)",  color: "#c9a84c" },
  generated: { bg: "rgba(34,197,94,0.1)",    color: "#4ade80" },
  uploaded:  { bg: "rgba(99,102,241,0.12)",  color: "#a5b4fc" },
  overdue:   { bg: "rgba(239,68,68,0.12)",   color: "#f87171" },
};

export default function ContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    Promise.all([listContracts(token), listTemplates(token)])
      .then(([ctrs, tmps]) => {
        setContracts(ctrs);
        const m: Record<string, string> = {};
        (tmps as TemplateSummary[]).forEach((t) => { m[t.id] = t.name; });
        setTemplates(m);
      })
      .catch((e) => { if (e.message === "Not authenticated") { clearToken(); router.replace("/login"); } else setError(e.message); })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="page-shell">
      <LawBackground />
      <Sidebar />
      <main className="main-content" style={{ position: "relative", zIndex: 1 }}>
        <div className="animate-slide-up mb-8 flex items-end justify-between">
          <div>
            <div className="section-title mb-1">Archive</div>
            <h1 className="page-title">Contracts</h1>
          </div>
          <div className="flex gap-3">
            <Link href="/upload" className="btn-secondary">Upload</Link>
            <Link href="/templates" className="btn-primary">Generate new</Link>
          </div>
        </div>

        {error && (
          <div className="animate-scale-in mb-6" style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(139,26,26,0.18)", border: "1px solid rgba(139,26,26,0.4)", color: "#ff8a8a", fontSize: "0.88rem" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--parchment-dim)", opacity: 0.5 }}>
            <div style={{ fontSize: "2rem", animation: "float 2s ease-in-out infinite", marginBottom: "1rem" }}>◈</div>
            <div className="section-title">Loading contracts…</div>
          </div>
        ) : contracts.length === 0 ? (
          <div className="card text-center animate-scale-in" style={{ padding: "4rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.3 }}>◈</div>
            <div style={{ fontFamily: "var(--font-cinzel, serif)", color: "var(--parchment-dim)", marginBottom: "1.5rem" }}>No contracts on file</div>
            <div className="flex justify-center gap-3">
              <Link href="/upload" className="btn-secondary">Upload a contract</Link>
              <Link href="/templates" className="btn-primary">Generate from template</Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 110px 130px 180px", gap: "1rem", padding: "0.5rem 1.25rem" }}>
              {["Contract", "Source", "Status", "Created", "Actions"].map((h) => (
                <div key={h} className="section-title">{h}</div>
              ))}
            </div>
            {contracts.map((c, i) => {
              const st = STATUS_STYLE[c.status] ?? { bg: "rgba(201,168,76,0.08)", color: "var(--parchment-dim)" };
              return (
                <div
                  key={c.contract_id}
                  className="animate-slide-up"
                  style={{
                    animationDelay: `${i * 50}ms`,
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 110px 130px 180px",
                    gap: "1rem",
                    alignItems: "center",
                    padding: "0.875rem 1.25rem",
                    background: "rgba(9,13,30,0.6)",
                    border: "1px solid rgba(201,168,76,0.1)",
                    borderRadius: 8,
                    backdropFilter: "blur(16px)",
                    transition: "border-color 0.25s, box-shadow 0.25s",
                  }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(201,168,76,0.3)"; el.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)"; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(201,168,76,0.1)"; el.style.boxShadow = "none"; }}
                >
                  <div>
                    <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.8rem", fontWeight: 600, color: "var(--parchment)" }}>
                      {c.source === "generated" && c.template_id ? (templates[c.template_id] ?? "Generated contract") : "Uploaded contract"}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--parchment-dim)", fontFamily: "monospace", opacity: 0.5, marginTop: 2 }}>
                      {c.contract_id.slice(0, 8)}…
                    </div>
                  </div>
                  <div><span className="badge" style={{ background: c.source === "generated" ? "rgba(168,100,200,0.12)" : "rgba(99,102,241,0.12)", color: c.source === "generated" ? "#c084fc" : "#a5b4fc" }}>{c.source}</span></div>
                  <div><span className="badge" style={{ background: st.bg, color: st.color }}>{c.status}</span></div>
                  <div style={{ fontSize: "0.78rem", color: "var(--parchment-dim)", opacity: 0.7 }}>
                    {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {c.source === "generated" && <Link href={`/contracts/${c.contract_id}/preview`} className="btn-secondary" style={{ padding: "0.3rem 0.7rem", fontSize: "0.58rem" }}>Preview</Link>}
                    <Link href={`/contracts/${c.contract_id}/review`} className="btn-secondary" style={{ padding: "0.3rem 0.7rem", fontSize: "0.58rem" }}>Review</Link>
                    <Link href={`/contracts/${c.contract_id}/chat`} className="btn-secondary" style={{ padding: "0.3rem 0.7rem", fontSize: "0.58rem" }}>Ask</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
