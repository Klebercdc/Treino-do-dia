import re
import unicodedata

# ---------------------------------------------------------------------------
# BIOMARKER CATALOG — EXPANDED (70+ markers, full PT-BR/EN alias coverage)
# ---------------------------------------------------------------------------
# Rules:
# - marker_key: snake_case canonical key (stable, used by downstream systems)
# - marker_name: display name in Portuguese
# - aliases: list of normalized text strings (accents stripped, lowercase, trimmed)
#   Order from most-specific to least-specific within each marker.
# ---------------------------------------------------------------------------

MARKERS = [
    # -----------------------------------------------------------------------
    # 1. GLICEMIA E METABOLISMO
    # -----------------------------------------------------------------------
    {
        'marker_key': 'glucose',
        'marker_name': 'Glicose',
        'aliases': [
            'glicose em jejum',
            'glicemia de jejum',
            'glicemia jejum',
            'glicemia',
            'glicose',
            'glucose',
            'blood glucose',
        ],
    },
    {
        'marker_key': 'hba1c',
        'marker_name': 'Hemoglobina Glicada (HbA1c)',
        'aliases': [
            'hemoglobina glicada hba1c',
            'hemoglobina glicada a1c',
            'hemoglobina glicada',
            'hba1c',
            'a1c',
            'glycated hemoglobin',
            'glycohemoglobin',
        ],
    },
    {
        'marker_key': 'insulin',
        'marker_name': 'Insulina',
        'aliases': [
            'insulina de jejum',
            'insulina basal',
            'insulina',
            'insulin',
        ],
    },
    {
        'marker_key': 'homa_ir',
        'marker_name': 'HOMA-IR',
        'aliases': [
            'homa ir',
            'homa-ir',
            'indice homa',
            'indice de resistencia a insulina',
        ],
    },
    {
        'marker_key': 'c_peptide',
        'marker_name': 'Peptídeo C',
        'aliases': [
            'peptideo c',
            'peptideo-c',
            'c-peptide',
            'c peptide',
        ],
    },

    # -----------------------------------------------------------------------
    # 2. LIPÍDIOS
    # -----------------------------------------------------------------------
    {
        'marker_key': 'total_cholesterol',
        'marker_name': 'Colesterol Total',
        'aliases': [
            'colesterol total',
            'total cholesterol',
            'cholesterol total',
        ],
    },
    {
        'marker_key': 'hdl_cholesterol',
        'marker_name': 'Colesterol HDL',
        'aliases': [
            'colesterol hdl',
            'hdl colesterol',
            'hdl-colesterol',
            'hdl',
            'high density lipoprotein',
        ],
    },
    {
        'marker_key': 'ldl_cholesterol',
        'marker_name': 'Colesterol LDL',
        'aliases': [
            'colesterol ldl calculado',
            'colesterol ldl direto',
            'colesterol ldl',
            'ldl colesterol',
            'ldl-colesterol',
            'ldl',
            'low density lipoprotein',
        ],
    },
    {
        'marker_key': 'vldl_cholesterol',
        'marker_name': 'Colesterol VLDL',
        'aliases': [
            'colesterol vldl',
            'vldl colesterol',
            'vldl-colesterol',
            'vldl',
            'very low density lipoprotein',
        ],
    },
    {
        'marker_key': 'triglycerides',
        'marker_name': 'Triglicerídeos',
        'aliases': [
            'triglicerideos',
            'triglicerides',
            'triglicérides',
            'triglicerídeos',
            'triglycerides',
            'trigliceridio',
        ],
    },
    {
        'marker_key': 'non_hdl_cholesterol',
        'marker_name': 'Colesterol Não-HDL',
        'aliases': [
            'colesterol nao hdl',
            'colesterol nao-hdl',
            'nao hdl',
            'non-hdl cholesterol',
            'non hdl',
        ],
    },
    {
        'marker_key': 'apolipoprotein_a1',
        'marker_name': 'Apolipoproteína A-I',
        'aliases': [
            'apolipoproteina a1',
            'apolipoproteina a-i',
            'apolipoproteina ai',
            'apolipoprotein a1',
            'apolipoprotein a-i',
            'apoa1',
            'apo a1',
            'apo-a1',
        ],
    },
    {
        'marker_key': 'apolipoprotein_b',
        'marker_name': 'Apolipoproteína B',
        'aliases': [
            'apolipoproteina b',
            'apolipoproteina-b',
            'apolipoprotein b',
            'apob',
            'apo b',
            'apo-b',
        ],
    },
    {
        'marker_key': 'lipoprotein_a',
        'marker_name': 'Lipoproteína (a)',
        'aliases': [
            'lipoproteina(a)',
            'lipoproteina a',
            'lipoprotein(a)',
            'lipoprotein a',
            'lp(a)',
            'lpa',
        ],
    },

    # -----------------------------------------------------------------------
    # 3. FÍGADO
    # -----------------------------------------------------------------------
    {
        'marker_key': 'ast',
        'marker_name': 'TGO / AST',
        'aliases': [
            'transaminase glutamico oxalacetica',
            'transaminase glutâmico oxalacética',
            'oxalacetica-tgo',
            'oxalacética-tgo',
            'aspartato aminotransferase',
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
            'alanina aminotransferase',
            'tgp',
            'alt',
        ],
    },
    {
        'marker_key': 'ggt',
        'marker_name': 'GGT / Gama GT',
        'aliases': [
            'gama-glutamiltransferase',
            'gama glutamiltransferase',
            'gamma-glutamiltransferase',
            'gamma gt',
            'gama gt',
            'ggt',
        ],
    },
    {
        'marker_key': 'alkaline_phosphatase',
        'marker_name': 'Fosfatase Alcalina',
        'aliases': [
            'fosfatase alcalina',
            'alkaline phosphatase',
            'fa',
        ],
    },
    {
        'marker_key': 'bilirubin_total',
        'marker_name': 'Bilirrubina Total',
        'aliases': [
            'bilirrubina total',
            'total bilirubin',
            'bilirubin total',
        ],
    },
    {
        'marker_key': 'bilirubin_direct',
        'marker_name': 'Bilirrubina Direta',
        'aliases': [
            'bilirrubina direta',
            'direct bilirubin',
            'bilirubin direct',
            'bilirrubina conjugada',
        ],
    },
    {
        'marker_key': 'bilirubin_indirect',
        'marker_name': 'Bilirrubina Indireta',
        'aliases': [
            'bilirrubina indireta',
            'indirect bilirubin',
            'bilirubin indirect',
            'bilirrubina livre',
        ],
    },
    {
        'marker_key': 'albumin',
        'marker_name': 'Albumina',
        'aliases': [
            'albumina serica',
            'albumina',
            'serum albumin',
            'albumin',
        ],
    },
    {
        'marker_key': 'total_protein',
        'marker_name': 'Proteínas Totais',
        'aliases': [
            'proteinas totais',
            'proteínas totais',
            'total protein',
            'proteins total',
        ],
    },

    # -----------------------------------------------------------------------
    # 4. RIM E HIDRATAÇÃO
    # -----------------------------------------------------------------------
    {
        'marker_key': 'creatinine',
        'marker_name': 'Creatinina',
        'aliases': [
            'creatinina serica',
            'creatinina',
            'serum creatinine',
            'creatinine',
        ],
    },
    {
        'marker_key': 'urea',
        'marker_name': 'Ureia',
        'aliases': [
            'ureia',
            'ureia serica',
            'ureia sanguinea',
            'blood urea nitrogen',
            'bun',
            'urea',
        ],
    },
    {
        'marker_key': 'uric_acid',
        'marker_name': 'Ácido Úrico',
        'aliases': [
            'acido urico',
            'ácido úrico',
            'uric acid',
            'urate',
        ],
    },
    {
        'marker_key': 'egfr',
        'marker_name': 'Taxa de Filtração Glomerular (TFG/eGFR)',
        'aliases': [
            'taxa de filtracao glomerular estimada',
            'taxa de filtracao glomerular',
            'tfg estimada',
            'tfg',
            'egfr',
            'estimated gfr',
            'creatinine clearance',
            'clearance de creatinina',
        ],
    },
    {
        'marker_key': 'sodium',
        'marker_name': 'Sódio',
        'aliases': [
            'sodio serico',
            'sodio',
            'sódio',
            'serum sodium',
            'sodium',
            'na',
        ],
    },
    {
        'marker_key': 'potassium',
        'marker_name': 'Potássio',
        'aliases': [
            'potassio serico',
            'potassio',
            'potássio',
            'serum potassium',
            'potassium',
            'kalium',
            'k',
        ],
    },
    {
        'marker_key': 'magnesium',
        'marker_name': 'Magnésio',
        'aliases': [
            'magnesio serico',
            'magnesio',
            'magnésio',
            'serum magnesium',
            'magnesium',
            'mg',
        ],
    },
    {
        'marker_key': 'calcium',
        'marker_name': 'Cálcio',
        'aliases': [
            'calcio total',
            'calcio ionizado',
            'calcio serico',
            'calcio',
            'cálcio',
            'serum calcium',
            'calcium',
        ],
    },
    {
        'marker_key': 'phosphorus',
        'marker_name': 'Fósforo',
        'aliases': [
            'fosforo serico',
            'fosforo',
            'fósforo',
            'phosphorus',
            'phosphate',
            'fosfato',
        ],
    },

    # -----------------------------------------------------------------------
    # 5. HEMOGRAMA E FERRO
    # -----------------------------------------------------------------------
    {
        'marker_key': 'hemoglobin',
        'marker_name': 'Hemoglobina',
        'aliases': [
            'hemoglobina',
            'hb',
            'hemoglobin',
        ],
    },
    {
        'marker_key': 'hematocrit',
        'marker_name': 'Hematócrito',
        'aliases': [
            'hematocrito',
            'hematócrito',
            'hct',
            'hematocrit',
        ],
    },
    {
        'marker_key': 'rbc',
        'marker_name': 'Hemácias / Eritrócitos',
        'aliases': [
            'eritrocitos',
            'eritrócitos',
            'hemacias',
            'hemácias',
            'red blood cells',
            'rbc',
        ],
    },
    {
        'marker_key': 'mcv',
        'marker_name': 'VCM (Volume Corpuscular Médio)',
        'aliases': [
            'volume corpuscular medio',
            'volume corpuscular médio',
            'vcm',
            'mean corpuscular volume',
            'mcv',
        ],
    },
    {
        'marker_key': 'mch',
        'marker_name': 'HCM (Hemoglobina Corpuscular Média)',
        'aliases': [
            'hemoglobina corpuscular media',
            'hemoglobina corpuscular média',
            'hcm',
            'mean corpuscular hemoglobin',
            'mch',
        ],
    },
    {
        'marker_key': 'mchc',
        'marker_name': 'CHCM (Concentração de Hemoglobina Corpuscular Média)',
        'aliases': [
            'concentracao de hemoglobina corpuscular media',
            'concentração de hemoglobina corpuscular média',
            'chcm',
            'mean corpuscular hemoglobin concentration',
            'mchc',
        ],
    },
    {
        'marker_key': 'rdw',
        'marker_name': 'RDW (Amplitude de Distribuição dos Eritrócitos)',
        'aliases': [
            'amplitude de distribuicao dos eritrocitos',
            'amplitude de distribuição dos eritrócitos',
            'rdw-cv',
            'rdw',
            'red cell distribution width',
        ],
    },
    {
        'marker_key': 'wbc',
        'marker_name': 'Leucócitos',
        'aliases': [
            'leucocitos totais',
            'leucocitos',
            'leucócitos',
            'white blood cells',
            'white blood count',
            'wbc',
            'glóbulos brancos',
            'globulos brancos',
        ],
    },
    {
        'marker_key': 'neutrophils',
        'marker_name': 'Neutrófilos',
        'aliases': [
            'neutrofilos',
            'neutrófilos',
            'neutrophils',
        ],
    },
    {
        'marker_key': 'lymphocytes',
        'marker_name': 'Linfócitos',
        'aliases': [
            'linfocitos',
            'linfócitos',
            'lymphocytes',
        ],
    },
    {
        'marker_key': 'monocytes',
        'marker_name': 'Monócitos',
        'aliases': [
            'monocitos',
            'monócitos',
            'monocytes',
        ],
    },
    {
        'marker_key': 'eosinophils',
        'marker_name': 'Eosinófilos',
        'aliases': [
            'eosinofilos',
            'eosinófilos',
            'eosinophils',
        ],
    },
    {
        'marker_key': 'basophils',
        'marker_name': 'Basófilos',
        'aliases': [
            'basofilos',
            'basófilos',
            'basophils',
        ],
    },
    {
        'marker_key': 'platelets',
        'marker_name': 'Plaquetas',
        'aliases': [
            'plaquetas',
            'contagem de plaquetas',
            'platelet count',
            'platelets',
            'thrombocytes',
        ],
    },
    {
        'marker_key': 'ferritin',
        'marker_name': 'Ferritina',
        'aliases': [
            'ferritina serica',
            'ferritina',
            'serum ferritin',
            'ferritin',
        ],
    },
    {
        'marker_key': 'serum_iron',
        'marker_name': 'Ferro Sérico',
        'aliases': [
            'ferro serico',
            'ferro',
            'hierro',
            'serum iron',
            'iron',
        ],
    },
    {
        'marker_key': 'transferrin',
        'marker_name': 'Transferrina',
        'aliases': [
            'transferrina',
            'transferrin',
        ],
    },
    {
        'marker_key': 'transferrin_saturation',
        'marker_name': 'Saturação de Transferrina',
        'aliases': [
            'saturacao de transferrina',
            'saturação de transferrina',
            'saturacao transferrina',
            'indice de saturacao de transferrina',
            'transferrin saturation',
            'iron saturation',
        ],
    },
    {
        'marker_key': 'vitamin_b12',
        'marker_name': 'Vitamina B12',
        'aliases': [
            'vitamina b12',
            'cobalamina',
            'cianocobalamina',
            'vitamin b12',
            'cobalamin',
            'b12',
        ],
    },
    {
        'marker_key': 'folate',
        'marker_name': 'Folato / Ácido Fólico',
        'aliases': [
            'folato serico',
            'acido folico',
            'ácido fólico',
            'folato',
            'serum folate',
            'folic acid',
            'folate',
        ],
    },

    # -----------------------------------------------------------------------
    # 6. TIREOIDE
    # -----------------------------------------------------------------------
    {
        'marker_key': 'tsh',
        'marker_name': 'TSH',
        'aliases': [
            'tirotropina',
            'hormonio estimulante da tireoide',
            'hormônio estimulante da tireoide',
            'thyroid stimulating hormone',
            'tsh',
        ],
    },
    {
        'marker_key': 't4_free',
        'marker_name': 'T4 Livre',
        'aliases': [
            't4 livre',
            't4l',
            'free thyroxine',
            'free t4',
            'ft4',
            'tiroxina livre',
        ],
    },
    {
        'marker_key': 't4_total',
        'marker_name': 'T4 Total',
        'aliases': [
            't4 total',
            'tiroxina total',
            'thyroxine total',
            'total t4',
            't4',
        ],
    },
    {
        'marker_key': 't3_free',
        'marker_name': 'T3 Livre',
        'aliases': [
            't3 livre',
            't3l',
            'free triiodothyronine',
            'free t3',
            'ft3',
            'triiodotironina livre',
        ],
    },
    {
        'marker_key': 't3_total',
        'marker_name': 'T3 Total',
        'aliases': [
            't3 total',
            'triiodotironina total',
            'triiodothyronine total',
            'total t3',
            't3',
        ],
    },
    {
        'marker_key': 'anti_tpo',
        'marker_name': 'Anti-TPO',
        'aliases': [
            'anticorpo anti-tireoperoxidase',
            'anticorpo antitireoperoxidase',
            'anti tireoide peroxidase',
            'anti-tireoperoxidase',
            'anti-tpo',
            'anti tpo',
            'tpo antibody',
        ],
    },
    {
        'marker_key': 'anti_tg',
        'marker_name': 'Anti-Tireoglobulina',
        'aliases': [
            'anticorpo anti-tireoglobulina',
            'anti-tireoglobulina',
            'anti tireoglobulina',
            'anti-tg',
            'anti tg',
            'thyroglobulin antibody',
        ],
    },

    # -----------------------------------------------------------------------
    # 7. HORMONAL MASCULINO / FEMININO
    # -----------------------------------------------------------------------
    {
        'marker_key': 'testosterone_total',
        'marker_name': 'Testosterona Total',
        'aliases': [
            'testosterona total',
            'testosterone total',
            'total testosterone',
        ],
    },
    {
        'marker_key': 'testosterone_free',
        'marker_name': 'Testosterona Livre',
        'aliases': [
            'testosterona livre',
            'testosterone livre',
            'free testosterone',
            'testosterone free',
        ],
    },
    {
        'marker_key': 'testosterone_bioavailable',
        'marker_name': 'Testosterona Biodisponível',
        'aliases': [
            'testosterona biodisponivel',
            'testosterona biodisponível',
            'bioavailable testosterone',
        ],
    },
    {
        'marker_key': 'shbg',
        'marker_name': 'SHBG',
        'aliases': [
            'globulina ligadora de hormonios sexuais',
            'globulina ligadora de hormônios sexuais',
            'sex hormone binding globulin',
            'shbg',
        ],
    },
    {
        'marker_key': 'estradiol',
        'marker_name': 'Estradiol',
        'aliases': [
            'estradiol',
            '17-beta estradiol',
            'e2',
            'estradiol e2',
        ],
    },
    {
        'marker_key': 'lh',
        'marker_name': 'LH (Hormônio Luteinizante)',
        'aliases': [
            'hormonio luteinizante',
            'hormônio luteinizante',
            'luteinizing hormone',
            'lh',
        ],
    },
    {
        'marker_key': 'fsh',
        'marker_name': 'FSH (Hormônio Folículo-Estimulante)',
        'aliases': [
            'hormonio foliculo estimulante',
            'hormônio folículo-estimulante',
            'follicle stimulating hormone',
            'fsh',
        ],
    },
    {
        'marker_key': 'prolactin',
        'marker_name': 'Prolactina',
        'aliases': [
            'prolactina',
            'prolactin',
        ],
    },
    {
        'marker_key': 'dht',
        'marker_name': 'Dihidrotestosterona (DHT)',
        'aliases': [
            'dihidrotestosterona',
            'di-hidrotestosterona',
            'diidrotestosterona',
            'dihydrotestosterone',
            'dht',
        ],
    },
    {
        'marker_key': 'progesterone',
        'marker_name': 'Progesterona',
        'aliases': [
            'progesterona',
            'progesterone',
        ],
    },
    {
        'marker_key': 'dhea_s',
        'marker_name': 'DHEA-S',
        'aliases': [
            'sulfato de dehidroepiandrosterona',
            'sulfato de desidroepiandrosterona',
            'dehidroepiandrosterona sulfato',
            'desidroepiandrosterona sulfato',
            'dhea sulfato',
            'dheas',
            'dhea-s',
            'dhea s',
            'dehydroepiandrosterone sulfate',
        ],
    },
    {
        'marker_key': 'cortisol',
        'marker_name': 'Cortisol',
        'aliases': [
            'cortisol matinal',
            'cortisol basal',
            'cortisol',
        ],
    },
    {
        'marker_key': 'psa_total',
        'marker_name': 'PSA Total',
        'aliases': [
            'psa total antígeno prostático específico',
            'psa total antigeno prostatico especifico',
            'antigeno prostatico especifico total',
            'antígeno prostático específico total',
            'psa total',
            'prostate specific antigen total',
        ],
    },
    {
        'marker_key': 'psa_free',
        'marker_name': 'PSA Livre',
        'aliases': [
            'psa livre antígeno prostático específico',
            'psa livre antigeno prostatico especifico',
            'antigeno prostatico especifico livre',
            'antígeno prostático específico livre',
            'psa livre',
            'prostate specific antigen free',
        ],
    },

    # -----------------------------------------------------------------------
    # 8. ENZIMAS MUSCULARES
    # -----------------------------------------------------------------------
    {
        'marker_key': 'ck_total',
        'marker_name': 'Creatinofosfoquinase Total (CK-Total)',
        'aliases': [
            'creatinoquinase total',
            'creatinofosfoquinase total',
            'creatina quinase total',
            'creatina fosfoquinase total',
            'creatina-quinase total',
            'creatinofosfokinase total',
            'ck total',
            'ck-total',
            'cpk total',
            'creatine kinase total',
            'creatine phosphokinase total',
            'cpk',
        ],
    },
    {
        'marker_key': 'ck_mb',
        'marker_name': 'CK-MB',
        'aliases': [
            'creatinoquinase mb',
            'creatina quinase mb',
            'creatinaquinase-mb',
            'ck-mb massa',
            'ck-mb',
            'ck mb',
            'creatine kinase mb',
            'ck frac mb',
        ],
    },
    {
        'marker_key': 'ldh',
        'marker_name': 'Desidrogenase Lática (LDH)',
        'aliases': [
            'desidrogenase latica',
            'desidrogenase lática',
            'lactato desidrogenase',
            'lactato-desidrogenase',
            'lactic acid dehydrogenase',
            'lactic dehydrogenase',
            'ldh',
        ],
    },

    # -----------------------------------------------------------------------
    # 10. INFLAMAÇÃO E RISCO
    # -----------------------------------------------------------------------
    {
        'marker_key': 'crp',
        'marker_name': 'Proteína C Reativa (PCR)',
        'aliases': [
            'proteina c reativa ultrassensivel',
            'proteína c reativa ultrassensível',
            'proteina c reativa quantitativa',
            'proteina c reativa',
            'proteína c reativa',
            'pcr ultrassensivel',
            'pcr-us',
            'pcr',
            'c-reactive protein',
            'crp',
        ],
    },
    {
        'marker_key': 'homocysteine',
        'marker_name': 'Homocisteína',
        'aliases': [
            'homocisteina',
            'homocisteína',
            'homocysteine',
        ],
    },
    {
        'marker_key': 'esr',
        'marker_name': 'Velocidade de Hemossedimentação (VHS)',
        'aliases': [
            'velocidade de hemossedimentacao',
            'velocidade de hemossedimentação',
            'vhs',
            'erythrocyte sedimentation rate',
            'esr',
        ],
    },

    # -----------------------------------------------------------------------
    # 11. VITAMINAS E MICRONUTRIENTES
    # -----------------------------------------------------------------------
    {
        'marker_key': 'vitamin_d',
        'marker_name': 'Vitamina D (25-OH)',
        'aliases': [
            '25 hidroxivitamina d',
            '25-hidroxivitamina d',
            '25 oh vitamina d',
            '25-oh vitamina d',
            '25(oh)d',
            'vitamina d 25-oh',
            'vitamina d total',
            'vitamina d',
            '25-hydroxyvitamin d',
            '25 hydroxyvitamin d',
            'vitamin d',
        ],
    },
    {
        'marker_key': 'zinc',
        'marker_name': 'Zinco',
        'aliases': [
            'zinco serico',
            'zinco',
            'serum zinc',
            'zinc',
        ],
    },
    {
        'marker_key': 'copper',
        'marker_name': 'Cobre',
        'aliases': [
            'cobre serico',
            'cobre',
            'serum copper',
            'copper',
        ],
    },
    {
        'marker_key': 'selenium',
        'marker_name': 'Selênio',
        'aliases': [
            'selenio serico',
            'selenio',
            'selênio',
            'serum selenium',
            'selenium',
        ],
    },
]

# ---------------------------------------------------------------------------
# REGEX PATTERNS
# ---------------------------------------------------------------------------

# Number pattern: handles Brazilian/European formats:
#   - 1.231,75  → European: thousands(.) + decimal(,) → 1231.75
#   - 8.300     → Brazilian thousands separator → 8300
#   - 0,75 / 247,34 → comma decimal
#   - 0.09 / 8.5    → period decimal (1-2 digits only, to avoid ambiguity with thousands sep)
# Lookbehind excludes digits, slash, comma and period so we don't re-match
# partial tokens (e.g. the "231,75" tail of "1.231,75").
NUMBER_RE = re.compile(
    r'(?<![\d/,.])'
    r'(-?\d{1,4}(?:\.\d{3}(?:,\d{1,4})?|[,]\d{1,4}|\.\d{1,2})?)'
    r'(?![\d/])',
)

UNIT_RE = re.compile(
    r'\b('
    r'mg/dl|g/dl|g/l|mmol/l|ui/l|u/l|mui/ml|mu/ml|ui/ml|u/ml|mu/l|'
    r'ng/ml|ng/dl|ng/l|pg/ml|pg/dl|pg/l|'
    r'µg/dl|µg/l|ug/dl|ug/l|mcg/dl|mcg/l|'
    r'µiu/ml|uiu/ml|miu/ml|uiu/l|'
    r'nmol/l|pmol/l|mmol/l|'
    r'meq/l|mmeq/l|'
    r'10\^?3/µl|10\^?3/ul|10\^?6/µl|10\^?6/ul|'
    r'10\^?\d+/?u?l|'
    r'fl|pg'
    r')\b'
    r'|(?<!\w)(%)(?!\w)',   # % has no usable word-boundary in lab reports
    re.IGNORECASE,
)

RANGE_RE = re.compile(
    r'(-?\d+(?:[.,]\d+)?)\s*(?:a|-|até|to)\s*(-?\d+(?:[.,]\d+)?)',
    re.IGNORECASE,
)
LESS_THAN_RE = re.compile(
    # (?!\d): ensure the full number is consumed before checking lookahead
    # (?!\s*anos\b): exclude age qualifiers like "menos de 20 anos"
    r'(?:inferior|menor|abaixo|less than|below)\s+(?:a|de|que|than)?\s*(-?\d+(?:[.,]\d+)?)(?!\d)(?!\s*anos\b)',
    re.IGNORECASE,
)
GREATER_THAN_RE = re.compile(
    # (?!\d): prevent partial digit match (e.g. "2" from "20") that bypasses lookahead
    # (?!\s*anos\b): exclude age qualifiers like "acima de 20 anos"
    r'(?:superior|maior|acima|greater than|above)\s+(?:a|de|que|than)?\s*(-?\d+(?:[.,]\d+)?)(?!\d)(?!\s*anos\b)',
    re.IGNORECASE,
)

# Comparator detection in result segments
# These differ from LESS_THAN_RE/GREATER_THAN_RE (which target reference ranges) because
# here we want to detect comparators in the result value portion itself.
RESULT_LESS_THAN_RE = re.compile(
    r'(?:inferior|menor|abaixo|less\s+than|below)\s+(?:a|de|que|than)?\s*(-?\d+(?:[.,]\d+)?)(?!\d)(?!\s*anos\b)'
    r'|(?<!\d)(<|<=)\s*(-?\d+(?:[.,]\d+)?)',
    re.IGNORECASE,
)
RESULT_GREATER_THAN_RE = re.compile(
    r'(?:superior|maior|acima|greater\s+than|above)\s+(?:a|de|que|than)?\s*(-?\d+(?:[.,]\d+)?)(?!\d)(?!\s*anos\b)'
    r'|(?<!\d)(>|>=)\s*(-?\d+(?:[.,]\d+)?)',
    re.IGNORECASE,
)

# Differential count markers — these carry both relative (%) and absolute (/mm³) values.
_DIFFERENTIAL_KEYS = frozenset({
    'neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils',
    'band_neutrophils', 'metamyelocytes', 'myelocytes',
})

STOP_PATTERNS = [
    'material',
    'metodo',
    'método',
    'metodologia',
    'assinado eletronicamente',
    'assinatura digital',
    'assinatura eletronica',
    'data de aprovacao',
    'data de aprovação',
    'data de saida',
    'data de saída',
    'tecnico(a) responsavel',
    'técnico(a) responsável',
    'responsavel tecnico',
    'responsável técnico',
    'nº do registro',
    'no do registro',
    'exame realizado',
    'medico responsavel',
    'médico responsável',
    'crm ',
    'crbm ',
    'carimbo',
    'pagina',
    'página',
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
    'nao foram definidos',
    'não foram definidos',
    'nao ha',
    'não há',
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

# Deduplicated sorted marker list (longest aliases first for reliable matching)
def _build_sorted_markers():
    result = []
    for marker in MARKERS:
        sorted_aliases = sorted(marker['aliases'], key=len, reverse=True)
        result.append({**marker, 'aliases': sorted_aliases})
    return result

_SORTED_MARKERS = _build_sorted_markers()


# ---------------------------------------------------------------------------
# TEXT UTILITIES
# ---------------------------------------------------------------------------

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
            # European format: 1.231,75 → 1231.75 (period=thousands, comma=decimal)
            text = text.replace('.', '').replace(',', '.')
        elif '.' in text and ',' not in text:
            # Only period present — determine if it's a thousands separator.
            # Heuristic: exactly 3 digits after the period AND integer part is non-zero
            # → Brazilian thousands sep (8.300 → 8300, 11.000 → 11000).
            # Otherwise treat as decimal point (0.75, 8.5, etc.).
            parts = text.lstrip('-').split('.')
            if len(parts) == 2 and len(parts[1]) == 3 and parts[0].lstrip('0') != '':
                text = text.replace('.', '')
            # else: leave as-is (decimal point)
        else:
            text = text.replace(',', '.')
        return float(text)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# LINE DEDUPLICATION
# ---------------------------------------------------------------------------

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
    seen = set()
    for raw_line in str(raw_text or '').splitlines():
        text = _normalize_space(raw_line)
        if not text:
            continue
        if set(text) == {'_'}:
            continue
        # Skip pure ruler/separator lines
        if re.match(r'^[=\-_\.\/\|]{3,}$', text):
            continue
        # Skip repeated header lines (page-level dedup)
        key = _normalize_text(text)
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


# ---------------------------------------------------------------------------
# MARKER DETECTION
# ---------------------------------------------------------------------------

def _find_marker(normalized_line):
    best = None
    for marker in _SORTED_MARKERS:
        for alias in marker['aliases']:
            normalized_alias = _normalize_text(alias)
            if re.search(rf'^(?:[\W_]*)(?:{re.escape(normalized_alias)})(?!\w)', normalized_line):
                score = len(normalized_alias)
                if best is None or score > best[0]:
                    best = (score, marker)
    return best[1] if best else None


def _has_stop_signal(normalized_line):
    return any(pattern in normalized_line for pattern in STOP_PATTERNS)


# ---------------------------------------------------------------------------
# BLOCK COLLECTION
# ---------------------------------------------------------------------------

def _collect_block(lines, start_idx):
    block = [lines[start_idx]]
    for idx in range(start_idx + 1, min(len(lines), start_idx + 15)):
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


# ---------------------------------------------------------------------------
# VALUE EXTRACTION
# ---------------------------------------------------------------------------

def _detect_comparator(segment):
    """Return ('<', value_text) or ('>', value_text) if a comparator is found, else (None, None)."""
    m = RESULT_LESS_THAN_RE.search(segment)
    if m:
        val_text = m.group(1) or m.group(3)
        return '<', val_text
    m = RESULT_GREATER_THAN_RE.search(segment)
    if m:
        val_text = m.group(1) or m.group(3)
        return '>', val_text
    return None, None


def _extract_from_tabular_line(line, next_line=None):
    """Handle single-line tabular format: MARKER VALUE UNIT REFERENCE_RANGE.
    Extracts value from the portion before the reference range begins."""
    # Find earliest reference pattern position
    ref_start = len(line)
    for pattern in (RANGE_RE, LESS_THAN_RE, GREATER_THAN_RE):
        m = pattern.search(line)
        if m and m.start() < ref_start:
            ref_start = m.start()

    pre_ref = line[:ref_start]
    if not pre_ref.strip():
        return None

    # Check comparator in pre-reference segment
    comparator, cmp_value_text = _detect_comparator(pre_ref)
    if comparator and cmp_value_text:
        numeric = _to_float(cmp_value_text)
        if numeric is not None:
            trailing = pre_ref[pre_ref.rfind(cmp_value_text) + len(cmp_value_text): pre_ref.rfind(cmp_value_text) + len(cmp_value_text) + 30]
            combined = f'{pre_ref} {line[ref_start:ref_start + 30]}'
            unit_match = UNIT_RE.search(trailing) or UNIT_RE.search(combined)
            unit = (unit_match.group(1) or unit_match.group(2)).lower() if unit_match else None
            return {
                'value_numeric': numeric,
                'value_text': cmp_value_text,
                'unit': unit,
                'source_line': _normalize_space(line),
                'raw_result_text': _normalize_space(pre_ref),
                'comparator': comparator,
                'value_kind': 'below_detection' if comparator == '<' else 'above_detection',
            }

    for match in NUMBER_RE.finditer(pre_ref):
        value_text = match.group(1)
        numeric = _to_float(value_text)
        if numeric is None:
            continue
        trailing = pre_ref[match.end(): match.end() + 30]
        combined = f'{pre_ref} {line[ref_start:ref_start + 30]}'
        if next_line:
            combined += f' {next_line}'
        unit_match = UNIT_RE.search(trailing) or UNIT_RE.search(combined[match.start(): match.start() + 80])
        unit = (unit_match.group(1) or unit_match.group(2)).lower() if unit_match else None
        return {
            'value_numeric': numeric,
            'value_text': value_text,
            'unit': unit,
            'source_line': _normalize_space(line),
            'raw_result_text': _normalize_space(pre_ref),
            'comparator': None,
            'value_kind': 'numeric',
        }
    return None


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
            # Special case: idx=0 (marker line) may be a tabular entry with
            # value + reference on the same line. Try extracting pre-reference portion.
            if idx == 0:
                next_line = block_lines[1] if len(block_lines) > 1 else None
                result = _extract_from_tabular_line(line, next_line)
                if result:
                    return result
            continue

        search_segment = line
        if 'resultado' in normalized:
            pos = normalized.find('resultado')
            if pos >= 0:
                search_segment = line[pos:]

        # Check for comparator result (e.g. "Inferior a 0,20 mUI/mL")
        comparator, cmp_value_text = _detect_comparator(search_segment)
        if comparator and cmp_value_text:
            numeric = _to_float(cmp_value_text)
            if numeric is not None:
                cmp_pos = search_segment.find(cmp_value_text)
                trailing = search_segment[cmp_pos + len(cmp_value_text): cmp_pos + len(cmp_value_text) + 30]
                combined_for_unit = f'{search_segment} {block_lines[idx + 1]}' if idx + 1 < len(block_lines) else search_segment
                unit_match = UNIT_RE.search(trailing) or UNIT_RE.search(combined_for_unit)
                unit = (unit_match.group(1) or unit_match.group(2)).lower() if unit_match else None
                return {
                    'value_numeric': numeric,
                    'value_text': cmp_value_text,
                    'unit': unit,
                    'source_line': _normalize_space(line),
                    'raw_result_text': _normalize_space(search_segment),
                    'comparator': comparator,
                    'value_kind': 'below_detection' if comparator == '<' else 'above_detection',
                }

        for match in NUMBER_RE.finditer(search_segment):
            value_text = match.group(1)
            numeric = _to_float(value_text)
            if numeric is None:
                continue
            if idx > 0 and _line_is_reference(block_lines[idx - 1]) and _line_is_reference(line) and 'resultado' not in normalized:
                continue
            trailing = search_segment[match.end(): match.end() + 30]
            combined_for_unit = f'{search_segment} {block_lines[idx + 1]}' if idx + 1 < len(block_lines) else search_segment
            unit_match = UNIT_RE.search(trailing) or UNIT_RE.search(combined_for_unit[match.start(): match.start() + 80])
            # group(1): standard units; group(2): % (separate pattern without word boundary)
            unit = (unit_match.group(1) or unit_match.group(2)).lower() if unit_match else None
            return {
                'value_numeric': numeric,
                'value_text': value_text,
                'unit': unit,
                'source_line': _normalize_space(line),
                'raw_result_text': _normalize_space(search_segment),
                'comparator': None,
                'value_kind': 'numeric',
            }
    return None


# ---------------------------------------------------------------------------
# REFERENCE EXTRACTION
# ---------------------------------------------------------------------------

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
    """Returns (ref_min, ref_max, reference_text, raw_reference_text)."""
    lines = _reference_lines(block_lines)
    if not lines:
        return None, None, None, None

    reference_text = ' | '.join(lines[:8]).strip() or None
    raw_reference_text = reference_text  # preserve original before any mutation
    normalized_text = _normalize_text(reference_text)
    ambiguous = any(hint in normalized_text for hint in AMBIGUOUS_REFERENCE_HINTS)

    if not ambiguous:
        range_match = RANGE_RE.search(reference_text)
        if range_match:
            return _to_float(range_match.group(1)), _to_float(range_match.group(2)), reference_text, raw_reference_text

        less_match = LESS_THAN_RE.search(reference_text)
        if less_match:
            return None, _to_float(less_match.group(1)), reference_text, raw_reference_text

        greater_match = GREATER_THAN_RE.search(reference_text)
        if greater_match:
            return _to_float(greater_match.group(1)), None, reference_text, raw_reference_text

    return None, None, reference_text, raw_reference_text


# ---------------------------------------------------------------------------
# FLAG AND CONFIDENCE
# ---------------------------------------------------------------------------

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
    if source_line and 'resultado' in _normalize_text(source_line):
        score += 0.02
    return round(min(score, 0.98), 2)


# ---------------------------------------------------------------------------
# DIFFERENTIAL PAIR EXTRACTION
# ---------------------------------------------------------------------------

# Percentage pattern that may precede an absolute count
_PERCENT_RE = re.compile(r'(-?\d{1,4}(?:[.,]\d{1,2})?)\s*%')
# Absolute count pattern: number followed by absolute-count unit or parentheses
_ABS_COUNT_RE = re.compile(
    r'[\(\[\s](-?\d{1,4}(?:[.,]\d{1,3})?)\s*(?:/mm[³3]|/mm3|/µl|/ul)?[\)\]\s]|'
    r'(-?\d{1,4}(?:[.,]\d{1,3})?)\s*/mm[³3]',
    re.IGNORECASE,
)


def _extract_differential_pair(block_lines):
    """For differential-count markers (neutrophils, lymphocytes, etc.) that report
    both a relative percentage and an absolute count on the same line.

    Returns (relative_value, absolute_value) or (None, None).
    """
    for line in block_lines[:6]:
        pct_match = _PERCENT_RE.search(line)
        abs_match = _ABS_COUNT_RE.search(line)
        if pct_match and abs_match:
            rel = _to_float(pct_match.group(1))
            abs_val = _to_float(abs_match.group(1) or abs_match.group(2))
            if rel is not None and abs_val is not None:
                return rel, abs_val
    return None, None


# ---------------------------------------------------------------------------
# MAIN ENTRY POINT
# ---------------------------------------------------------------------------

def parse_biomarkers(lines, raw_text=None, pages=None):
    """Parse biomarkers from OCR output.

    Args:
        lines: list of row dicts from table parser (may be empty)
        raw_text: raw text from PDF/OCR extraction (canonical fallback)
        pages: page objects (not used, kept for API compatibility)

    Returns:
        list of normalized biomarker dicts, one per detected marker_key
        (duplicates resolved by highest confidence + longest source_line)

    Each entry includes the rich shape:
        marker_key, marker_name, value_numeric, value_text, unit,
        reference_min, reference_max, reference_text, raw_reference_text,
        flag, source_line, confidence,
        raw_result_text, comparator, value_kind, parse_status,
        relative_value, absolute_value
    """
    del pages  # not used

    source_lines = _source_lines_from_table(lines)
    raw_lines = _source_lines_from_raw_text(raw_text)

    # Merge: table lines first (higher precision), then raw lines as fallback
    merged_lines = source_lines + raw_lines

    parsed: dict = {}
    for idx, line in enumerate(merged_lines):
        marker = _find_marker(_normalize_text(line))
        if not marker:
            continue

        block_lines = _collect_block(merged_lines, idx)
        value_payload = _extract_value_and_unit(block_lines)
        if not value_payload:
            continue

        ref_min, ref_max, ref_text, raw_ref_text = _extract_reference(block_lines)
        evidence = ' | '.join(_normalize_space(item) for item in block_lines[:8])

        # Determine parse_status
        comparator = value_payload.get('comparator')
        value_kind = value_payload.get('value_kind', 'numeric')
        if comparator:
            parse_status = 'parsed'
        elif ref_text and not ref_min and not ref_max:
            parse_status = 'ambiguous'
        else:
            parse_status = 'parsed'

        # Differential pair (relative % + absolute count)
        relative_value = None
        absolute_value = None
        if marker['marker_key'] in _DIFFERENTIAL_KEYS:
            relative_value, absolute_value = _extract_differential_pair(block_lines)
            if relative_value is not None and absolute_value is not None:
                value_kind = 'relative_absolute_pair'
                # Prefer absolute for value_numeric when available
                if absolute_value is not None:
                    value_payload = dict(value_payload)
                    value_payload['value_numeric'] = absolute_value
                    value_payload['value_text'] = str(absolute_value)

        item = {
            'marker_key': marker['marker_key'],
            'marker_name': marker['marker_name'],
            'value_numeric': value_payload['value_numeric'],
            'value_text': value_payload['value_text'],
            'unit': value_payload['unit'],
            'reference_min': ref_min,
            'reference_max': ref_max,
            'reference_text': ref_text,
            'raw_reference_text': raw_ref_text,
            'flag': _normalize_flag(value_payload['value_numeric'], ref_min, ref_max),
            'source_line': evidence or value_payload['source_line'],
            'confidence': _confidence(value_payload['unit'], ref_text, value_payload['source_line']),
            'raw_result_text': value_payload.get('raw_result_text'),
            'comparator': comparator,
            'value_kind': value_kind,
            'parse_status': parse_status,
            'relative_value': relative_value,
            'absolute_value': absolute_value,
        }

        previous = parsed.get(marker['marker_key'])
        if previous is None or (
            item['confidence'],
            len(item['source_line'] or ''),
        ) > (previous['confidence'], len(previous['source_line'] or '')):
            parsed[marker['marker_key']] = item

    return list(parsed.values())
