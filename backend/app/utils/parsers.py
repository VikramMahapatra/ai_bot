import PyPDF2
import pdfplumber
from docx import Document
import openpyxl
import pandas as pd
from typing import List
import io


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
    """Split text into chunks with overlap, favoring paragraph boundaries for better retrieval."""
    if not text:
        return []

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [text.strip()]

    chunks: List[str] = []
    current = ""

    def _flush(chunk: str):
        if chunk:
            chunks.append(chunk)

    for paragraph in paragraphs:
        if len(paragraph) > chunk_size:
            if current:
                _flush(current)
                current = ""

            start = 0
            while start < len(paragraph):
                end = start + chunk_size
                chunk = paragraph[start:end]
                _flush(chunk)
                start = end - overlap if overlap > 0 else end
            continue

        if not current:
            current = paragraph
        elif len(current) + 2 + len(paragraph) <= chunk_size:
            current = f"{current}\n\n{paragraph}"
        else:
            _flush(current)
            if overlap > 0:
                tail = current[-overlap:]
                current = f"{tail}\n\n{paragraph}" if tail else paragraph
            else:
                current = paragraph

    _flush(current)
    return chunks
