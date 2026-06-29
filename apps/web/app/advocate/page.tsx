"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getCurrentUser, getToken, listReviews, updateReviewState, type CurrentUser, type ReviewState, type ReviewSummary } from "@/lib/api";
import { LawBackground } from "@/components/LawBackground";
import { Sidebar } from "@/components/Sidebar";

const STATE_STYLE: Record<ReviewState, { bg: string; color: string; label: string }> = {
  requested: { bg: "rgba(201,168,76,0.12)", color: "#c9a84c",  label: "Requested" },
  assigned:  { bg: "rgba(99,102,241,0.12)", color: "#a5b4fc",  label: "Assigned" },
  in_review: { bg: "rgba(168,100,200,0.12)",color: "#c084fc",  label: "In Review" },
  returned:  { bg: "rgba(251,146,60,0.12)", color: "#fdba74",  label: "Returned" },
  closed:    { bg: "rgba(34,197,94,0.1)",   color: "#4ade80",  label: "Closed" },
};

type NextAction = { label: string; next: ReviewState; needsNote?: boolean } | null;
function nextAction(state: ReviewState): NextAction {
  if (state === "assigned")  return { label: "Begin Review", next: "in_review" };
  if (state === "in_review") return { label: "Return to Client", next: "returned", needsNote: true };
  return null;
}

function ReviewCard({ review, onUpdate }: { review: ReviewSummary; onUpdate: (r: ReviewSummary) => void }) {
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const action = nextAction(review.state);
  const st = STATE_STYLE[review.state];

  async function handle() {
    if (!action) return;
    if (action.needsNote && !showNote) { setShowNote(true); return; }
    const token = getToken(); if (!token) return;
    setSaving(true);
    try {
      onUpdate(await updateReviewState(token, review.id, action.next, action.needsNote ? note : undefined));
      setShowNote(false); setNote("");
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="card animate-slide-up">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
            <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
            <span style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "var(--parchment-dim)", opacity: 0.5 }}>{review.id.slice(0, 10)}…</span>
          </div>
          {review.contract_id && (
            <div style={{ fontSize: "0.8rem", color: "var(--parchment-dim)", marginBottom: 3 }}>
              Contract: <span style={{ fontFamily: "monospace", opacity: 0.7 }}>{review.contract_id.slice(0, 10)}…</span>
            </div>
          )}
          <div style={{ fontSize: "0.72rem", color: "var(--parchment-dim)", opacity: 0.45 }}>
            Filed {new Date(review.requested_at).toLocaleString("en-IN")}
          </div>
        </div>
        {action && (
          <button className="btn-primary" style={{ flexShrink: 0, padding: "0.5rem 1rem", fontSize: "0.65rem" }} onClick={handle} disabled={saving}>
            {saving ? "Saving…" : action.label}
          </button>
        )}
      </div>

      {showNote && (
        <div className="animate-scale-in mt-4">
          <label className="label">Note for client (optional)</label>
          <textarea className="input" style={{ height: 96, resize: "none" }} placeholder="Summarise your findings…" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2 mt-2">
            <button className="btn-primary" onClick={handle} disabled={saving} style={{ padding: "0.5rem 1rem", fontSize: "0.65rem" }}>{saving ? "Returning…" : "Confirm"}</button>
            <button className="btn-secondary" onClick={() => setShowNote(false)} style={{ padding: "0.5rem 1rem", fontSize: "0.65rem" }}>Cancel</button>
          </div>
        </div>
      )}

      {review.note && (
        <div className="mt-3" style={{ padding: "0.625rem 0.875rem", borderRadius: 7, background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)", fontSize: "0.85rem", color: "#c7d2fe" }}>
          <span style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#a5b4fc", display: "block", marginBottom: 4 }}>Your note</span>
          {review.note}
        </div>
      )}
    </div>
  );
}

export default function AdvocatePage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    getCurrentUser(token)
      .then((u) => {
        if (u.role !== "advocate" && u.role !== "admin") { router.replace("/dashboard"); return Promise.reject(null); }
        setUser(u);
        return listReviews(token);
      })
      .then((rs) => { if (rs) setReviews(rs); })
      .catch((e) => { if (e && e.message === "Not authenticated") { clearToken(); router.replace("/login"); } else if (e) setError(e.message); })
      .finally(() => setLoading(false));
  }, [router]);

  function update(updated: ReviewSummary) {
    setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  const active   = reviews.filter((r) => r.state === "assigned" || r.state === "in_review");
  const returned = reviews.filter((r) => r.state === "returned");
  const closed   = reviews.filter((r) => r.state === "closed");

  return (
    <div className="page-shell">
      <LawBackground />
      <Sidebar />
      <main className="main-content" style={{ position: "relative", zIndex: 1 }}>
        <div className="animate-slide-up mb-8">
          <div className="section-title mb-1">Chambers</div>
          <h1 className="page-title">Advocate Console</h1>
          {user && <div style={{ fontSize: "0.82rem", color: "var(--parchment-dim)", opacity: 0.6, marginTop: 4 }}>{user.name} · {user.role}</div>}
        </div>

        {error && <div className="animate-scale-in mb-6" style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(139,26,26,0.18)", border: "1px solid rgba(139,26,26,0.4)", color: "#ff8a8a" }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", opacity: 0.4 }}>
            <div style={{ fontSize: "2rem", animation: "float 2s ease-in-out infinite" }}>⚜</div>
          </div>
        ) : (
          <>
            <section className="mb-8">
              <div className="section-title mb-4">Active Reviews ({active.length})</div>
              {active.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--parchment-dim)", opacity: 0.35, fontFamily: "var(--font-cinzel, serif)", fontSize: "0.78rem", letterSpacing: "0.1em" }}>
                  No active reviews
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {active.map((r) => <ReviewCard key={r.id} review={r} onUpdate={update} />)}
                </div>
              )}
            </section>

            {returned.length > 0 && (
              <section className="mb-8">
                <div className="section-title mb-4">Returned ({returned.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {returned.map((r) => <ReviewCard key={r.id} review={r} onUpdate={update} />)}
                </div>
              </section>
            )}

            {closed.length > 0 && (
              <section style={{ opacity: 0.45 }}>
                <div className="section-title mb-4">Closed ({closed.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {closed.map((r) => <ReviewCard key={r.id} review={r} onUpdate={update} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
