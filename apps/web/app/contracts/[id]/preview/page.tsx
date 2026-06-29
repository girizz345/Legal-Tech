"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clearToken, getContractContent, getToken, type ContractContent } from "@/lib/api";
import { LawBackground } from "@/components/LawBackground";
import { Sidebar } from "@/components/Sidebar";

export default function PreviewPage() {
  const { id: contractId } = useParams<{ id: string }>();
  const router = useRouter();
  const [contract, setContract] = useState<ContractContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    getContractContent(token, contractId)
      .then(setContract)
      .catch((e) => { if (e.message === "Not authenticated") { clearToken(); router.replace("/login"); } else setError(e.message); })
      .finally(() => setLoading(false));
  }, [contractId, router]);

  async function copy() {
    if (!contract?.content) return;
    await navigator.clipboard.writeText(contract.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const sections = contract?.content
    ? contract.content.split(/\n{2,}/).filter(Boolean)
    : [];

  return (
    <div className="page-shell">
      <LawBackground />
      <Sidebar />
      <main className="main-content" style={{ position: "relative", zIndex: 1, maxWidth: 860 }}>
        <div className="animate-slide-up mb-8 flex items-end justify-between" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div className="section-title mb-1">Archive · Preview</div>
            <h1 className="page-title" style={{ fontSize: "1.45rem" }}>Contract Document</h1>
            <div style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "var(--parchment-dim)", opacity: 0.4, marginTop: 3 }}>
              {contractId?.slice(0, 16)}…
            </div>
          </div>
          {contract && (
            <div style={{ display: "flex", gap: "0.625rem" }}>
              <Link href={`/contracts/${contractId}/review`} className="btn-secondary" style={{ padding: "0.55rem 1rem", fontSize: "0.68rem" }}>
                ⚖ Request Review
              </Link>
              <Link href={`/contracts/${contractId}/chat`} className="btn-secondary" style={{ padding: "0.55rem 1rem", fontSize: "0.68rem" }}>
                ◎ Ask AI
              </Link>
              <button className="btn-primary" style={{ padding: "0.55rem 1rem", fontSize: "0.68rem" }} onClick={copy}>
                {copied ? "✓ Copied" : "Copy text"}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="animate-scale-in mb-6" style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(139,26,26,0.18)", border: "1px solid rgba(139,26,26,0.4)", color: "#ff8a8a" }}>{error}</div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "5rem", opacity: 0.4 }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem", animation: "float 2.5s ease-in-out infinite", filter: "drop-shadow(0 0 12px rgba(201,168,76,0.4))" }}>◈</div>
            <div className="section-title">Retrieving document…</div>
          </div>
        ) : !contract ? (
          <div className="card text-center animate-scale-in" style={{ padding: "4rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.25 }}>◈</div>
            <div style={{ fontFamily: "var(--font-cinzel, serif)", color: "var(--parchment-dim)" }}>Document not found</div>
          </div>
        ) : (
          <div className="animate-fade-in">
            {/* Parchment document */}
            <div style={{
              background: "rgba(9,13,30,0.75)",
              border: "1px solid rgba(201,168,76,0.18)",
              borderRadius: 12,
              backdropFilter: "blur(20px)",
              overflow: "hidden",
              boxShadow: "0 8px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,168,76,0.1)",
            }}>
              {/* Document header bar */}
              <div style={{ padding: "1.25rem 2rem", borderBottom: "1px solid rgba(201,168,76,0.12)", background: "rgba(201,168,76,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(239,68,68,0.5)" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(251,146,60,0.5)" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(34,197,94,0.4)" }} />
                </div>
                <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.6rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--parchment-dim)", opacity: 0.5 }}>
                  Legal Document · Confidential
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "var(--parchment-dim)", opacity: 0.3 }}>
                  {new Date().toLocaleDateString("en-IN")}
                </div>
              </div>

              {/* Document body */}
              <div style={{ padding: "2.5rem 3rem", maxHeight: "72vh", overflowY: "auto" }}>
                {sections.length === 0 ? (
                  <div style={{ fontFamily: "var(--font-garamond, Georgia, serif)", fontSize: "1rem", color: "var(--parchment)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                    {contract.content}
                  </div>
                ) : sections.map((section, i) => {
                  const isHeading = section.trim().length < 80 && /^[A-Z\s\d.:]+$/.test(section.trim().replace(/[^A-Z\s\d.:-]/g, "")) && !section.includes("\n");
                  const isNumbered = /^\d+[.)]\s/.test(section.trim());
                  return (
                    <div
                      key={i}
                      className="animate-slide-up"
                      style={{ animationDelay: `${Math.min(i * 30, 400)}ms`, marginBottom: isHeading ? "1.25rem" : "1rem" }}
                    >
                      {isHeading ? (
                        <div style={{
                          fontFamily: "var(--font-cinzel, serif)",
                          fontSize: i === 0 ? "1.3rem" : "0.85rem",
                          fontWeight: i === 0 ? 700 : 600,
                          color: i === 0 ? "var(--gold)" : "var(--parchment)",
                          letterSpacing: i === 0 ? "0.08em" : "0.12em",
                          textTransform: "uppercase",
                          paddingBottom: "0.625rem",
                          borderBottom: i === 0 ? "1px solid rgba(201,168,76,0.25)" : "1px solid rgba(201,168,76,0.08)",
                          marginBottom: "0.75rem",
                          textShadow: i === 0 ? "0 0 20px rgba(201,168,76,0.3)" : "none",
                        }}>
                          {section.trim()}
                        </div>
                      ) : (
                        <p style={{
                          fontFamily: "var(--font-garamond, Georgia, serif)",
                          fontSize: "0.97rem",
                          color: "var(--parchment)",
                          lineHeight: 1.82,
                          whiteSpace: "pre-wrap",
                          paddingLeft: isNumbered ? "0.5rem" : 0,
                          borderLeft: isNumbered ? "2px solid rgba(201,168,76,0.12)" : "none",
                        }}>
                          {section.trim()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Document footer */}
              <div style={{ padding: "0.875rem 2rem", borderTop: "1px solid rgba(201,168,76,0.08)", background: "rgba(201,168,76,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--parchment-dim)", opacity: 0.3 }}>
                  Lex Machina · Confidential
                </div>
                <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.55rem", letterSpacing: "0.1em", color: "var(--parchment-dim)", opacity: 0.3 }}>
                  {contractId?.slice(0, 8)}…
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
