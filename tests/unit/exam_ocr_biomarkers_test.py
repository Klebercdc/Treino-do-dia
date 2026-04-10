import unittest
import importlib
import sys
import types
from unittest.mock import patch

from services.exam_ocr.normalizers.biomarkers import parse_biomarkers


REAL_EXAM_SNIPPET = """
PSA LIVRE - ANTÍGENO PROSTÁTICO ESPECÍFICO
Resultado: 0,09                 ng/mL
Valor(es) de referência:
Não há valores de referência definidos para este exame,
devendo correlacionar-se com o PSA total.

PSA TOTAL ANTIGENO                    Resultado:
PROSTÁTICO ESPECÍFICO                0,30                ng/mL
Valor(es) de referência:
Homens:
Até 60 anos.....: Inferior a 2,50 ng/mL
Acima de 60 anos: Inferior a 4,00 ng/mL

TESTOSTERONA TOTAL                        Resultado
                                       247,34                ng/dL
Valor(es) de referência:
Homens 18 a 66 anos..: 175,00 a 781,00 ng/dL
Mulheres 21 a 73 anos:  10,00 a  75,00 ng/dL

COLESTEROL TOTAL                    Resultado
                                        163  mg/dL
Valor(es) de referência:
Adultos acima de 20 anos: Inferior a 190 mg/dL

COLESTEROL HDL                   Resultado
                                40            mg/dL
Valor(es) de referência
Adultos acima de 20 anos: Superior a 40 mg/dL

TRIGLICÉRIDES                                 Resultado:
                                                124           mg/dL
Valores de referência
Adultos acima de 20 anos:
Com jejum: Inferior a 150 mg/dL
Sem jejum: Inferior a 175 mg/dL

TESTOSTERONA LIVRE                          Valor de ReferÊncia:
Resultado:           8,04    ng/dL        Menacme:
Masculino:
17 a 40 anos : 3,4 a 24,6 ng/dL
41 a 60 anos : 2,67 a 18,3 ng/dL

TRANSAMINASE GLUTAMICO              Resultado:
OXALACETICA-TGO                              17,8  U/L
Valor(es) de referência:
11,0 a 39,0 U/L

TRANSAMINASE GLUTAMICO              Resultado:
PIRUVICA-TGP                             18 U/L
Valor(es) de referência:
10 a 37 U/L
""".strip()


class ExamOcrBiomarkersTest(unittest.TestCase):
    def test_parse_biomarkers_handles_multiline_real_exam_layout(self):
        biomarkers = parse_biomarkers([], raw_text=REAL_EXAM_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertEqual(set(by_key), {
            'psa_free',
            'psa_total',
            'testosterone_total',
            'total_cholesterol',
            'hdl_cholesterol',
            'triglycerides',
            'testosterone_free',
            'ast',
            'alt',
        })

        self.assertEqual(by_key['psa_free']['value_numeric'], 0.09)
        self.assertEqual(by_key['psa_free']['unit'], 'ng/ml')
        self.assertIn('correlacionar-se com o PSA total', by_key['psa_free']['reference_text'])

        self.assertEqual(by_key['psa_total']['value_numeric'], 0.30)
        self.assertEqual(by_key['psa_total']['unit'], 'ng/ml')
        self.assertIsNone(by_key['psa_total']['reference_min'])
        self.assertIsNone(by_key['psa_total']['reference_max'])

        self.assertEqual(by_key['testosterone_total']['value_numeric'], 247.34)
        self.assertEqual(by_key['testosterone_total']['unit'], 'ng/dl')
        self.assertIn('Homens 18 a 66 anos', by_key['testosterone_total']['reference_text'])

        self.assertEqual(by_key['total_cholesterol']['value_numeric'], 163.0)
        self.assertEqual(by_key['total_cholesterol']['reference_max'], 190.0)
        self.assertEqual(by_key['total_cholesterol']['flag'], 'normal')

        self.assertEqual(by_key['hdl_cholesterol']['value_numeric'], 40.0)
        self.assertEqual(by_key['hdl_cholesterol']['reference_min'], 40.0)
        self.assertEqual(by_key['hdl_cholesterol']['flag'], 'normal')

        self.assertEqual(by_key['triglycerides']['value_numeric'], 124.0)
        self.assertEqual(by_key['triglycerides']['unit'], 'mg/dl')
        self.assertIn('Com jejum: Inferior a 150 mg/dL', by_key['triglycerides']['reference_text'])

        self.assertEqual(by_key['testosterone_free']['value_numeric'], 8.04)
        self.assertEqual(by_key['testosterone_free']['unit'], 'ng/dl')
        self.assertIn('17 a 40 anos', by_key['testosterone_free']['reference_text'])

        self.assertEqual(by_key['ast']['value_numeric'], 17.8)
        self.assertEqual(by_key['ast']['reference_min'], 11.0)
        self.assertEqual(by_key['ast']['reference_max'], 39.0)
        self.assertEqual(by_key['ast']['flag'], 'normal')

        self.assertEqual(by_key['alt']['value_numeric'], 18.0)
        self.assertEqual(by_key['alt']['reference_min'], 10.0)
        self.assertEqual(by_key['alt']['reference_max'], 37.0)
        self.assertEqual(by_key['alt']['flag'], 'normal')

    def test_extract_payload_uses_raw_text_when_native_pdf_has_no_rows(self):
        fake_pages = [{'page': 1, 'text': REAL_EXAM_SNIPPET}]

        sys.modules.setdefault('httpx', types.ModuleType('httpx'))
        sys.modules.setdefault('pypdf', types.SimpleNamespace(PdfReader=object))
        sys.modules.setdefault('pdf2image', types.SimpleNamespace(convert_from_path=lambda *_args, **_kwargs: []))
        sys.modules.setdefault('cv2', types.ModuleType('cv2'))
        sys.modules.setdefault('pytesseract', types.SimpleNamespace(Output=types.SimpleNamespace(DICT='DICT')))
        sys.modules.setdefault('pandas', types.SimpleNamespace(DataFrame=lambda *_args, **_kwargs: None))

        numpy_stub = types.ModuleType('numpy')
        numpy_stub.array = lambda value: value
        numpy_stub.ndarray = object
        sys.modules.setdefault('numpy', numpy_stub)

        pil_stub = types.ModuleType('PIL')
        pil_stub.Image = types.SimpleNamespace(open=lambda *_args, **_kwargs: None)
        sys.modules.setdefault('PIL', pil_stub)

        service_module = importlib.import_module('services.exam_ocr.service')

        with patch.object(service_module, 'extract_pdf_native', return_value=(REAL_EXAM_SNIPPET, fake_pages)):
            extract_payload = service_module.extract_payload
            payload = extract_payload({
                'temp_path': '/tmp/fake.pdf',
                'mime_type': 'application/pdf',
                'source_id': 'real-exam-test',
                'prefer_native_pdf': True,
            })

        self.assertTrue(payload['success'])
        self.assertEqual(payload['extraction_mode'], 'native_pdf')
        self.assertGreaterEqual(len(payload['biomarkers_detected']), 9)
        self.assertIn('psa_total', {item['marker_key'] for item in payload['biomarkers_detected']})


if __name__ == '__main__':
    unittest.main()
