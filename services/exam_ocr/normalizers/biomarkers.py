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

NUM_RE = re.compile(r'(-?\d+(?:[\.,]\d+)?)')
RANGE_RE = re.compile(r'(-?\d+(?:[\.,]\d+)?)\s*(?:a|-|até)\s*(-?\d+(?:[\.,]\d+)?)', re.IGNORECASE)
UNIT_RE = re.compile(r'(mg/dl|g/dl|mmol/l|ui/l|mui/ml|ng/ml|pg/ml|10\^?\d*/?u?l|%|fl|pg)\b', re.IGNORECASE)

def _to_float(raw):
    try:
        return float(str(raw).replace(',', '.'))
    except Exception:
        return None

def _extract_reference(text):
    ref_match = re.search(r'(?:refer[êe]ncia|vr|valor(?:es)? de refer[êe]ncia)\s*[:\-]?\s*([^\|]+)$', text, re.IGNORECASE)
    if not ref_match:
        ref_match = re.search(r'(\d+(?:[\.,]\d+)?\s*(?:a|-|até)\s*\d+(?:[\.,]\d+)?)', text, re.IGNORECASE)
    if not ref_match:
        return None, None, None
    ref_text = ref_match.group(1).strip()
    range_match = RANGE_RE.search(ref_text)
    if range_match:
        return _to_float(range_match.group(1)), _to_float(range_match.group(2)), ref_text
    return None, None, ref_text

def parse_biomarkers(lines):
    out = []
    for line in lines:
        raw_line = str(line.get('line', '')).strip()
        text = raw_line.lower()
        if not text:
            continue
        marker_key = None
        for alias, key in ALIASES.items():
            if re.search(rf'\b{re.escape(alias)}\b', text):
                marker_key = key
                break
        if not marker_key:
            continue
        start_idx = text.find(alias)
        segment = raw_line[start_idx:] if start_idx >= 0 else raw_line
        num_candidates = list(NUM_RE.finditer(segment))
        if not num_candidates:
            continue

        main_value = None
        main_match = None
        for candidate in num_candidates:
            preview = segment[max(0, candidate.start() - 12):candidate.end() + 24].lower()
            if re.search(r'(refer|vr|m[íi]nimo|max|at[ée])', preview):
                continue
            main_value = _to_float(candidate.group(1))
            main_match = candidate
            break

        if main_value is None and num_candidates:
            main_match = num_candidates[0]
            main_value = _to_float(main_match.group(1))
        if main_value is None or main_match is None:
            continue

        trailing = segment[main_match.end(): main_match.end() + 24]
        unit_match = UNIT_RE.search(trailing)
        unit = unit_match.group(1) if unit_match else None
        ref_min, ref_max, ref_text = _extract_reference(segment)

        out.append({
            'marker_key': marker_key,
            'marker_name': marker_key,
            'value_numeric': main_value,
            'value_text': main_match.group(1),
            'unit': unit.lower() if unit else None,
            'reference_min': ref_min,
            'reference_max': ref_max,
            'reference_text': ref_text,
            'source_line': raw_line,
            'confidence': 0.82 if unit or ref_text else 0.75,
        })
    return out
