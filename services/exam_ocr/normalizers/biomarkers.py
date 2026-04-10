import re
import unicodedata


MARKERS = [
    {
        'marker_key': 'psa_free',
        'marker_name': 'PSA livre',
        'aliases': [
            'psa livre',
            'psa livre antígeno prostático específico',
            'psa livre antigeno prostatico especifico',
        ],
    },
    {
        'marker_key': 'psa_total',
        'marker_name': 'PSA total',
        'aliases': [
            'psa total antígeno prostático específico',
            'psa total antigeno prostatico especifico',
            'psa total',
        ],
    },
    {
        'marker_key': 'testosterone_total',
        'marker_name': 'Testosterona total',
        'aliases': ['testosterona total'],
    },
    {
        'marker_key': 'testosterone_free',
        'marker_name': 'Testosterona livre',
        'aliases': ['testosterona livre'],
    },
    {
        'marker_key': 'total_cholesterol',
        'marker_name': 'Colesterol total',
        'aliases': ['colesterol total'],
    },
    {
        'marker_key': 'hdl_cholesterol',
        'marker_name': 'Colesterol HDL',
        'aliases': ['colesterol hdl', 'hdl colesterol', 'hdl'],
    },
    {
        'marker_key': 'triglycerides',
        'marker_name': 'Triglicérides',
        'aliases': ['triglicérides', 'triglicerides', 'triglicerídeos', 'triglicerideos'],
    },
    {
        'marker_key': 'ast',
        'marker_name': 'TGO / AST',
        'aliases': [
            'transaminase glutamico oxalacetica',
            'transaminase glutâmico oxalacética',
            'oxalacetica-tgo',
            'oxalacética-tgo',
            'tgo',
            'ast',
        ],
    },
    {
        'marker_key': 'alt',
        'marker_name': 'TGP / ALT',
        'aliases': [
            'transaminase glutamico piruvica',
            'transaminase glutâmico pirúvica',
            'piruvica-tgp',
            'pirúvica-tgp',
            'tgp',
            'alt',
        ],
    },
]

NUMBER_RE = re.compile(r'(?<![\d/])(-?\d{1,4}(?:[.,]\d{1,4})?)(?![\d/])')
UNIT_RE = re.compile(
    r'\b('
    r'mg/dl|g/dl|mmol/l|ui/l|u/l|mui/ml|ui/ml|ng/ml|ng/dl|pg/ml|pg/dl|'
    r'mmol\/l|10\^?\d+/?u?l|%|fl|pg'
    r')\b',
    re.IGNORECASE,
)
RANGE_RE = re.compile(r'(-?\d+(?:[.,]\d+)?)\s*(?:a|-|até)\s*(-?\d+(?:[.,]\d+)?)', re.IGNORECASE)
LESS_THAN_RE = re.compile(r'(?:inferior|menor|abaixo)\s+a\s*(-?\d+(?:[.,]\d+)?)', re.IGNORECASE)
GREATER_THAN_RE = re.compile(r'(?:superior|maior|acima)\s+a\s*(-?\d+(?:[.,]\d+)?)', re.IGNORECASE)

STOP_PATTERNS = [
    'material',
    'metodo',
    'método',
    'assinado eletronicamente',
    'assinatura digital',
    'data de aprovacao',
    'data de aprovação',
    'data de saida',
    'data de saída',
    'tecnico(a) responsavel',
    'técnico(a) responsável',
    'nº do registro',
    'no do registro',
    'exame realizado',
]

REFERENCE_HINTS = [
    'referencia',
    'referência',
    'valores de referencia',
    'valor(es) de referencia',
    'homens',
    'mulheres',
    'adultos',
    'criancas',
    'crianças',
    'adolescentes',
    'jejum',
    'fase',
    'menacme',
    'masculino',
    'feminino',
    'pós',
    'pos',
    'limite de deteccao',
    'limite de detecção',
]

AMBIGUOUS_REFERENCE_HINTS = [
    'homens',
    'mulheres',
    'masculino',
    'feminino',
    'crianças',
    'criancas',
    'adolescentes',
    'jejum',
    'fase',
    'menacme',
]


def _strip_accents(text):
    normalized = unicodedata.normalize('NFKD', str(text or ''))
    return ''.join(char for char in normalized if not unicodedata.combining(char))


def _normalize_text(text):
    collapsed = re.sub(r'\s+', ' ', _strip_accents(text).lower())
    return collapsed.strip(" \t\r\n:;-_.,|")


def _normalize_space(text):
    return re.sub(r'\s+', ' ', str(text or '')).strip()


def _to_float(raw):
    text = str(raw).strip()
    try:
        if ',' in text and '.' in text and text.find('.') < text.find(','):
            text = text.replace('.', '').replace(',', '.')
        else:
            text = text.replace(',', '.')
        return float(text)
    except Exception:
        return None


def _source_lines_from_table(lines):
    out = []
    previous = None
    for line in lines or []:
        text = _normalize_space(line.get('line', ''))
        if not text:
            continue
        key = text.lower()
        if key == previous:
            continue
        previous = key
        out.append(text)
    return out


def _source_lines_from_raw_text(raw_text):
    out = []
    previous = None
    for raw_line in str(raw_text or '').splitlines():
        text = _normalize_space(raw_line)
        if not text:
            continue
        if set(text) == {'_'}:
            continue
        key = text.lower()
        if key == previous:
            continue
        previous = key
        out.append(text)
    return out


def _find_marker(normalized_line):
    best = None
    for marker in MARKERS:
        for alias in marker['aliases']:
            normalized_alias = _normalize_text(alias)
            if re.search(rf'^(?:[\W_]*)(?:{re.escape(normalized_alias)})(?!\w)', normalized_line):
                score = len(normalized_alias)
                if best is None or score > best[0]:
                    best = (score, marker)
    return best[1] if best else None


def _has_stop_signal(normalized_line):
    return any(pattern in normalized_line for pattern in STOP_PATTERNS)


def _collect_block(lines, start_idx):
    block = [lines[start_idx]]
    for idx in range(start_idx + 1, min(len(lines), start_idx + 12)):
        normalized = _normalize_text(lines[idx])
        if not normalized:
            continue
        if _find_marker(normalized):
            break
        if 'resultado' in normalized and not _line_has_value(lines[idx]) and len(block) >= 2:
            break
        block.append(lines[idx])
        if _has_stop_signal(normalized):
            break
    return block


def _line_has_value(line):
    return bool(NUMBER_RE.search(line))


def _line_is_reference(line):
    normalized = _normalize_text(line)
    if 'resultado' in normalized:
        return False
    if any(hint in normalized for hint in REFERENCE_HINTS):
        return True
    return bool(RANGE_RE.search(line) or LESS_THAN_RE.search(line) or GREATER_THAN_RE.search(line))


def _extract_value_and_unit(block_lines):
    indexed = list(enumerate(block_lines))
    result_line_indexes = [idx for idx, line in indexed if 'resultado' in _normalize_text(line)]
    ordered_candidates = []

    for idx in result_line_indexes:
        ordered_candidates.append((idx, block_lines[idx], True))
        if idx + 1 < len(block_lines):
            ordered_candidates.append((idx + 1, block_lines[idx + 1], True))

    for idx, line in indexed:
        ordered_candidates.append((idx, line, False))

    seen = set()
    for idx, line, prioritized in ordered_candidates:
        cache_key = (idx, line)
        if cache_key in seen:
            continue
        seen.add(cache_key)

        normalized = _normalize_text(line)
        if not prioritized and _line_is_reference(line):
            continue

        search_segment = line
        if 'resultado' in normalized:
            pos = normalized.find('resultado')
            if pos >= 0:
                search_segment = line[pos:]

        for match in NUMBER_RE.finditer(search_segment):
            value_text = match.group(1)
            numeric = _to_float(value_text)
            if numeric is None:
                continue
            if idx > 0 and _line_is_reference(block_lines[idx - 1]) and _line_is_reference(line) and 'resultado' not in normalized:
                continue
            trailing = search_segment[match.end(): match.end() + 24]
            combined = f'{search_segment} {block_lines[idx + 1]}' if idx + 1 < len(block_lines) else search_segment
            unit_match = UNIT_RE.search(trailing) or UNIT_RE.search(combined[match.end(): match.end() + 40])
            unit = unit_match.group(1).lower() if unit_match else None
            return {
                'value_numeric': numeric,
                'value_text': value_text,
                'unit': unit,
                'source_line': _normalize_space(line),
            }
    return None


def _reference_lines(block_lines):
    lines = []
    started = False
    for line in block_lines:
        normalized = _normalize_text(line)
        if _line_is_reference(line):
            started = True
        if started:
            lines.append(_normalize_space(line))
    return lines


def _extract_reference(block_lines):
    lines = _reference_lines(block_lines)
    if not lines:
        return None, None, None

    reference_text = ' | '.join(lines[:6]).strip() or None
    normalized_text = _normalize_text(reference_text)
    ambiguous = any(hint in normalized_text for hint in AMBIGUOUS_REFERENCE_HINTS)

    if not ambiguous:
        range_match = RANGE_RE.search(reference_text)
        if range_match:
            return _to_float(range_match.group(1)), _to_float(range_match.group(2)), reference_text

        less_match = LESS_THAN_RE.search(reference_text)
        if less_match:
            return None, _to_float(less_match.group(1)), reference_text

        greater_match = GREATER_THAN_RE.search(reference_text)
        if greater_match:
            return _to_float(greater_match.group(1)), None, reference_text

    return None, None, reference_text


def _normalize_flag(value, ref_min, ref_max):
    if value is None:
        return None
    if ref_min is not None and value < ref_min:
        return 'low'
    if ref_max is not None and value > ref_max:
        return 'high'
    if ref_min is not None or ref_max is not None:
        return 'normal'
    return None


def _confidence(unit, reference_text, source_line):
    score = 0.86
    if unit:
        score += 0.06
    if reference_text:
        score += 0.04
    if 'resultado' in _normalize_text(source_line):
        score += 0.02
    return round(min(score, 0.98), 2)


def parse_biomarkers(lines, raw_text=None, pages=None):
    del pages

    source_lines = _source_lines_from_table(lines)
    raw_lines = _source_lines_from_raw_text(raw_text)

    merged_lines = source_lines + raw_lines

    parsed = {}
    for idx, line in enumerate(merged_lines):
        marker = _find_marker(_normalize_text(line))
        if not marker:
            continue

        block_lines = _collect_block(merged_lines, idx)
        value_payload = _extract_value_and_unit(block_lines)
        if not value_payload:
            continue

        ref_min, ref_max, ref_text = _extract_reference(block_lines)
        evidence = ' | '.join(_normalize_space(item) for item in block_lines[:6])
        item = {
            'marker_key': marker['marker_key'],
            'marker_name': marker['marker_name'],
            'value_numeric': value_payload['value_numeric'],
            'value_text': value_payload['value_text'],
            'unit': value_payload['unit'],
            'reference_min': ref_min,
            'reference_max': ref_max,
            'reference_text': ref_text,
            'flag': _normalize_flag(value_payload['value_numeric'], ref_min, ref_max),
            'source_line': evidence or value_payload['source_line'],
            'confidence': _confidence(value_payload['unit'], ref_text, value_payload['source_line']),
        }

        previous = parsed.get(marker['marker_key'])
        if previous is None or (item['confidence'], len(item['source_line'] or '')) > (previous['confidence'], len(previous['source_line'] or '')):
            parsed[marker['marker_key']] = item

    return list(parsed.values())
