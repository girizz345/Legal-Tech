"""
Text extraction from uploaded documents.

Priority order:
  1. PDF  → pdfminer.six (pure Python, no binary required)
  2. DOCX → python-docx (already in requirements)
  3. Image (PNG/JPG/TIFF) → pytesseract (requires Tesseract binary; degrades gracefully)

All functions return plain text or empty string — never raise.
"""
from __future__ import annotations

import io


def extract_text(file_bytes: bytes, filename: str) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return _from_pdf(file_bytes)
    if name.endswith(".docx"):
        return _from_docx(file_bytes)
    if name.endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp")):
        return _from_image(file_bytes)
    # Fallback: try PDF, then DOCX
    text = _from_pdf(file_bytes)
    return text or _from_docx(file_bytes)


def _from_pdf(data: bytes) -> str:
    try:
        from pdfminer.high_level import extract_text as _pdf
        return _pdf(io.BytesIO(data)) or ""
    except Exception:
        return ""


def _from_docx(data: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception:
        return ""


def _from_image(data: bytes) -> str:
    try:
        import pytesseract
        from PIL import Image
        return pytesseract.image_to_string(Image.open(io.BytesIO(data))) or ""
    except Exception:
        return ""
