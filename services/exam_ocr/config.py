import os

TESSERACT_LANG = os.getenv('EXAM_OCR_LANG', 'por+eng')
TESSERACT_PSM = os.getenv('EXAM_OCR_PSM', '6')
TESSERACT_OEM = os.getenv('EXAM_OCR_OEM', '3')
OCR_TIMEOUT = int(os.getenv('EXAM_OCR_TIMEOUT_SECONDS', '45'))
