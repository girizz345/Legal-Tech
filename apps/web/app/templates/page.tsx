"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken, listTemplates, type TemplateSummary } from "@/lib/api";
import { LawBackground } from "@/components/LawBackground";
import { Sidebar } from "@/components/Sidebar";

const TEMPLATE_ICONS: Record<string, string> = {
  "Founders' Agreement": "⚜",
  "Non-Disclosure Agreement": "◈",
  "Offer / Employment Letter": "◎",
  "Vendor / Service Agreement": "◇",
};

const TEMPLATE_DESC: Record<string, string> = {
  "Founders' Agreement": "Equity split, roles, vesting schedule, IP assignment and dispute resolution between co-founders.",
  "Non-Disclosure Agreement": "Mutual or one-way confidentiality obligations with tailored disclosure scope and duration.",
  "Offer / Employment Letter": "Formal employment offer covering role, compensation, joining date and standard clauses.",
  "Vendor / Service Agreement": "Scope of work, payment milestones, IP ownership and termination terms for service contracts.",
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    listTemplates(token)
      .then(setTemplates)
      .catch((e) => { if (e?.message === "Not authenticated") { clearToken(); router.replace("/login"); } })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="page-shell">
      <LawBackground />
      <Sidebar />
      <main className="main-content" style={{ position: "relative", zIndex: 1 }}>
        <div className="animate-slide-up mb-8">
          <div className="section-title mb-1">Drafting Room</div>
          <h1 className="page-title">Generate a Document</h1>
          <p style={{ fontFamily: "var(--font-garamond, Georgia, serif)", fontSize: "1rem", color: "var(--parchment-dim)", opacity: 0.65, marginTop: "0.375rem", fontStyle: "italic" }}>
            Select a template to begin drafting.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "5rem", opacity: 0.4 }}>
            <div style={{ fontSize: "2rem", animation: "float 2s ease-in-out infinite", marginBottom: "0.75rem" }}>⚖</div>
            <div className="section-title">Loading templates…</div>
          </div>
        ) : templates.length === 0 ? (
          <div className="card text-center animate-scale-in" style={{ padding: "4rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.25 }}>◈</div>
            <div style={{ fontFamily: "var(--font-cinzel, serif)", color: "var(--parchment-dim)" }}>No templates available</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
            {templates.map((t, i) => {
              const icon = TEMPLATE_ICONS[t.name] ?? "◈";
              const desc = TEMPLATE_DESC[t.name] ?? "Click to generate a document from this template.";
              return (
                <button
                  key={t.id}
                  onClick={() => router.push(`/templates/${t.id}/new`)}
                  className="animate-slide-up"
                  style={{
                    animationDelay: `${i * 80}ms`,
                    textAlign: "left",
                    padding: "1.5rem",
                    background: "rgba(9,13,30,0.75)",
                    border: "1px solid rgba(201,168,76,0.14)",
                    borderRadius: 10,
                    backdropFilter: "blur(20px)",
                    cursor: "pointer",
                    transition: "border-color 0.25s, box-shadow 0.25s, transform 0.2s",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = "rgba(201,168,76,0.38)";
                    el.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(201,168,76,0.08)";
                    el.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = "rgba(201,168,76,0.14)";
                    el.style.boxShadow = "none";
                    el.style.transform = "translateY(0)";
                  }}
                >
                  {/* Corner accents */}
                  <div style={{ position: "absolute", top: 8, left: 8, width: 10, height: 10, borderTop: "1px solid rgba(201,168,76,0.35)", borderLeft: "1px solid rgba(201,168,76,0.35)" }} />
                  <div style={{ position: "absolute", top: 8, right: 8, width: 10, height: 10, borderTop: "1px solid rgba(201,168,76,0.35)", borderRight: "1px solid rgba(201,168,76,0.35)" }} />
                  <div style={{ position: "absolute", bottom: 8, left: 8, width: 10, height: 10, borderBottom: "1px solid rgba(201,168,76,0.35)", borderLeft: "1px solid rgba(201,168,76,0.35)" }} />
                  <div style={{ position: "absolute", bottom: 8, right: 8, width: 10, height: 10, borderBottom: "1px solid rgba(201,168,76,0.35)", borderRight: "1px solid rgba(201,168,76,0.35)" }} />

                  {/* Shimmer gradient */}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(201,168,76,0.03) 0%, transparent 60%)", pointerEvents: "none" }} />

                  {/* Icon */}
                  <div style={{ fontSize: "1.6rem", marginBottom: "0.75rem", color: "var(--gold)", filter: "drop-shadow(0 0 8px rgba(201,168,76,0.3))", lineHeight: 1 }}>
                    {icon}
                  </div>

                  {/* Name */}
                  <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.82rem", fontWeight: 700, color: "var(--parchment)", letterSpacing: "0.06em", marginBottom: "0.5rem", lineHeight: 1.3 }}>
                    {t.name}
                  </div>

                  {/* Description */}
                  <div style={{ fontFamily: "var(--font-garamond, Georgia, serif)", fontSize: "0.85rem", color: "var(--parchment-dim)", lineHeight: 1.6, opacity: 0.65 }}>
                    {desc}
                  </div>

                  {/* Arrow */}
                  <div style={{ marginTop: "1rem", fontFamily: "var(--font-cinzel, serif)", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gold)", opacity: 0.6 }}>
                    Draft document →
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Latin footer */}
        <div style={{ marginTop: "3rem", textAlign: "center" }}>
          <div className="gold-divider" style={{ marginBottom: "1rem" }} />
          <div style={{ fontFamily: "var(--font-garamond, Georgia, serif)", fontSize: "0.88rem", color: "var(--parchment-dim)", opacity: 0.3, fontStyle: "italic", letterSpacing: "0.04em" }}>
            "Verba volant, scripta manent" — spoken words fly, written words remain
          </div>
        </div>
      </main>
    </div>
  );
}
