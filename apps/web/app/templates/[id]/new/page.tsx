"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { generateDocument, getToken, getTemplate, type TemplateDetail } from "@/lib/api";
import FieldForm from "./FieldForm";

export default function NewDocumentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    getTemplate(token, params.id)
      .then(setTemplate)
      .finally(() => setLoading(false));
  }, [params.id, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await generateDocument(token, params.id, values);
      router.push(`/contracts/${result.contract_id}/preview`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate document");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main style={{ padding: 40 }}>Loading...</main>;
  if (!template) return <main style={{ padding: 40 }}>Template not found.</main>;

  return (
    <main style={{ padding: 40, maxWidth: 560 }}>
      <h1>{template.name}</h1>
      <form onSubmit={handleSubmit}>
        <FieldForm
          fields={template.schema_json.fields}
          values={values}
          onChange={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
        />
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ padding: "8px 16px" }}>
          {submitting ? "Generating..." : "Generate Draft"}
        </button>
      </form>
    </main>
  );
}
