'use strict';

var TACO_FOOD_UX_OVERRIDES = {
  TACO_0053: {
    display_name: 'Pão francês',
    default_portion_g: 50,
    default_unit: '1 unidade média (50 g)',
    medida_caseira: '1 unidade média (50 g)',
    aliases: ['pao frances', 'pão francês', 'francesinho']
  },
  TACO_0488: {
    display_name: 'Ovo de galinha',
    default_portion_g: 50,
    default_unit: '1 unidade média (50 g)',
    medida_caseira: '1 unidade média (50 g)',
    aliases: ['ovo', 'ovo cozido', 'ovo de galinha']
  },
  TACO_0182: {
    display_name: 'Banana',
    default_portion_g: 86,
    default_unit: '1 unidade média (86 g)',
    medida_caseira: '1 unidade média (86 g)',
    aliases: ['banana', 'banana prata']
  },
  TACO_0221: {
    display_name: 'Maçã',
    default_portion_g: 130,
    default_unit: '1 unidade média (130 g)',
    medida_caseira: '1 unidade média (130 g)',
    aliases: ['maca', 'maçã']
  },
  TACO_0003: {
    display_name: 'Arroz branco cozido',
    default_portion_g: 120,
    default_unit: '4 colheres de sopa cheias (120 g)',
    medida_caseira: '4 colheres de sopa cheias (120 g)',
    aliases: ['arroz', 'arroz branco', 'arroz cozido']
  },
  TACO_0001: {
    display_name: 'Arroz integral cozido',
    default_portion_g: 120,
    default_unit: '4 colheres de sopa cheias (120 g)',
    medida_caseira: '4 colheres de sopa cheias (120 g)',
    aliases: ['arroz integral', 'arroz integral cozido']
  },
  TACO_0561: {
    display_name: 'Feijão carioca cozido',
    default_portion_g: 100,
    default_unit: '1 concha média (100 g)',
    medida_caseira: '1 concha média (100 g)',
    aliases: ['feijao', 'feijão', 'feijao carioca', 'feijão carioca']
  },
  TACO_0567: {
    display_name: 'Feijão preto cozido',
    default_portion_g: 100,
    default_unit: '1 concha média (100 g)',
    medida_caseira: '1 concha média (100 g)',
    aliases: ['feijao preto', 'feijão preto']
  },
  TACO_0088: {
    display_name: 'Batata-doce cozida',
    default_portion_g: 130,
    default_unit: '1 unidade média (130 g)',
    medida_caseira: '1 unidade média (130 g)',
    aliases: ['batata doce', 'batata-doce', 'batata doce cozida']
  },
  TACO_0091: {
    display_name: 'Batata inglesa cozida',
    default_portion_g: 150,
    default_unit: '1 unidade média (150 g)',
    medida_caseira: '1 unidade média (150 g)',
    aliases: ['batata inglesa', 'batata cozida']
  },
  TACO_0551: {
    display_name: 'Tapioca',
    default_portion_g: 70,
    default_unit: '1 unidade média (70 g)',
    medida_caseira: '1 unidade média (70 g)',
    aliases: ['tapioca']
  },
  TACO_0040: {
    display_name: 'Macarrão de trigo',
    default_portion_g: 80,
    default_unit: '1 prato raso cozido a partir de 80 g cru',
    medida_caseira: '1 prato raso cozido a partir de 80 g cru',
    aliases: ['macarrao', 'macarrão', 'macarrao trigo', 'macarrão de trigo']
  }
};

function normalizeTacoUxText(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandSimplePluralAliases(values) {
  var out = [];
  (values || []).forEach(function (value) {
    var normalized = normalizeTacoUxText(value);
    if (!normalized) return;
    out.push(value);
    out.push(normalized);
    var tokens = normalized.split(' ').map(function (token) {
      if (token.length > 3 && /s$/.test(token)) return token.slice(0, -1);
      return token;
    });
    out.push(tokens.join(' '));
  });
  return out.filter(Boolean);
}

function uniqueAliases(values) {
  var seen = Object.create(null);
  var out = [];
  expandSimplePluralAliases(values).forEach(function (value) {
    var key = normalizeTacoUxText(value);
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(value);
  });
  return out;
}

function classifyTacoFoodGroup(food) {
  var text = normalizeTacoUxText([
    food && food.categoria,
    food && food.nome,
    food && food.display_name,
    food && food.display_name_pt
  ].filter(Boolean).join(' '));

  if (/(feij|lentilha|grao de bico|ervilha|leguminosa)/.test(text)) return 'leguminosas';
  if (/(frut|banana|\bmaca\b|abacate)/.test(text)) {
    if (/abacate/.test(text)) return 'gorduras';
    return 'frutas';
  }
  if (/(cereal|pao|paes|massa|macarrao|arroz|raiz|raizes|tuberc|farinha|tapioca|batata)/.test(text)) return 'carboidratos';
  if (/(hortalic|verdura|legume|veget|brocol|cenoura|tomate|alface)/.test(text)) return 'vegetais';
  if (/(oleo|oleos|gordura|azeite|castanha|semente|amendoim|oleaginosa|abacate)/.test(text)) return 'gorduras';
  if (/(carne|ovo|ovos|pescad|peixe|frango|bovin|suin|leite|queijo|iogurte|proteina)/.test(text)) return 'proteinas';
  return 'carboidratos';
}

function applyTacoFoodUx(food) {
  if (!food || typeof food !== 'object') return food;
  var tacoId = food.taco_id || food.id || food.code || null;
  var override = tacoId && TACO_FOOD_UX_OVERRIDES[tacoId] ? TACO_FOOD_UX_OVERRIDES[tacoId] : null;
  var officialName = food.official_name || food.nome || food.name || food.display_name_pt || null;
  var displayName = override && override.display_name ? override.display_name : (food.display_name || food.display_name_pt || food.nome || food.name || 'Alimento');
  var aliases = uniqueAliases([]
    .concat(Array.isArray(food.aliases) ? food.aliases : [])
    .concat(override && Array.isArray(override.aliases) ? override.aliases : [])
    .concat([officialName, displayName]));

  return Object.assign({}, food, {
    display_name: displayName,
    display_name_pt: displayName,
    canonical_name_pt: displayName,
    nome: displayName,
    official_name: officialName,
    default_portion_g: override && override.default_portion_g ? override.default_portion_g : (food.default_portion_g || food.porcao_gramas || food.grams || food.gramas || 100),
    default_unit: override && override.default_unit ? override.default_unit : (food.default_unit || food.medida_caseira || '100 g'),
    medida_caseira: override && override.medida_caseira ? override.medida_caseira : (food.medida_caseira || food.default_unit || '100 g'),
    group_key: food.group_key || classifyTacoFoodGroup(Object.assign({}, food, override || {})),
    grupo: food.grupo || food.group_key || classifyTacoFoodGroup(Object.assign({}, food, override || {})),
    aliases: aliases,
    source: food.source || 'taco',
    source_type: food.source_type || 'taco',
    is_taco_fallback: true
  });
}

module.exports = {
  TACO_FOOD_UX_OVERRIDES: TACO_FOOD_UX_OVERRIDES,
  normalizeTacoUxText: normalizeTacoUxText,
  classifyTacoFoodGroup: classifyTacoFoodGroup,
  applyTacoFoodUx: applyTacoFoodUx
};
