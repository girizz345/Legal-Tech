"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken, dismissObligation, getToken, listReminders, type ObligationSummary } from "@/lib/api";
import { LawBackground } from "@/components/LawBackground";
import { Sidebar } from "@/components/Sidebar";

function urgencyStyle(days: number | null): { bg: string; color: string; label: string } {
  if (days === null) return { bg: "rgba(201,168,76,0.08)", color: "var(--parchment-dim)", label: "No date" };
  if (days < 0)  return { bg: "rgba(239,68,68,0.12)", color: "#f87171", label: `${Math.abs(days)}d overdue` };
  if (days <= 7)  return { bg: "rgba(239,68,68,0.1)",  color: "#fca5a5", label: `${days}d left` };
  if (days <= 14) return { bg: "rgba(251,146,60,0.1)", color: "#fdba74", label: `${days}d left` };
  return { bg: "rgba(201,168,76,0.1)", color: "#c9a84c", label: `${days}d left` };
}

export default function RemindersPage() {
  const router = useRouter();
  const [obligations, setObligations] = useState<ObligationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dismissing, setDismissing] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    listReminders(token, 60)
      .then(setObligations)
      .catch((e) => { if (e.message === "Not authenticated") { clearToken(); router.replace("/login"); } else setError(e.message); })
      .finally(() => setLoading(false));
  }, [router]);

  async function dismiss(id: string) {
    const token = getToken();
    if (!token) return;
    setDismissing(id);
    try { await dismissObligation(token, id); setObligations((p) => p.filter((o) => o.id !== id)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setDismissing(null); }
  }

  return (
    <div className="page-shell">
      <LawBackground />
      <Sidebar />
      <main className="main-content" style={{ position: "relative", zIndex: 1 }}>
        <div className="animate-slide-up mb-8">
          <div className="section-title mb-1">Calendar</div>
          <h1 className="page-title">Obligations & Reminders</h1>
        </div>

        {error && <div className="animate-scale-in mb-6" style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(139,26,26,0.18)", border: "1px solid rgba(139,26,26,0.4)", color: "#ff8a8a" }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--parchment-dim)", opacity: 0.4 }}>
            <div style={{ fontSize: "2rem", animation: "float 2s ease-in-out infinite", marginBottom: "0.75rem" }}>◇</div>
            <div className="section-title">Loading…</div>
          </div>
        ) : obligations.length === 0 ? (
          <div className="card text-center animate-scale-in" style={{ padding: "4rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.25 }}>◇</div>
            <div style={{ fontFamily: "var(--font-cinzel, serif)", color: "var(--parchment-dim)", marginBottom: "0.5rem" }}>No upcoming obligations</div>
            <div style={{ fontSize: "0.82rem", color: "var(--parchment-dim)", opacity: 0.5 }}>Obligations are detected when you upload contracts.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {obligations.map((o, i) => {
              const style = urgencyStyle(o.days_until_due);
              return (
                <div
                  key={o.id}
                  className="animate-slide-up"
                  style={{
                    animationDelay: `${i * 55}ms`,
                    display: "flex",
                    alignItems: "center",
                    gap: "1.25rem",
                    padding: "1rem 1.25rem",
                    background: "rgba(9,13,30,0.6)",
                    border: "1px solid rgba(201,168,76,0.1)",
                    borderRadius: 8,
                    backdropFilter: "blur(16px)",
                    transition: "border-color 0.25s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,76,0.28)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,76,0.1)"; }}
                >
                  <span className="badge" style={{ background: style.bg, color: style.color, flexShrink: 0 }}>{style.label}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.78rem", fontWeight: 600, color: "var(--parchment)", textTransform: "capitalize" }}>
                      {o.type.replace(/_/g, " ")}
                    </div>
                    <div style={{ display: "flex", gap: "1rem", marginTop: 3 }}>
                      {o.due_date && <span style={{ fontSize: "0.72rem", color: "var(--parchment-dim)", opacity: 0.6 }}>Due {new Date(o.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                      <Link href={`/contracts/${o.contract_id}/preview`} style={{ fontSize: "0.72rem", color: "var(--gold)", opacity: 0.7, transition: "opacity 0.2s" }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}>View contract →</Link>
                    </div>
                  </div>
                  <button
                    className="btn-secondary"
                    style={{ padding: "0.3rem 0.7rem", fontSize: "0.58rem", flexShrink: 0 }}
                    onClick={() => dismiss(o.id)}
                    disabled={dismissing === o.id}
                  >
                    {dismissing === o.id ? "…" : "Dismiss"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
