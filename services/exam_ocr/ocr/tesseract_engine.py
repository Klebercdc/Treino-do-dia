import pytesseract
from pytesseract import Output
from . import __init__  # noqa: F401

def image_to_text(image, language='por+eng', timeout=45, psm='6', oem='3'):
    config = f'--psm {psm} --oem {oem}'
    return pytesseract.image_to_string(image, lang=language, config=config, timeout=timeout)

def image_to_data_rows(image, language='por+eng', timeout=45, psm='6', oem='3'):
    config = f'--psm {psm} --oem {oem}'
    data = pytesseract.image_to_data(image, lang=language, config=config, output_type=Output.DICT, timeout=timeout)
    rows = []
    for i in range(len(data.get('text', []))):
        text = (data['text'][i] or '').strip()
        if not text:
            continue
        rows.append({
            'text': text,
            'conf': float(data['conf'][i]) if str(data['conf'][i]).strip() not in ('', '-1') else 0.0,
            'left': int(data['left'][i]),
            'top': int(data['top'][i]),
            'width': int(data['width'][i]),
            'height': int(data['height'][i]),
            'line_num': int(data['line_num'][i]),
            'block_num': int(data['block_num'][i]),
            'page_num': int(data['page_num'][i]),
        })
    return rows


def run_and_get_multiple_output(image, language='por+eng', timeout=45, psm='6', oem='3'):
    text = image_to_text(image, language, timeout, psm, oem)
    rows = image_to_data_rows(image, language, timeout, psm, oem)
    return text, rows
