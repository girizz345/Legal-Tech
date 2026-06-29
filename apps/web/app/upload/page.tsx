"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken, uploadContract, type ExtractedTerm, type UploadResult } from "@/lib/api";
import { LawBackground } from "@/components/LawBackground";
import { Sidebar } from "@/components/Sidebar";

function ConfBar({ value }: { value: number }) {
  const color = value >= 0.6 ? "#4ade80" : value >= 0.4 ? "#facc15" : "#f87171";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
        <div style={{ width: `${value * 100}%`, height: "100%", background: color, borderRadius: 2, boxShadow: `0 0 6px ${color}80`, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: "0.7rem", color, fontFamily: "var(--font-cinzel, serif)", minWidth: 28 }}>{Math.round(value * 100)}%</span>
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");

  function handleFile(file: File) {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    setError(""); setResult(null); setUploading(true);
    uploadContract(token, file).then(setResult).catch((e) => setError(e.message)).finally(() => setUploading(false));
  }

  return (
    <div className="page-shell">
      <LawBackground />
      <Sidebar />
      <main className="main-content" style={{ position: "relative", zIndex: 1, maxWidth: 720 }}>
        <div className="animate-slide-up mb-8">
          <div className="section-title mb-1">Intake</div>
          <h1 className="page-title">Upload a Contract</h1>
        </div>

        {!result && (
          <div
            className="animate-scale-in"
            style={{
              border: `2px dashed ${dragging ? "rgba(201,168,76,0.7)" : "rgba(201,168,76,0.22)"}`,
              borderRadius: 14,
              padding: "4rem 2rem",
              textAlign: "center",
              background: dragging ? "rgba(201,168,76,0.04)" : "rgba(7,11,24,0.5)",
              cursor: "pointer",
              transition: "all 0.3s ease",
              backdropFilter: "blur(16px)",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" className="hidden" accept=".pdf,.docx,.png,.jpg,.jpeg,.tiff,.bmp" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {uploading ? (
              <>
                <div style={{ fontSize: "2.5rem", animation: "float 1.5s ease-in-out infinite", marginBottom: "1rem", filter: "drop-shadow(0 0 12px rgba(201,168,76,0.6))" }}>⚖</div>
                <div className="section-title mb-1">Processing document…</div>
                <div style={{ fontSize: "0.82rem", color: "var(--parchment-dim)", opacity: 0.6 }}>Extracting text and identifying key terms</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem", opacity: 0.4 }}>◎</div>
                <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.85rem", fontWeight: 600, color: "var(--parchment)", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                  Drop a file here, or click to select
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--parchment-dim)", opacity: 0.5 }}>PDF · DOCX · PNG · JPG — max 20 MB</div>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="animate-scale-in mt-4" style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(139,26,26,0.18)", border: "1px solid rgba(139,26,26,0.4)", color: "#ff8a8a" }}>
            {error}
          </div>
        )}

        {result && (
          <div className="animate-scale-in space-y-4">
            {/* Success banner */}
            <div style={{ padding: "1rem 1.25rem", borderRadius: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ fontSize: "1.5rem", animation: "gavel-strike 0.5s ease-out", transformOrigin: "bottom right" }}>🔨</div>
              <div>
                <div style={{ fontFamily: "var(--font-cinzel, serif)", fontSize: "0.78rem", fontWeight: 700, color: "#4ade80" }}>{result.filename}</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(74,222,128,0.6)", fontFamily: "monospace", marginTop: 2 }}>ID: {result.contract_id.slice(0, 12)}…</div>
              </div>
            </div>

            {/* OCR excerpt */}
            {result.ocr_excerpt && (
              <div className="card">
                <div className="section-title mb-3">Extracted Text Preview</div>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.78rem", color: "var(--parchment-dim)", lineHeight: 1.6, maxHeight: 160, overflowY: "auto", background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: 6, opacity: 0.8 }}>
                  {result.ocr_excerpt}
                </pre>
              </div>
            )}

            {/* Terms */}
            <div className="card">
              <div className="section-title mb-4">Identified Terms</div>
              {result.extracted_terms.length === 0 ? (
                <p style={{ color: "var(--parchment-dim)", opacity: 0.5, fontSize: "0.88rem" }}>No terms identified automatically.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {result.extracted_terms.map((t: ExtractedTerm, i) => (
                    <div key={t.key} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                        <span className="section-title">{t.key.replace(/_/g, " ")}</span>
                      </div>
                      <div style={{ fontFamily: "var(--font-garamond, serif)", fontSize: "0.95rem", color: t.value ? "var(--parchment)" : "var(--parchment-dim)", opacity: t.value ? 1 : 0.4, marginBottom: "0.3rem" }}>
                        {t.value ?? "Not identified"}
                      </div>
                      <ConfBar value={t.confidence} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link href={`/contracts/${result.contract_id}/review`} className="btn-primary">Request Review</Link>
              <Link href={`/contracts/${result.contract_id}/chat`} className="btn-secondary">Ask about this</Link>
              <Link href="/contracts" className="btn-secondary">All contracts</Link>
              <button className="btn-secondary" onClick={() => { setResult(null); setError(""); }}>Upload another</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
