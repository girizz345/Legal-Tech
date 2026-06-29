"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken, getCurrentUser, getToken, listContracts, listReminders, listReviews, type CurrentUser } from "@/lib/api";
import { LawBackground } from "@/components/LawBackground";
import { Sidebar } from "@/components/Sidebar";

interface Stat { label: string; value: number | string; icon: string; color: string; }
interface Feature { href: string; icon: string; title: string; desc: string; roles?: string[]; animDelay: string; }

const FEATURES: Feature[] = [
  { href: "/contracts",  icon: "◈", title: "Contracts",          desc: "View and manage all generated and uploaded contracts.", animDelay: "0ms" },
  { href: "/upload",     icon: "◎", title: "Upload & Extract",   desc: "Upload a PDF or DOCX to auto-extract key terms via OCR.", animDelay: "75ms" },
  { href: "/templates",  icon: "◉", title: "Draft from Template",desc: "Answer guided questions and generate a ready-to-sign contract.", animDelay: "150ms" },
  { href: "/reminders",  icon: "◇", title: "Obligations",        desc: "Upcoming deadlines and obligations flagged from your contracts.", animDelay: "225ms" },
  { href: "/advocate",   icon: "⚜", title: "Advocate Console",   desc: "Review queue, state transitions, and artifact uploads.", roles: ["advocate","admin"], animDelay: "300ms" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }

    getCurrentUser(token)
      .then(async (u) => {
        setUser(u);
        const [contracts, reviews, reminders] = await Promise.allSettled([
          listContracts(token),
          listReviews(token),
          listReminders(token, 30),
        ]);
        setStats([
          {
            label: "Contracts",
            value: contracts.status === "fulfilled" ? contracts.value.length : "—",
            icon: "◈",
            color: "#c9a84c",
          },
          {
            label: "Active Reviews",
            value: reviews.status === "fulfilled"
              ? reviews.value.filter((r) => r.state !== "closed").length
              : "—",
            icon: "⚖",
            color: "#e8c96a",
          },
          {
            label: "Upcoming",
            value: reminders.status === "fulfilled" ? reminders.value.length : "—",
            icon: "◇",
            color: "#f0d878",
          },
        ]);
      })
      .catch(() => { clearToken(); router.replace("/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--midnight)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LawBackground />
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: "2.5rem", animation: "float-slow 2s ease-in-out infinite" }}>⚖</div>
          <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.65rem", letterSpacing: "0.25em", color: "var(--gold)", textTransform: "uppercase", marginTop: "1rem", opacity: 0.7 }}>
            Loading the chambers…
          </div>
        </div>
      </div>
    );
  }

  const visibleFeatures = FEATURES.filter(
    (f) => !f.roles || (user && f.roles.includes(user.role))
  );

  return (
    <div className="page-shell">
      <LawBackground />
      <Sidebar />

      <main className="main-content" style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div className="animate-slide-up mb-10">
          <div
            style={{
              fontFamily: "var(--font-cinzel, serif)",
              fontSize: "0.58rem",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "var(--gold)",
              opacity: 0.65,
              marginBottom: "0.4rem",
            }}
          >
            The Chambers
          </div>
          <h1 className="page-title" style={{ fontSize: "2.2rem" }}>
            {user ? `Welcome, ${user.name.split(" ")[0]}` : "Dashboard"}
          </h1>
          <div
            style={{
              height: 1,
              width: 120,
              background: "linear-gradient(90deg, var(--gold), transparent)",
              marginTop: "0.6rem",
              opacity: 0.5,
            }}
          />
        </div>

        {/* Stats row */}
        <div
          className="animate-slide-up delay-100 mb-10"
          style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="animate-slide-up"
              style={{
                animationDelay: `${i * 80}ms`,
                background: "rgba(7,11,24,0.7)",
                border: "1px solid rgba(201,168,76,0.14)",
                borderRadius: 10,
                padding: "1.25rem 1.5rem",
                backdropFilter: "blur(20px)",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                transition: "border-color 0.3s, box-shadow 0.3s",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "rgba(201,168,76,0.35)";
                el.style.boxShadow = "0 4px 24px rgba(201,168,76,0.08)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "rgba(201,168,76,0.14)";
                el.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  fontSize: "1.4rem",
                  color: s.color,
                  filter: `drop-shadow(0 0 8px ${s.color}60)`,
                }}
              >
                {s.icon}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-cinzel, serif)",
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: s.color,
                    lineHeight: 1,
                    textShadow: `0 0 20px ${s.color}50`,
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-cinzel, serif)",
                    fontSize: "0.58rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--parchment-dim)",
                    marginTop: 3,
                    opacity: 0.7,
                  }}
                >
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="gold-divider mb-8 animate-fade-in delay-200" />

        {/* Feature grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {visibleFeatures.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="card animate-slide-up"
              style={{
                animationDelay: f.animDelay,
                textDecoration: "none",
                display: "block",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div
                  style={{
                    fontSize: "1.3rem",
                    color: "var(--gold)",
                    marginTop: 2,
                    filter: "drop-shadow(0 0 6px rgba(201,168,76,0.5))",
                    flexShrink: 0,
                    transition: "filter 0.3s",
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-cinzel, serif)",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: "var(--parchment)",
                      marginBottom: "0.35rem",
                    }}
                  >
                    {f.title}
                  </div>
                  <div
                    style={{
                      fontSize: "0.88rem",
                      color: "var(--parchment-dim)",
                      lineHeight: 1.5,
                      opacity: 0.75,
                    }}
                  >
                    {f.desc}
                  </div>
                </div>
              </div>
              {/* Bottom gold accent line */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: "20%",
                  right: "20%",
                  height: 1,
                  background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)",
                  opacity: 0,
                  transition: "opacity 0.3s",
                }}
                className="card-bottom-line"
              />
            </Link>
          ))}
        </div>

        {/* Bottom quote */}
        <div
          className="animate-fade-in delay-700 mt-14 text-center"
          style={{
            fontFamily: "var(--font-garamond, serif)",
            fontStyle: "italic",
            fontSize: "0.92rem",
            color: "rgba(184,169,138,0.28)",
            letterSpacing: "0.04em",
          }}
        >
          "Fiat justitia ruat caelum — Let justice be done though the heavens fall."
        </div>
      </main>
    </div>
  );
}
