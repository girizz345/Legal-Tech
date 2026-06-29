"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getCurrentUser, getToken, type CurrentUser } from "@/lib/api";
import { useEffect, useState } from "react";
import { ScalesOfJustice } from "./ScalesOfJustice";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",  label: "Dashboard",  icon: "⬡" },
  { href: "/contracts",  label: "Contracts",   icon: "◈" },
  { href: "/upload",     label: "Upload",      icon: "◎" },
  { href: "/reminders",  label: "Reminders",   icon: "◇" },
  { href: "/templates",  label: "Templates",   icon: "◉" },
  { href: "/advocate",   label: "Advocate",    icon: "⚜", roles: ["advocate", "admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getCurrentUser(token).then(setUser).catch(() => {});
  }, []);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  const visible = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 flex flex-col"
      style={{
        width: 248,
        background: "rgba(7,11,24,0.88)",
        borderRight: "1px solid rgba(201,168,76,0.14)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        boxShadow: "4px 0 48px rgba(0,0,0,0.55)",
        zIndex: 50,
      }}
    >
      {/* Brand */}
      <div className="flex flex-col items-center px-6 pt-8 pb-6">
        <div className="animate-float-slow mb-3">
          <ScalesOfJustice size={72} animate glow />
        </div>
        <div
          className="text-gold-shimmer text-center"
          style={{
            fontFamily: "var(--font-cinzel, serif)",
            fontSize: "1.05rem",
            fontWeight: 900,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            background: "linear-gradient(90deg,#8a6f2a,#c9a84c,#f5e6a3,#c9a84c,#8a6f2a)",
            backgroundSize: "220% auto",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "shimmer-gold 4s linear infinite",
          }}
        >
          LegalTech
        </div>
        <div
          style={{
            fontFamily: "var(--font-cinzel, serif)",
            fontSize: "0.52rem",
            letterSpacing: "0.25em",
            color: "var(--parchment-dim)",
            textTransform: "uppercase",
            marginTop: 2,
            opacity: 0.6,
          }}
        >
          Chambers of Law
        </div>
      </div>

      {/* Top divider */}
      <div className="gold-divider mx-4" />

      {/* Nav label */}
      <div
        className="px-6 py-3"
        style={{
          fontFamily: "var(--font-cinzel, serif)",
          fontSize: "0.55rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(184,169,138,0.45)",
        }}
      >
        Navigation
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.6rem 0.875rem",
                borderRadius: 6,
                borderLeft: active ? "2px solid var(--gold)" : "2px solid transparent",
                background: active ? "rgba(201,168,76,0.08)" : "transparent",
                color: active ? "var(--gold)" : "var(--parchment-dim)",
                fontFamily: "var(--font-cinzel, serif)",
                fontSize: "0.68rem",
                fontWeight: active ? 700 : 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                textDecoration: "none",
                transition: "all 0.25s ease",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(201,168,76,0.04)";
                  el.style.color = "var(--parchment)";
                  el.style.borderLeftColor = "rgba(201,168,76,0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "transparent";
                  el.style.color = "var(--parchment-dim)";
                  el.style.borderLeftColor = "transparent";
                }
              }}
            >
              {/* Active shimmer sweep */}
              {active && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.05) 50%, transparent 100%)",
                    animation: "shimmer-gold 3s linear infinite",
                  }}
                />
              )}
              <span style={{ fontSize: "0.85rem", opacity: active ? 1 : 0.6 }}>{item.icon}</span>
              <span style={{ position: "relative" }}>{item.label}</span>
              {active && (
                <span
                  style={{
                    marginLeft: "auto",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "var(--gold)",
                    boxShadow: "0 0 6px var(--gold)",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom divider */}
      <div className="gold-divider mx-4 mb-3" />

      {/* User + logout */}
      <div className="px-5 pb-6">
        {user && (
          <div
            className="mb-3 flex items-center gap-3"
            style={{
              padding: "0.6rem 0.75rem",
              borderRadius: 6,
              background: "rgba(201,168,76,0.04)",
              border: "1px solid rgba(201,168,76,0.1)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #8a6f2a, #c9a84c)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.65rem",
                fontWeight: 700,
                color: "#0a0d18",
                fontFamily: "var(--font-cinzel, serif)",
                flexShrink: 0,
              }}
            >
              {user.name[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-cinzel, serif)",
                  fontSize: "0.62rem",
                  fontWeight: 600,
                  color: "var(--parchment)",
                  letterSpacing: "0.06em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.name}
              </div>
              <div
                style={{
                  fontSize: "0.55rem",
                  color: "var(--gold)",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  fontFamily: "var(--font-cinzel, serif)",
                }}
              >
                {user.role}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          style={{
            width: "100%",
            padding: "0.5rem",
            fontFamily: "var(--font-cinzel, serif)",
            fontSize: "0.6rem",
            fontWeight: 600,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "rgba(184,169,138,0.5)",
            background: "transparent",
            border: "1px solid rgba(201,168,76,0.1)",
            borderRadius: 5,
            cursor: "pointer",
            transition: "all 0.25s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.color = "#ff7070";
            el.style.borderColor = "rgba(139,26,26,0.4)";
            el.style.background = "rgba(139,26,26,0.08)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.color = "rgba(184,169,138,0.5)";
            el.style.borderColor = "rgba(201,168,76,0.1)";
            el.style.background = "transparent";
          }}
        >
          ◁ Exit Chambers
        </button>
      </div>
    </aside>
  );
}
