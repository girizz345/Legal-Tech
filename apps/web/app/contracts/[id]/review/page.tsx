"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clearToken, createReview, getToken, listReviews, updateReviewState, type ReviewState, type ReviewSummary } from "@/lib/api";
import { LawBackground } from "@/components/LawBackground";
import { Sidebar } from "@/components/Sidebar";

const STEPS: { state: ReviewState; label: string }[] = [
  { state: "requested", label: "Filed" },
  { state: "assigned",  label: "Assigned" },
  { state: "in_review", label: "In Review" },
  { state: "returned",  label: "Returned" },
  { state: "closed",    label: "Closed" },
];

const STATE_STYLE: Record<ReviewState, { bg: string; color: string }> = {
  requested: { bg: "rgba(201,168,76,0.12)", color: "#c9a84c" },
  assigned:  { bg: "rgba(99,102,241,0.12)", color: "#a5b4fc" },
  in_review: { bg: "rgba(168,100,200,0.12)",color: "#c084fc" },
  returned:  { bg: "rgba(251,146,60,0.12)", color: "#fdba74" },
  closed:    { bg: "rgba(34,197,94,0.1)",   color: "#4ade80" },
};

export default function ReviewPage() {
  const { id: contractId } = useParams<{ id: string }>();
  const router = useRouter();
  const [review, setReview] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    listReviews(token)
      .then((rs) => setReview(rs.find((r) => r.contract_id === contractId) ?? null))
      .catch((e) => { if (e.message === "Not authenticated") { clearToken(); router.replace("/login"); } else setError(e.message); })
      .finally(() => setLoading(false));
  }, [contractId, router]);

  async function handleRequest() {
    const token = getToken(); if (!token) return;
    setRequesting(true); setError("");
    try { setReview(await createReview(token, contractId)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setRequesting(false); }
  }

  async function handleClose() {
    if (!review) return;
    const token = getToken(); if (!token) return;
    setClosing(true); setError("");
    try { setReview(await updateReviewState(token, review.id, "closed")); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setClosing(false); }
  }

  const currentStep = review ? STEPS.findIndex((s) => s.state === review.state) : -1;

  return (
    <div className="page-shell">
      <LawBackground />
      <Sidebar />
      <main className="main-content" style={{ position: "relative", zIndex: 1, maxWidth: 660 }}>
        <div className="animate-slide-up mb-8">
          <div className="section-title mb-1">Counsel</div>
          <h1 className="page-title">Lawyer Review</h1>
          <div style={{ fontSize: "0.75rem", color: "var(--parchment-dim)", opacity: 0.5, fontFamily: "monospace", marginTop: 4 }}>
            Contract {contractId?.slice(0, 12)}…
          </div>
        </div>

        {error && <div className="animate-scale-in mb-6" style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(139,26,26,0.18)", border: "1px solid rgba(139,26,26,0.4)", color: "#ff8a8a" }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", opacity: 0.4 }}>
            <div style={{ fontSize: "2rem", animation: "float 2s ease-in-out infinite" }}>⚖</div>
          </div>
        ) : !review ? (
          <div className="card text-center animate-scale-in" style={{ padding: "3.5rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem", animation: "float-slow 6s ease-in-out infinite", filter: "drop-shadow(0 0 12px rgba(201,168,76,0.4))" }}>⚖</div>
            <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "1rem", color: "var(--parchment)", marginBottom: "0.5rem" }}>No review filed yet</div>
            <div style={{ fontSize: "0.88rem", color: "var(--parchment-dim)", opacity: 0.6, marginBottom: "2rem", lineHeight: 1.6 }}>
              A qualified advocate will review this contract and return it with annotations within 2–3 business days.
            </div>
            <button className="btn-primary" onClick={handleRequest} disabled={requesting} style={{ padding: "0.75rem 2rem" }}>
              {requesting ? "Filing request…" : "File for Review"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Timeline */}
            <div className="card animate-slide-up">
              <div className="flex items-center justify-between mb-5">
                <div className="section-title">Review Status</div>
                <span className="badge" style={STATE_STYLE[review.state]}>{review.state.replace("_", " ")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                {STEPS.map((s, i) => (
                  <div key={s.state} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : undefined }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: i <= currentStep ? "linear-gradient(135deg,#8a6f2a,#c9a84c)" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${i <= currentStep ? "var(--gold)" : "rgba(201,168,76,0.15)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.6rem", fontFamily: "var(--font-cinzel, serif)", fontWeight: 700,
                        color: i <= currentStep ? "#0a0d18" : "var(--parchment-dim)",
                        boxShadow: i <= currentStep ? "0 0 10px rgba(201,168,76,0.4)" : "none",
                        transition: "all 0.4s ease",
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ fontSize: "0.52rem", fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.1em", textTransform: "uppercase", color: i <= currentStep ? "var(--gold)" : "rgba(184,169,138,0.3)" }}>
                        {s.label}
                      </div>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{ flex: 1, height: 1, margin: "0 4px", background: i < currentStep ? "linear-gradient(90deg,var(--gold),var(--gold-dim))" : "rgba(201,168,76,0.12)", marginBottom: 18, transition: "background 0.4s" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="card animate-slide-up delay-100">
              <div className="section-title mb-4">Case Details</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {[
                  ["Review ID", review.id.slice(0, 12) + "…"],
                  ["Filed", new Date(review.requested_at).toLocaleString("en-IN")],
                  ...(review.returned_at ? [["Returned", new Date(review.returned_at).toLocaleString("en-IN")]] : []),
                  ...(review.advocate_id ? [["Advocate", review.advocate_id.slice(0, 12) + "…"]] : []),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid rgba(201,168,76,0.06)" }}>
                    <span style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--parchment-dim)", opacity: 0.6 }}>{k}</span>
                    <span style={{ fontSize: "0.82rem", color: "var(--parchment)", fontFamily: "monospace" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {review.note && (
              <div className="animate-scale-in" style={{ padding: "1rem 1.25rem", borderRadius: 10, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <div className="section-title mb-2" style={{ color: "#a5b4fc" }}>Advocate Note</div>
                <p style={{ fontSize: "0.92rem", color: "#c7d2fe", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{review.note}</p>
              </div>
            )}

            {review.state === "returned" && (
              <button className="btn-primary w-full animate-scale-in" style={{ padding: "0.85rem" }} onClick={handleClose} disabled={closing}>
                {closing ? "Closing…" : "🔨 Acknowledge & Close Review"}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
