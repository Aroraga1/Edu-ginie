import io
from PyPDF2 import PdfReader


def read_pdf_bytes_to_text(pdf_bytes: bytes, max_chars: int = 200_000) -> str:
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        texts = []
        for page in reader.pages:
            t = page.extract_text() or ""
            if t:
                texts.append(t)
            if sum(len(s) for s in texts) > max_chars:
                break
        out = "\n\n".join(texts)
        return out[:max_chars]
    except Exception:
        return ""


def optimize_pdf_text(pdf_text: str, max_chars=120000) -> str:
    if len(pdf_text) <= max_chars:
        return pdf_text
    first_part = pdf_text[:int(max_chars * 0.8)]
    last_part = pdf_text[-int(max_chars * 0.2):]
    return f"{first_part}\n\n[... content truncated for length ...]\n\n{last_part}"


