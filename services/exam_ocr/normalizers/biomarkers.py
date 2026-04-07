import re

ALIASES = {
    'glicose': 'glucose',
    'glucose': 'glucose',
    'hba1c': 'hba1c',
    'hemoglobina glicada': 'hba1c',
    'creatinina': 'creatinine',
    'potassio': 'potassium',
    'potássio': 'potassium',
    'sodio': 'sodium',
    'sódio': 'sodium',
    'ldl': 'ldl',
    'hdl': 'hdl',
    'triglicerideos': 'triglycerides',
    'triglicerídeos': 'triglycerides',
}

NUM_RE = re.compile(r'(-?\d+[\.,]?\d*)')

def parse_biomarkers(lines):
    out = []
    for line in lines:
        text = str(line.get('line', '')).strip().lower()
        if not text:
            continue
        marker_key = None
        for alias, key in ALIASES.items():
            if alias in text:
                marker_key = key
                break
        if not marker_key:
            continue
        m = NUM_RE.search(text)
        if not m:
            continue
        value = float(m.group(1).replace(',', '.'))
        out.append({
            'marker_key': marker_key,
            'marker_name': marker_key,
            'value_numeric': value,
            'value_text': m.group(1),
            'source_line': text,
            'confidence': 0.75,
        })
    return out
