from pypdf import PdfReader

def extract_pdf_native(path: str):
    reader = PdfReader(path)
    pages = []
    full = []
    for idx, page in enumerate(reader.pages):
        text = (page.extract_text() or '').strip()
        pages.append({'page': idx + 1, 'text': text})
        full.append(text)
    joined = '\n'.join([x for x in full if x])
    return joined, pages
