import PyPDF2
import pdfplumber
from docx import Document
import openpyxl
import pandas as pd
from typing import List
import io
import re


def parse_pdf(file_content: bytes) -> str:
    """Parse PDF file and extract text"""
    text = ""
    
    try:
        # Try pdfplumber first (better for complex PDFs)
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        # Fallback to PyPDF2
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        except Exception as e2:
            raise Exception(f"Failed to parse PDF: {str(e)}, {str(e2)}")
    
    return text.strip()


def parse_docx(file_content: bytes) -> str:
    """Parse DOCX file and extract text"""
    try:
        doc = Document(io.BytesIO(file_content))
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to parse DOCX: {str(e)}")


def parse_xlsx(file_content: bytes) -> str:
    """Parse XLSX file and extract text"""
    try:
        # Use pandas for better handling
        df = pd.read_excel(io.BytesIO(file_content), sheet_name=None)
        
        text_parts = []
        for sheet_name, sheet_df in df.items():
            text_parts.append(f"Sheet: {sheet_name}\n")
            text_parts.append(sheet_df.to_string(index=False))
            text_parts.append("\n")
        
        return "\n".join(text_parts).strip()
    except Exception as e:
        raise Exception(f"Failed to parse XLSX: {str(e)}")


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Split text into sentence-aware chunks with overlap for better retrieval precision."""
    if not text:
        return []

    normalized_text = re.sub(r"\r\n?", "\n", text)
    normalized_text = re.sub(r"\n{3,}", "\n\n", normalized_text)

    paragraphs = [p.strip() for p in normalized_text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [normalized_text.strip()]

    chunks: List[str] = []
    current_sentences: List[str] = []
    current_len = 0

    sentence_splitter = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"\(\[])")

    def _flush(chunk: str):
        compact = " ".join(chunk.split()).strip()
        if compact:
            chunks.append(compact)

    def _flush_current() -> None:
        nonlocal current_sentences, current_len
        if not current_sentences:
            return
        _flush(" ".join(current_sentences))
        current_sentences = []
        current_len = 0

    def _set_overlap_seed() -> None:
        nonlocal current_sentences, current_len
        if overlap <= 0 or not chunks:
            current_sentences = []
            current_len = 0
            return

        tail_text = chunks[-1][-overlap:]
        current_sentences = [tail_text] if tail_text else []
        current_len = len(tail_text)

    def _split_sentence_long(sentence: str) -> List[str]:
        if len(sentence) <= chunk_size:
            return [sentence]
        pieces: List[str] = []
        start = 0
        while start < len(sentence):
            end = min(len(sentence), start + chunk_size)
            pieces.append(sentence[start:end].strip())
            if end >= len(sentence):
                break
            start = max(end - overlap, start + 1) if overlap > 0 else end
        return [p for p in pieces if p]

    for paragraph in paragraphs:
        paragraph_clean = " ".join(paragraph.split()).strip()
        if not paragraph_clean:
            continue

        sentences = [s.strip() for s in sentence_splitter.split(paragraph_clean) if s.strip()]
        if not sentences:
            sentences = [paragraph_clean]

        for sentence in sentences:
            for piece in _split_sentence_long(sentence):
                candidate_len = len(piece) + (1 if current_sentences else 0)
                if current_len + candidate_len <= chunk_size:
                    current_sentences.append(piece)
                    current_len += candidate_len
                    continue

                _flush_current()
                _set_overlap_seed()

                candidate_len = len(piece) + (1 if current_sentences else 0)
                if current_len + candidate_len <= chunk_size:
                    current_sentences.append(piece)
                    current_len += candidate_len
                else:
                    _flush(piece)
                    _set_overlap_seed()

    _flush_current()
    return chunks
