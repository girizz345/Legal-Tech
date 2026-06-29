"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login, register, saveToken } from "@/lib/api";
import { ScalesOfJustice } from "@/components/ScalesOfJustice";
import { LawBackground } from "@/components/LawBackground";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password === confirm || confirm === "";
  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;
  const strengthLabel = ["", "Weak", "Fair", "Strong", "Excellent"][strength];
  const strengthColor = ["", "#f87171", "#fdba74", "#4ade80", "#c9a84c"][strength];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passphrases do not match"); return; }
    if (password.length < 6) { setError("Passphrase must be at least 6 characters"); return; }
    setError(null);
    setLoading(true);
    try {
      await register({ name, email, password });
      // Auto-login after registration
      const { access_token } = await login(email, password);
      saveToken(access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--midnight)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <LawBackground />

      {/* Courthouse arch */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 500, height: 220, border: "1px solid rgba(201,168,76,0.08)", borderBottom: "none", borderRadius: "250px 250px 0 0", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 340, height: 160, border: "1px solid rgba(201,168,76,0.05)", borderBottom: "none", borderRadius: "170px 170px 0 0", pointerEvents: "none" }} />
      {[-42, -36, 36, 42].map((offset, i) => (
        <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `calc(50% + ${offset}%)`, width: 1, background: `linear-gradient(180deg, rgba(201,168,76,${i < 2 ? 0.12 : 0.08}) 0%, rgba(201,168,76,0.03) 60%, transparent 100%)`, pointerEvents: "none" }} />
      ))}

      {/* Card */}
      <div className="animate-scale-in" style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 440, margin: "0 1.5rem" }}>
        {/* Scales */}
        <div className="flex flex-col items-center mb-6 animate-slide-up">
          <ScalesOfJustice size={90} animate glow />
        </div>

        <div style={{ background: "rgba(7,11,24,0.88)", border: "1px solid rgba(201,168,76,0.22)", borderRadius: 14, padding: "2.5rem", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(201,168,76,0.07), inset 0 1px 0 rgba(201,168,76,0.1)", position: "relative", overflow: "hidden" }}>
          {/* Corner accents */}
          {["top-2 left-2 border-l border-t", "top-2 right-2 border-r border-t", "bottom-2 left-2 border-l border-b", "bottom-2 right-2 border-r border-b"].map((cls, i) => (
            <div key={i} className={`absolute ${cls} w-4 h-4`} style={{ borderColor: "rgba(201,168,76,0.4)" }} />
          ))}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(201,168,76,0.04) 0%, transparent 50%, rgba(201,168,76,0.02) 100%)", pointerEvents: "none" }} />

          {/* Title */}
          <div className="text-center mb-7" style={{ position: "relative" }}>
            <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.6rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--gold)", marginBottom: "0.5rem", opacity: 0.7 }}>
              — New Member —
            </div>
            <h1 style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "1.4rem", fontWeight: 900, letterSpacing: "0.12em", color: "var(--parchment)" }}>
              Request Access
            </h1>
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)", marginTop: "0.75rem" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ position: "relative" }}>
            <div className="mb-4 animate-slide-up delay-75">
              <label className="label">Full Name</label>
              <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Adv. First Last" required autoComplete="name" />
            </div>

            <div className="mb-4 animate-slide-up delay-100">
              <label className="label">Email address</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="counsel@chambers.in" required autoComplete="email" />
            </div>

            <div className="mb-2 animate-slide-up delay-150">
              <label className="label">Passphrase</label>
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a strong passphrase"
                  required
                  autoComplete="new-password"
                  style={{ paddingRight: "3rem" }}
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(184,169,138,0.5)", fontSize: "0.9rem", lineHeight: 1, padding: 0, transition: "color 0.2s" }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--gold)"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(184,169,138,0.5)"; }}>
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
              {/* Strength bar */}
              {password.length > 0 && (
                <div className="animate-scale-in" style={{ marginTop: "0.4rem" }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 3 }}>
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} style={{ flex: 1, height: 2, borderRadius: 1, background: n <= strength ? strengthColor : "rgba(255,255,255,0.07)", transition: "background 0.3s" }} />
                    ))}
                  </div>
                  <div style={{ fontSize: "0.6rem", fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.1em", color: strengthColor, textTransform: "uppercase" }}>{strengthLabel}</div>
                </div>
              )}
            </div>

            <div className="mb-5 animate-slide-up delay-200">
              <label className="label">Confirm Passphrase</label>
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter passphrase"
                  required
                  autoComplete="new-password"
                  style={{ paddingRight: "3rem", borderColor: !passwordsMatch && confirm ? "rgba(239,68,68,0.5)" : undefined }}
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(184,169,138,0.5)", fontSize: "0.9rem", lineHeight: 1, padding: 0, transition: "color 0.2s" }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--gold)"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(184,169,138,0.5)"; }}>
                  {showConfirm ? "🙈" : "👁"}
                </button>
              </div>
              {!passwordsMatch && confirm && (
                <div className="animate-scale-in" style={{ marginTop: "0.3rem", fontSize: "0.72rem", color: "#f87171" }}>Passphrases do not match</div>
              )}
            </div>

            {error && (
              <div className="mb-4 animate-scale-in" style={{ padding: "0.6rem 0.875rem", borderRadius: 6, background: "rgba(139,26,26,0.18)", border: "1px solid rgba(139,26,26,0.4)", fontSize: "0.82rem", color: "#ff8a8a", fontFamily: "var(--font-garamond, serif)" }}>
                ⚖ {error}
              </div>
            )}

            <button type="submit" disabled={loading || !passwordsMatch} className="btn-primary w-full animate-slide-up delay-300" style={{ padding: "0.85rem", fontSize: "0.72rem", letterSpacing: "0.16em" }}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(10,13,24,0.3)", borderTopColor: "#0a0d18", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  Registering…
                </span>
              ) : (
                "Enter the Chambers"
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.5rem 0 1.25rem" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(201,168,76,0.12)" }} />
            <span style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.52rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(184,169,138,0.3)" }}>Already a member?</span>
            <div style={{ flex: 1, height: 1, background: "rgba(201,168,76,0.12)" }} />
          </div>

          <Link href="/login" className="btn-secondary w-full animate-fade-in delay-400" style={{ display: "block", textAlign: "center", padding: "0.75rem", fontSize: "0.68rem", letterSpacing: "0.14em", textDecoration: "none" }}>
            Sign In to Chambers
          </Link>

          <div className="mt-6 text-center animate-fade-in delay-500" style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.54rem", letterSpacing: "0.15em", color: "rgba(184,169,138,0.3)", textTransform: "uppercase" }}>
            LegalTech · Chambers of Law · MMXXVI
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.15), transparent)", pointerEvents: "none" }} />
    </div>
  );
}
