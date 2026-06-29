"use client";

import type { FieldSchema } from "@/lib/api";

interface FieldFormProps {
  fields: FieldSchema[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
}

export default function FieldForm({ fields, values, onChange }: FieldFormProps) {
  return (
    <>
      {fields.map((field) => (
        <div key={field.id} style={{ marginBottom: 16 }}>
          <label htmlFor={field.id} style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
            {field.label}
            {field.required && <span style={{ color: "#b00020" }}> *</span>}
          </label>
          {field.help_text && (
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 4px" }}>{field.help_text}</p>
          )}
          {field.type === "select" ? (
            <select
              id={field.id}
              value={values[field.id] ?? ""}
              required={field.required}
              onChange={(e) => onChange(field.id, e.target.value)}
              style={{ display: "block", width: "100%", padding: 8 }}
            >
              <option value="" disabled>
                Select...
              </option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={field.id}
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              value={values[field.id] ?? ""}
              required={field.required}
              maxLength={field.max_length}
              min={field.min}
              max={field.max}
              onChange={(e) => onChange(field.id, e.target.value)}
              style={{ display: "block", width: "100%", padding: 8 }}
            />
          )}
        </div>
      ))}
    </>
  );
}
