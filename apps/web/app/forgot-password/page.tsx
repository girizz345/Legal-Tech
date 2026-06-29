"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ScalesOfJustice } from "@/components/ScalesOfJustice";
import { LawBackground } from "@/components/LawBackground";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--midnight)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <LawBackground />

      {/* Courthouse arch */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 500, height: 220, border: "1px solid rgba(201,168,76,0.08)", borderBottom: "none", borderRadius: "250px 250px 0 0", pointerEvents: "none" }} />
      {[-42, -36, 36, 42].map((offset, i) => (
        <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `calc(50% + ${offset}%)`, width: 1, background: `linear-gradient(180deg, rgba(201,168,76,${i < 2 ? 0.12 : 0.08}) 0%, rgba(201,168,76,0.03) 60%, transparent 100%)`, pointerEvents: "none" }} />
      ))}

      <div className="animate-scale-in" style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 400, margin: "0 1.5rem" }}>
        <div className="flex flex-col items-center mb-6 animate-slide-up">
          <ScalesOfJustice size={90} animate glow />
        </div>

        <div style={{ background: "rgba(7,11,24,0.88)", border: "1px solid rgba(201,168,76,0.22)", borderRadius: 14, padding: "2.5rem", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(201,168,76,0.07), inset 0 1px 0 rgba(201,168,76,0.1)", position: "relative", overflow: "hidden" }}>
          {["top-2 left-2 border-l border-t", "top-2 right-2 border-r border-t", "bottom-2 left-2 border-l border-b", "bottom-2 right-2 border-r border-b"].map((cls, i) => (
            <div key={i} className={`absolute ${cls} w-4 h-4`} style={{ borderColor: "rgba(201,168,76,0.4)" }} />
          ))}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(201,168,76,0.04) 0%, transparent 50%, rgba(201,168,76,0.02) 100%)", pointerEvents: "none" }} />

          {/* Title */}
          <div className="text-center mb-8" style={{ position: "relative" }}>
            <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.6rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--gold)", marginBottom: "0.5rem", opacity: 0.7 }}>
              — Credential Recovery —
            </div>
            <h1 style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "1.3rem", fontWeight: 900, letterSpacing: "0.1em", color: "var(--parchment)" }}>
              Reset Passphrase
            </h1>
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)", marginTop: "0.75rem" }} />
          </div>

          {submitted ? (
            <div className="animate-scale-in text-center">
              {/* Success state */}
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem", animation: "float 3s ease-in-out infinite" }}>⚖</div>
              <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.95rem", fontWeight: 600, color: "var(--parchment)", marginBottom: "0.75rem" }}>
                Request Received
              </div>
              <div style={{ fontSize: "0.88rem", color: "var(--parchment-dim)", lineHeight: 1.7, marginBottom: "2rem", fontFamily: "var(--font-garamond, serif)", fontStyle: "italic" }}>
                If an account exists for <span style={{ color: "var(--gold)" }}>{email}</span>, a reset link will be dispatched to that address. Please check your inbox.
              </div>
              <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", fontSize: "0.78rem", color: "var(--parchment-dim)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                <span style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold)", display: "block", marginBottom: 4 }}>Note</span>
                If you do not receive an email within 10 minutes, contact your administrator to reset your credentials manually.
              </div>
              <Link href="/login" className="btn-primary" style={{ display: "block", textAlign: "center", padding: "0.75rem", fontSize: "0.68rem", letterSpacing: "0.14em", textDecoration: "none" }}>
                Return to Chambers
              </Link>
            </div>
          ) : (
            <>
              <p style={{ fontSize: "0.88rem", color: "var(--parchment-dim)", lineHeight: 1.7, marginBottom: "1.5rem", fontFamily: "var(--font-garamond, serif)", fontStyle: "italic", textAlign: "center" }}>
                Enter your registered email address and we will send you a link to reset your passphrase.
              </p>

              <form onSubmit={handleSubmit} style={{ position: "relative" }}>
                <div className="mb-6 animate-slide-up delay-100">
                  <label className="label">Registered Email</label>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="counsel@chambers.in" required autoComplete="email" />
                </div>

                <button type="submit" className="btn-primary w-full animate-slide-up delay-200" style={{ padding: "0.85rem", fontSize: "0.72rem", letterSpacing: "0.16em" }}>
                  Send Reset Link
                </button>
              </form>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.5rem 0 1.25rem" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(201,168,76,0.12)" }} />
                <span style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.52rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(184,169,138,0.3)" }}>or</span>
                <div style={{ flex: 1, height: 1, background: "rgba(201,168,76,0.12)" }} />
              </div>

              <Link href="/login" className="btn-secondary w-full animate-fade-in delay-300" style={{ display: "block", textAlign: "center", padding: "0.75rem", fontSize: "0.68rem", letterSpacing: "0.14em", textDecoration: "none" }}>
                Back to Sign In
              </Link>
            </>
          )}

          <div className="mt-6 text-center" style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.54rem", letterSpacing: "0.15em", color: "rgba(184,169,138,0.3)", textTransform: "uppercase" }}>
            LegalTech · Chambers of Law · MMXXVI
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.15), transparent)", pointerEvents: "none" }} />
    </div>
  );
}
