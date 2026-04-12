"""
Expanded unit tests for services/exam_ocr/normalizers/biomarkers.py

Coverage:
- Original 9 markers (regression)
- All new marker groups (glucose/metabolic, lipids, liver, kidney, hematologic,
  thyroid, hormonal, inflammation, micronutrients)
- Edge cases: single-line, multi-line, unit on next line, range textual,
  repeated header/footer, duplicate marker, alias variants
"""
import unittest
import importlib
import sys
import types
from unittest.mock import patch

from services.exam_ocr.normalizers.biomarkers import parse_biomarkers


# ---------------------------------------------------------------------------
# SNIPPET: Original real exam layout (regression test)
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# SNIPPET: Metabolic markers
# ---------------------------------------------------------------------------
METABOLIC_SNIPPET = """
GLICOSE
Resultado: 98 mg/dL
Valor(es) de referência:
70 a 99 mg/dL

HEMOGLOBINA GLICADA HbA1c
Resultado: 5,5 %
Valor(es) de referência:
Abaixo de 5,7 %

INSULINA
Resultado: 8,2 µUI/mL
Valor(es) de referência:
2,6 a 24,9 µUI/mL
""".strip()


# ---------------------------------------------------------------------------
# SNIPPET: Full lipid panel
# ---------------------------------------------------------------------------
LIPID_SNIPPET = """
COLESTEROL TOTAL
Resultado: 185 mg/dL
Valor(es) de referência:
Inferior a 190 mg/dL

COLESTEROL LDL
Resultado: 112 mg/dL
Valor(es) de referência:
Inferior a 130 mg/dL

COLESTEROL VLDL
Resultado: 22 mg/dL
Valor(es) de referência:
5 a 40 mg/dL

COLESTEROL HDL
Resultado: 51 mg/dL
Valor(es) de referência
Superior a 40 mg/dL

TRIGLICERÍDEOS
Resultado: 110 mg/dL
Valores de referência:
Inferior a 150 mg/dL
""".strip()


# ---------------------------------------------------------------------------
# SNIPPET: Liver enzymes
# ---------------------------------------------------------------------------
LIVER_SNIPPET = """
TGO
Resultado: 22 U/L
Valores de referência:
10 a 40 U/L

TGP
Resultado: 19 U/L
Valores de referência:
7 a 40 U/L

GGT
Resultado: 28 U/L
Valores de referência:
10 a 71 U/L

FOSFATASE ALCALINA
Resultado: 78 U/L
Valores de referência:
40 a 150 U/L

BILIRRUBINA TOTAL
Resultado: 0,8 mg/dL
Valores de referência:
0,2 a 1,2 mg/dL

ALBUMINA SERICA
Resultado: 4,2 g/dL
Valores de referência:
3,5 a 5,0 g/dL
""".strip()


# ---------------------------------------------------------------------------
# SNIPPET: Kidney and electrolytes
# ---------------------------------------------------------------------------
KIDNEY_SNIPPET = """
CREATININA SERICA
Resultado: 1,0 mg/dL
Valor(es) de referência:
0,7 a 1,2 mg/dL

UREIA
Resultado: 32 mg/dL
Valor(es) de referência:
15 a 50 mg/dL

ACIDO URICO
Resultado: 5,4 mg/dL
Valor(es) de referência:
3,5 a 7,2 mg/dL

SODIO SERICO
Resultado: 141 mEq/L
Valor(es) de referência:
136 a 145 mEq/L

POTASSIO SERICO
Resultado: 4,2 mEq/L
Valor(es) de referência:
3,5 a 5,0 mEq/L

MAGNESIO SERICO
Resultado: 1,9 mg/dL
Valor(es) de referência:
1,6 a 2,6 mg/dL
""".strip()


# ---------------------------------------------------------------------------
# SNIPPET: Hematologic and iron
# ---------------------------------------------------------------------------
HEMATOLOGIC_SNIPPET = """
HEMOGLOBINA
Resultado: 14,8 g/dL
Valor(es) de referência:
Homens: 13,5 a 17,5 g/dL

HEMATOCRITO
Resultado: 44 %
Valor(es) de referência:
Homens: 41 a 53 %

FERRITINA
Resultado: 145 ng/mL
Valor(es) de referência:
20 a 250 ng/mL

FERRO SERICO
Resultado: 88 µg/dL
Valor(es) de referência:
50 a 150 µg/dL

VITAMINA B12
Resultado: 412 pg/mL
Valor(es) de referência:
200 a 900 pg/mL
""".strip()


# ---------------------------------------------------------------------------
# SNIPPET: Thyroid
# ---------------------------------------------------------------------------
THYROID_SNIPPET = """
TSH
Resultado: 2,1 µUI/mL
Valor(es) de referência:
0,4 a 4,5 µUI/mL

T4 LIVRE
Resultado: 1,2 ng/dL
Valor(es) de referência:
0,8 a 1,8 ng/dL

T3 TOTAL
Resultado: 1,4 ng/mL
Valor(es) de referência:
0,6 a 1,8 ng/mL
""".strip()


# ---------------------------------------------------------------------------
# SNIPPET: Inflammation markers
# ---------------------------------------------------------------------------
INFLAMMATION_SNIPPET = """
PROTEINA C REATIVA ULTRASSENSIVEL
Resultado: 0,8 mg/L
Valor(es) de referência:
Inferior a 3,0 mg/L

HOMOCISTEINA
Resultado: 9,5 µmol/L
Valor(es) de referência:
5 a 15 µmol/L
""".strip()


# ---------------------------------------------------------------------------
# SNIPPET: Micronutrients
# ---------------------------------------------------------------------------
MICRONUTRIENT_SNIPPET = """
25 OH VITAMINA D
Resultado: 35 ng/mL
Valor(es) de referência:
30 a 100 ng/mL

ZINCO SERICO
Resultado: 78 µg/dL
Valor(es) de referência:
60 a 120 µg/dL
""".strip()


# ---------------------------------------------------------------------------
# SNIPPET: Edge cases
# ---------------------------------------------------------------------------
DUPLICATE_HEADER_SNIPPET = """
LABORATÓRIO ABC - PÁGINA 1
Código do paciente: 123456
Data: 01/01/2026

GLICOSE
Resultado: 95 mg/dL
Valor(es) de referência: 70 a 99 mg/dL

LABORATÓRIO ABC - PÁGINA 2
Código do paciente: 123456
Data: 01/01/2026

GLICOSE
Resultado: 95 mg/dL
Valor(es) de referência: 70 a 99 mg/dL

FERRITINA
Resultado: 80 ng/mL
Valor(es) de referência: 20 a 250 ng/mL
""".strip()


SINGLE_LINE_SNIPPET = """
GLICOSE Resultado: 102 mg/dL Valor de referência: 70 a 99 mg/dL
CREATININA SERICA Resultado: 1,1 mg/dL Valor de referência: 0,7 a 1,2 mg/dL
""".strip()


ALIAS_VARIANT_SNIPPET = """
Transaminase Glutâmico Oxalacética-TGO       Resultado: 28 U/L
Valores de referência: 11 a 39 U/L

Transaminase Glutâmico Pirúvica-TGP       Resultado: 21 U/L
Valores de referência: 10 a 37 U/L

HDL Colesterol
Resultado: 48 mg/dL
Valores de referência: Superior a 40 mg/dL
""".strip()


class ExamOcrBiomarkersRegressionTest(unittest.TestCase):
    """Regression: original 9 markers must still parse correctly."""

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

        self.assertEqual(by_key['total_cholesterol']['value_numeric'], 163.0)
        self.assertEqual(by_key['total_cholesterol']['reference_max'], 190.0)
        self.assertEqual(by_key['total_cholesterol']['flag'], 'normal')

        self.assertEqual(by_key['hdl_cholesterol']['value_numeric'], 40.0)
        self.assertEqual(by_key['hdl_cholesterol']['reference_min'], 40.0)

        self.assertEqual(by_key['triglycerides']['value_numeric'], 124.0)
        self.assertEqual(by_key['triglycerides']['unit'], 'mg/dl')

        self.assertEqual(by_key['testosterone_free']['value_numeric'], 8.04)
        self.assertEqual(by_key['testosterone_free']['unit'], 'ng/dl')

        self.assertEqual(by_key['ast']['value_numeric'], 17.8)
        self.assertEqual(by_key['ast']['reference_min'], 11.0)
        self.assertEqual(by_key['ast']['reference_max'], 39.0)
        self.assertEqual(by_key['ast']['flag'], 'normal')

        self.assertEqual(by_key['alt']['value_numeric'], 18.0)
        self.assertEqual(by_key['alt']['reference_min'], 10.0)
        self.assertEqual(by_key['alt']['reference_max'], 37.0)
        self.assertEqual(by_key['alt']['flag'], 'normal')


class ExamOcrMetabolicMarkersTest(unittest.TestCase):
    """Test glucose/metabolic group markers."""

    def test_metabolic_markers_parsed(self):
        biomarkers = parse_biomarkers([], raw_text=METABOLIC_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('glucose', by_key)
        self.assertEqual(by_key['glucose']['value_numeric'], 98.0)
        self.assertEqual(by_key['glucose']['unit'], 'mg/dl')
        self.assertEqual(by_key['glucose']['reference_min'], 70.0)
        self.assertEqual(by_key['glucose']['reference_max'], 99.0)
        self.assertEqual(by_key['glucose']['flag'], 'normal')

        self.assertIn('hba1c', by_key)
        self.assertEqual(by_key['hba1c']['value_numeric'], 5.5)
        self.assertEqual(by_key['hba1c']['unit'], '%')
        self.assertIsNone(by_key['hba1c']['reference_min'])

        self.assertIn('insulin', by_key)
        self.assertEqual(by_key['insulin']['value_numeric'], 8.2)


class ExamOcrLipidMarkersTest(unittest.TestCase):
    """Test full lipid panel parsing."""

    def test_lipid_panel_parsed(self):
        biomarkers = parse_biomarkers([], raw_text=LIPID_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        expected_keys = {'total_cholesterol', 'ldl_cholesterol', 'vldl_cholesterol', 'hdl_cholesterol', 'triglycerides'}
        for key in expected_keys:
            self.assertIn(key, by_key, f'Missing marker: {key}')

        self.assertEqual(by_key['total_cholesterol']['value_numeric'], 185.0)
        self.assertEqual(by_key['ldl_cholesterol']['value_numeric'], 112.0)
        self.assertEqual(by_key['ldl_cholesterol']['reference_max'], 130.0)
        self.assertEqual(by_key['ldl_cholesterol']['flag'], 'normal')
        self.assertEqual(by_key['vldl_cholesterol']['value_numeric'], 22.0)
        self.assertEqual(by_key['hdl_cholesterol']['value_numeric'], 51.0)
        self.assertEqual(by_key['triglycerides']['value_numeric'], 110.0)


class ExamOcrLiverMarkersTest(unittest.TestCase):
    """Test liver function markers."""

    def test_liver_markers_parsed(self):
        biomarkers = parse_biomarkers([], raw_text=LIVER_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('ast', by_key)
        self.assertEqual(by_key['ast']['value_numeric'], 22.0)
        self.assertEqual(by_key['ast']['reference_min'], 10.0)
        self.assertEqual(by_key['ast']['reference_max'], 40.0)

        self.assertIn('alt', by_key)
        self.assertEqual(by_key['alt']['value_numeric'], 19.0)

        self.assertIn('ggt', by_key)
        self.assertEqual(by_key['ggt']['value_numeric'], 28.0)

        self.assertIn('alkaline_phosphatase', by_key)
        self.assertEqual(by_key['alkaline_phosphatase']['value_numeric'], 78.0)

        self.assertIn('bilirubin_total', by_key)
        self.assertEqual(by_key['bilirubin_total']['value_numeric'], 0.8)

        self.assertIn('albumin', by_key)
        self.assertEqual(by_key['albumin']['value_numeric'], 4.2)
        self.assertEqual(by_key['albumin']['reference_min'], 3.5)
        self.assertEqual(by_key['albumin']['reference_max'], 5.0)
        self.assertEqual(by_key['albumin']['flag'], 'normal')


class ExamOcrKidneyMarkersTest(unittest.TestCase):
    """Test kidney and electrolyte markers."""

    def test_kidney_markers_parsed(self):
        biomarkers = parse_biomarkers([], raw_text=KIDNEY_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('creatinine', by_key)
        self.assertEqual(by_key['creatinine']['value_numeric'], 1.0)
        self.assertEqual(by_key['creatinine']['flag'], 'normal')

        self.assertIn('urea', by_key)
        self.assertEqual(by_key['urea']['value_numeric'], 32.0)

        self.assertIn('uric_acid', by_key)
        self.assertEqual(by_key['uric_acid']['value_numeric'], 5.4)

        self.assertIn('sodium', by_key)
        self.assertEqual(by_key['sodium']['value_numeric'], 141.0)

        self.assertIn('potassium', by_key)
        self.assertEqual(by_key['potassium']['value_numeric'], 4.2)
        self.assertEqual(by_key['potassium']['reference_min'], 3.5)
        self.assertEqual(by_key['potassium']['reference_max'], 5.0)
        self.assertEqual(by_key['potassium']['flag'], 'normal')

        self.assertIn('magnesium', by_key)
        self.assertEqual(by_key['magnesium']['value_numeric'], 1.9)


class ExamOcrHematologicMarkersTest(unittest.TestCase):
    """Test hematologic and iron markers."""

    def test_hematologic_markers_parsed(self):
        biomarkers = parse_biomarkers([], raw_text=HEMATOLOGIC_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('hemoglobin', by_key)
        self.assertEqual(by_key['hemoglobin']['value_numeric'], 14.8)
        self.assertEqual(by_key['hemoglobin']['unit'], 'g/dl')

        self.assertIn('hematocrit', by_key)
        self.assertEqual(by_key['hematocrit']['value_numeric'], 44.0)

        self.assertIn('ferritin', by_key)
        self.assertEqual(by_key['ferritin']['value_numeric'], 145.0)
        self.assertEqual(by_key['ferritin']['flag'], 'normal')

        self.assertIn('serum_iron', by_key)
        self.assertEqual(by_key['serum_iron']['value_numeric'], 88.0)

        self.assertIn('vitamin_b12', by_key)
        self.assertEqual(by_key['vitamin_b12']['value_numeric'], 412.0)


class ExamOcrThyroidMarkersTest(unittest.TestCase):
    """Test thyroid markers."""

    def test_thyroid_markers_parsed(self):
        biomarkers = parse_biomarkers([], raw_text=THYROID_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('tsh', by_key)
        self.assertEqual(by_key['tsh']['value_numeric'], 2.1)
        self.assertEqual(by_key['tsh']['reference_min'], 0.4)
        self.assertEqual(by_key['tsh']['reference_max'], 4.5)
        self.assertEqual(by_key['tsh']['flag'], 'normal')

        self.assertIn('t4_free', by_key)
        self.assertEqual(by_key['t4_free']['value_numeric'], 1.2)

        self.assertIn('t3_total', by_key)
        self.assertEqual(by_key['t3_total']['value_numeric'], 1.4)


class ExamOcrInflammationMarkersTest(unittest.TestCase):
    """Test inflammation markers."""

    def test_inflammation_markers_parsed(self):
        biomarkers = parse_biomarkers([], raw_text=INFLAMMATION_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('crp', by_key)
        self.assertEqual(by_key['crp']['value_numeric'], 0.8)
        self.assertIsNone(by_key['crp']['reference_min'])
        self.assertEqual(by_key['crp']['reference_max'], 3.0)
        self.assertEqual(by_key['crp']['flag'], 'normal')

        self.assertIn('homocysteine', by_key)
        self.assertEqual(by_key['homocysteine']['value_numeric'], 9.5)


class ExamOcrMicronutrientMarkersTest(unittest.TestCase):
    """Test vitamin and micronutrient markers."""

    def test_micronutrient_markers_parsed(self):
        biomarkers = parse_biomarkers([], raw_text=MICRONUTRIENT_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('vitamin_d', by_key)
        self.assertEqual(by_key['vitamin_d']['value_numeric'], 35.0)
        self.assertEqual(by_key['vitamin_d']['reference_min'], 30.0)
        self.assertEqual(by_key['vitamin_d']['reference_max'], 100.0)
        self.assertEqual(by_key['vitamin_d']['flag'], 'normal')

        self.assertIn('zinc', by_key)
        self.assertEqual(by_key['zinc']['value_numeric'], 78.0)


class ExamOcrEdgeCasesTest(unittest.TestCase):
    """Edge cases: deduplication, single-line, alias variants."""

    def test_duplicate_headers_deduplicated(self):
        """Marker appearing twice (across pages) should appear only once."""
        biomarkers = parse_biomarkers([], raw_text=DUPLICATE_HEADER_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('glucose', by_key)
        self.assertIn('ferritin', by_key)
        # Ensure glucose appears only once (deduplication)
        count = sum(1 for b in biomarkers if b['marker_key'] == 'glucose')
        self.assertEqual(count, 1)

    def test_single_line_layout(self):
        """Values on same line as marker name."""
        biomarkers = parse_biomarkers([], raw_text=SINGLE_LINE_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('glucose', by_key)
        self.assertEqual(by_key['glucose']['value_numeric'], 102.0)
        self.assertIn('creatinine', by_key)
        self.assertEqual(by_key['creatinine']['value_numeric'], 1.1)

    def test_alias_variants_recognized(self):
        """Different aliases for AST, ALT and HDL must resolve to canonical key."""
        biomarkers = parse_biomarkers([], raw_text=ALIAS_VARIANT_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('ast', by_key, 'TGO alias must resolve to ast')
        self.assertEqual(by_key['ast']['value_numeric'], 28.0)

        self.assertIn('alt', by_key, 'TGP alias must resolve to alt')
        self.assertEqual(by_key['alt']['value_numeric'], 21.0)

        self.assertIn('hdl_cholesterol', by_key, 'HDL Colesterol alias must resolve to hdl_cholesterol')
        self.assertEqual(by_key['hdl_cholesterol']['value_numeric'], 48.0)

    def test_empty_input_returns_empty_list(self):
        """No input should return empty list, not raise."""
        biomarkers = parse_biomarkers([], raw_text='')
        self.assertIsInstance(biomarkers, list)
        self.assertEqual(len(biomarkers), 0)

    def test_noise_only_input_returns_empty_list(self):
        """Headers/footers only should return empty list."""
        noise = """
LABORATÓRIO XYZ
Assinado eletronicamente por Dr. João Silva
CRM 12345 / SP
Data de aprovação: 01/01/2026
Página 1 de 2
        """
        biomarkers = parse_biomarkers([], raw_text=noise)
        self.assertIsInstance(biomarkers, list)
        self.assertEqual(len(biomarkers), 0)

    def test_high_flag_detection(self):
        """Value above reference_max should produce flag='high'."""
        snippet = """
GLICOSE
Resultado: 135 mg/dL
Valor(es) de referência: 70 a 99 mg/dL
        """
        biomarkers = parse_biomarkers([], raw_text=snippet)
        by_key = {item['marker_key']: item for item in biomarkers}
        self.assertIn('glucose', by_key)
        self.assertEqual(by_key['glucose']['flag'], 'high')
        self.assertEqual(by_key['glucose']['value_numeric'], 135.0)

    def test_low_flag_detection(self):
        """Value below reference_min should produce flag='low'."""
        snippet = """
FERRITINA
Resultado: 8 ng/mL
Valor(es) de referência: 20 a 250 ng/mL
        """
        biomarkers = parse_biomarkers([], raw_text=snippet)
        by_key = {item['marker_key']: item for item in biomarkers}
        self.assertIn('ferritin', by_key)
        self.assertEqual(by_key['ferritin']['flag'], 'low')

    def test_confidence_improves_with_unit_and_reference(self):
        """Biomarker with unit and reference should have confidence >= 0.96."""
        snippet = """
GLICOSE
Resultado: 90 mg/dL
Valor(es) de referência: 70 a 99 mg/dL
        """
        biomarkers = parse_biomarkers([], raw_text=snippet)
        by_key = {item['marker_key']: item for item in biomarkers}
        self.assertIn('glucose', by_key)
        self.assertGreaterEqual(by_key['glucose']['confidence'], 0.96)

    def test_ambiguous_sex_based_reference_preserved_as_text(self):
        """When reference has sex-specific ranges, only reference_text should be set."""
        snippet = """
TESTOSTERONA TOTAL
Resultado: 310 ng/dL
Valor(es) de referência:
Homens 18 a 66 anos: 175 a 781 ng/dL
Mulheres 21 a 73 anos: 10 a 75 ng/dL
        """
        biomarkers = parse_biomarkers([], raw_text=snippet)
        by_key = {item['marker_key']: item for item in biomarkers}
        self.assertIn('testosterone_total', by_key)
        self.assertEqual(by_key['testosterone_total']['value_numeric'], 310.0)
        # Ambiguous reference: min/max should NOT be inferred
        self.assertIsNone(by_key['testosterone_total']['reference_min'])
        self.assertIsNone(by_key['testosterone_total']['reference_max'])
        # But reference_text should still capture the range
        self.assertIsNotNone(by_key['testosterone_total']['reference_text'])

    def test_ca_19_9_is_not_misclassified_as_calcium(self):
        snippet = """
CA 19-9
Resultado: 4,5 U/mL
Valor de referência: Inferior a 37,0 U/mL
        """
        biomarkers = parse_biomarkers([], raw_text=snippet)
        keys = {item['marker_key'] for item in biomarkers}
        self.assertNotIn('calcium', keys)


class ExamOcrExtractPayloadIntegrationTest(unittest.TestCase):
    """Integration: extract_payload service function uses parser correctly."""

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


# ---------------------------------------------------------------------------
# GOLDEN SAMPLE BEHAVIORS — validate fixes for real PDF divergences
# ---------------------------------------------------------------------------

# Tabular hemogram format: MARKER VALUE UNIT REFERENCE (no "Resultado:" keyword)
HEMOGRAM_TABULAR_SNIPPET = """
Hemograma Completo

LEUCÓCITOS                                    8.300           /mm³      4.500 - 11.000
ERITRÓCITOS                                    4.800.000      /mm³      4.000.000 - 5.500.000
HEMOGLOBINA                                   14,8            g/dL      13,5 a 17,5
HEMATÓCRITO                                   44              %         41 a 53

NEUTRÓFILOS         68%  (3.644 /mm³)
LINFÓCITOS          26%  (2.158 /mm³)
MONÓCITOS            5%  (415 /mm³)
EOSINÓFILOS          1%  (83 /mm³)

PLAQUETAS                                    198.000          /mm³      150.000 - 400.000
""".strip()

# LH with comparator result
LH_COMPARATOR_SNIPPET = """
LH - HORMÔNIO LUTEINIZANTE
Resultado: Inferior a 0,20 mUI/mL
Valor(es) de referência:
Homens adultos: 1,5 a 9,3 mUI/mL
""".strip()

# Thyroid with Brazilian decimal comma
THYROID_COMMA_SNIPPET = """
TSH - HORMÔNIO TIREOESTIMULANTE
Resultado: 1,88 µUI/mL
Valor(es) de referência: 0,38 a 5,33 µUI/mL

T4 LIVRE
Resultado: 0,69 ng/dL
Valor(es) de referência: 0,54 a 1,24 ng/dL
""".strip()

# Testosterona with large value (thousands + decimal)
TESTOSTERONE_LARGE_SNIPPET = """
TESTOSTERONA TOTAL
Resultado: 1.231,75 ng/dL
Valor(es) de referência:
Homens 18 a 66 anos: 175,00 a 781,00 ng/dL
""".strip()


class ExamOcrGoldenSampleBehaviorsTest(unittest.TestCase):
    """Validate specific parsing behaviors from real-PDF golden sample."""

    def test_thousands_separator_wbc(self):
        """WBC 8.300 /mm³ must parse as 8300 (Brazilian thousands sep), not 8.3."""
        biomarkers = parse_biomarkers([], raw_text=HEMOGRAM_TABULAR_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('wbc', by_key, 'Leucócitos (wbc) not found in tabular format')
        self.assertEqual(by_key['wbc']['value_numeric'], 8300.0,
                         f'Expected 8300 (thousands sep), got {by_key["wbc"]["value_numeric"]}')

    def test_thousands_separator_platelets(self):
        """Plaquetas 198.000 must parse as 198000."""
        biomarkers = parse_biomarkers([], raw_text=HEMOGRAM_TABULAR_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('platelets', by_key, 'Plaquetas not found')
        self.assertEqual(by_key['platelets']['value_numeric'], 198000.0,
                         f'Expected 198000, got {by_key["platelets"]["value_numeric"]}')

    def test_hemoglobin_tabular_format(self):
        """Hemoglobina in tabular format (no Resultado:) must still parse."""
        biomarkers = parse_biomarkers([], raw_text=HEMOGRAM_TABULAR_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('hemoglobin', by_key, 'Hemoglobina not found in tabular format')
        self.assertEqual(by_key['hemoglobin']['value_numeric'], 14.8)

    def test_lh_comparator_below_detection(self):
        """LH 'Inferior a 0,20' must set comparator='<' and value_numeric=0.20."""
        biomarkers = parse_biomarkers([], raw_text=LH_COMPARATOR_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('lh', by_key, 'LH not found')
        lh = by_key['lh']
        self.assertEqual(lh['value_numeric'], 0.20,
                         f'Expected 0.20, got {lh["value_numeric"]}')
        self.assertEqual(lh['comparator'], '<',
                         f'Expected comparator="<", got {lh["comparator"]}')
        self.assertIn(lh['value_kind'], ('below_detection',),
                      f'Expected value_kind="below_detection", got {lh["value_kind"]}')

    def test_lh_parse_status_set(self):
        """LH parse_status must be 'parsed' when comparator is resolved."""
        biomarkers = parse_biomarkers([], raw_text=LH_COMPARATOR_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}
        self.assertIn('lh', by_key)
        self.assertEqual(by_key['lh']['parse_status'], 'parsed')

    def test_lymphocytes_differential_pair(self):
        """Linfócitos 26% (2.158 /mm³) must set relative_value=26 and absolute_value=2158."""
        biomarkers = parse_biomarkers([], raw_text=HEMOGRAM_TABULAR_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('lymphocytes', by_key, 'Linfócitos not found')
        lymph = by_key['lymphocytes']
        self.assertEqual(lymph['relative_value'], 26.0,
                         f'Expected relative_value=26, got {lymph["relative_value"]}')
        self.assertEqual(lymph['absolute_value'], 2158.0,
                         f'Expected absolute_value=2158, got {lymph["absolute_value"]}')
        self.assertEqual(lymph['value_kind'], 'relative_absolute_pair')

    def test_tsh_comma_decimal(self):
        """TSH 1,88 with comma decimal separator."""
        biomarkers = parse_biomarkers([], raw_text=THYROID_COMMA_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('tsh', by_key)
        tsh = by_key['tsh']
        self.assertEqual(tsh['value_numeric'], 1.88)
        self.assertAlmostEqual(tsh['reference_min'], 0.38, places=2)
        self.assertAlmostEqual(tsh['reference_max'], 5.33, places=2)
        self.assertEqual(tsh['flag'], 'normal')

    def test_t4_free_comma_decimal(self):
        """T4 Livre 0,69 with comma decimal separator."""
        biomarkers = parse_biomarkers([], raw_text=THYROID_COMMA_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('t4_free', by_key)
        t4 = by_key['t4_free']
        self.assertEqual(t4['value_numeric'], 0.69)
        self.assertAlmostEqual(t4['reference_min'], 0.54, places=2)
        self.assertAlmostEqual(t4['reference_max'], 1.24, places=2)

    def test_testosterone_large_value_european_format(self):
        """Testosterona 1.231,75 must parse as 1231.75 (European thousands+decimal)."""
        biomarkers = parse_biomarkers([], raw_text=TESTOSTERONE_LARGE_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('testosterone_total', by_key)
        t = by_key['testosterone_total']
        self.assertEqual(t['value_numeric'], 1231.75,
                         f'Expected 1231.75, got {t["value_numeric"]}')

    def test_raw_result_text_preserved(self):
        """raw_result_text must be populated for all parsed biomarkers."""
        biomarkers = parse_biomarkers([], raw_text=THYROID_COMMA_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('tsh', by_key)
        self.assertIsNotNone(by_key['tsh']['raw_result_text'],
                             'raw_result_text should not be None for TSH')

    def test_raw_reference_text_preserved(self):
        """raw_reference_text must be populated when reference is present."""
        biomarkers = parse_biomarkers([], raw_text=THYROID_COMMA_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('tsh', by_key)
        self.assertIsNotNone(by_key['tsh']['raw_reference_text'],
                             'raw_reference_text should not be None when reference exists')

    def test_value_kind_numeric_for_standard_markers(self):
        """Standard markers without comparator must have value_kind='numeric'."""
        biomarkers = parse_biomarkers([], raw_text=THYROID_COMMA_SNIPPET)
        by_key = {item['marker_key']: item for item in biomarkers}

        self.assertIn('tsh', by_key)
        self.assertEqual(by_key['tsh']['value_kind'], 'numeric')


if __name__ == '__main__':
    unittest.main()
