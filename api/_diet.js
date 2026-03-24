/**
 * Calculadora determinística de dieta — KRONOS
 * Mifflin-St Jeor + macros por objetivo + restrições alimentares.
 */

function round(v, decimals) {
  var d = decimals || 0;
  var f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

var FATOR_ATIVIDADE = {
  sedentario:  1.2,
  leve:        1.375,
  moderado:    1.55,
  ativo:       1.725,
  muito_ativo: 1.9
};

function detectFatorAtividade(rotina, frequencia) {
  // Frequência de treino tem prioridade se fornecida
  if (frequencia) {
    var dias = parseInt(String(frequencia));
    if (!isNaN(dias)) {
      if (dias <= 1) return FATOR_ATIVIDADE.leve;
      if (dias <= 3) return FATOR_ATIVIDADE.moderado;
      if (dias <= 5) return FATOR_ATIVIDADE.ativo;
      return FATOR_ATIVIDADE.muito_ativo;
    }
  }
  if (!rotina) return FATOR_ATIVIDADE.moderado;
  var r = String(rotina).toLowerCase();
  if (/sentado|escritorio|pouco|sedent/.test(r))   return FATOR_ATIVIDADE.sedentario;
  if (/leve|caminhada/.test(r))                    return FATOR_ATIVIDADE.leve;
  if (/muito ativo|todo dia|diaria/.test(r))       return FATOR_ATIVIDADE.muito_ativo;
  if (/ativo|academia/.test(r))                    return FATOR_ATIVIDADE.ativo;
  return FATOR_ATIVIDADE.moderado;
}

function calculateCalories(profile) {
  var peso    = Number(profile.peso)   || 75;
  var altura  = Number(profile.altura) || 170;
  var idade   = Number(profile.idade)  || 30;
  var isMale  = (profile.sexo || 'masculino') !== 'feminino';
  var fator   = Number(profile.fatorAtividade) || detectFatorAtividade(profile.rotina, profile.frequencia);
  var objetivo = profile.objetivo || 'manter';

  var tmb = isMale
    ? (10 * peso) + (6.25 * altura) - (5 * idade) + 5
    : (10 * peso) + (6.25 * altura) - (5 * idade) - 161;

  var kcal = tmb * fator;

  if (/emagre/.test(objetivo))                   kcal -= 400;
  if (/hipertrofia|ganhar|massa/.test(objetivo)) kcal += 300;

  return round(kcal);
}

function calculateMacros(calorias, peso, objetivo) {
  var obj = objetivo || 'manter';
  // Proteína: emagrecimento prioriza massa magra (2.2g), hipertrofia (2.0g), manter (1.8g)
  var protKg = /emagre/.test(obj) ? 2.2 : /hipertrofia|ganhar|massa/.test(obj) ? 2.0 : 1.8;
  // Gordura mínima para saúde hormonal
  var gordKg = /emagre/.test(obj) ? 0.8 : 0.9;

  var proteina = round(Number(peso) * protKg);
  var gordura  = round(Number(peso) * gordKg);
  var carbo    = round((calorias - (proteina * 4) - (gordura * 9)) / 4);

  // Carbo negativo (perfil extremo) — redistribui para proteína
  if (carbo < 50) {
    carbo    = 50;
    proteina = round((calorias - (carbo * 4) - (gordura * 9)) / 4);
  }

  return { proteina: proteina, carbo: carbo, gordura: gordura };
}

// ─── Base de refeições ─────────────────────────────────────────────
function buildBaseMeals(objetivo) {
  var preWorkout = /emagre/.test(objetivo || '')
    ? 'Banana + aveia (30g) — energia sem excesso calórico'
    : 'Banana + aveia (40g) + leite desnatado — carga de carboidrato pré-treino';

  return [
    {
      nome:     'Café da manhã',
      horario:  '07:00',
      foco:     'ENERGIA MATINAL',
      proteinas: ['Ovos mexidos (2-3 unidades)', 'Iogurte natural integral (150g)'],
      carbos:    ['Pão integral (1-2 fatias)', 'Aveia (30g)'],
      extras:    ['Fruta da estação (1 unidade)', 'Café preto sem açúcar']
    },
    {
      nome:     'Almoço',
      horario:  '12:00',
      foco:     'RECUPERAÇÃO MUSCULAR',
      proteinas: ['Frango grelhado (130-150g)', 'Carne moída patinho (130g) como alternativa'],
      carbos:    ['Arroz branco cozido (2 conchas = ~160g)', 'Feijão carioca cozido (1 concha = ~80g)'],
      extras:    ['Salada verde à vontade (alface, rúcula, agrião)', 'Legumes cozidos (brócolis, abobrinha)', 'Azeite (1 colher de sopa)']
    },
    {
      nome:     'Lanche pré-treino',
      horario:  '16:00',
      foco:     'ENERGIA PRÉ-TREINO',
      proteinas: ['Iogurte grego (100g)'],
      carbos:    [preWorkout],
      extras:    ['Creatina 3-5g (se em uso)']
    },
    {
      nome:     'Jantar / pós-treino',
      horario:  '20:00',
      foco:     'RECUPERAÇÃO NOTURNA',
      proteinas: ['Carne magra grelhada (patinho/filé 120-140g)', 'Atum em conserva (2 latas = ~160g) como alternativa rápida'],
      carbos:    ['Batata-doce cozida (150g) ou inhame', 'Arroz integral (1 concha) como opção'],
      extras:    ['Brócolis/couve-flor cozido (100g)', 'Azeite (1 colher de chá)']
    }
  ];
}

// ─── Aplica restrições alimentares ────────────────────────────────
function applyRestrictions(meals, restricoes) {
  if (!restricoes || /n[aã]o|nenhuma|sem restri/i.test(restricoes)) return meals;

  var r = String(restricoes).toLowerCase();

  return meals.map(function(meal) {
    var m = {
      nome:      meal.nome,
      horario:   meal.horario,
      foco:      meal.foco,
      proteinas: meal.proteinas.slice(),
      carbos:    meal.carbos.slice(),
      extras:    meal.extras.slice()
    };

    // ── Vegano ─────────────────────────────────────────────────────
    if (/vegano|vegan/.test(r)) {
      m.proteinas = m.proteinas.map(function(p) {
        return p
          .replace(/frango grelhado[^,)]*/gi,      'tofu firme grelhado (150g)')
          .replace(/carne moída[^,)]*/gi,           'proteína de soja texturizada (PST) hidratada (150g)')
          .replace(/ovos mexidos[^,)]*/gi,          'tofu scramble com cúrcuma (2 porções)')
          .replace(/iogurte[^,)]*/gi,               'iogurte de coco (150g)')
          .replace(/atum[^,)]*/gi,                  'grão-de-bico cozido (150g)')
          .replace(/carne magra[^,)]*/gi,           'lentilha cozida (180g)');
      });
      m.extras = m.extras.map(function(e) {
        return e.replace(/iogurte[^,)]*/gi, 'pasta de amendoim natural (1 col sopa)');
      });
    }
    // ── Vegetariano (sem carne, com ovo/laticínio) ─────────────────
    else if (/vegetarian/.test(r)) {
      m.proteinas = m.proteinas.map(function(p) {
        return p
          .replace(/frango grelhado[^,)]*/gi,   'omelete de 3 ovos com queijo cottage')
          .replace(/carne moída[^,)]*/gi,        'grão-de-bico refogado (150g)')
          .replace(/atum[^,)]*/gi,               'queijo cottage (150g)')
          .replace(/carne magra[^,)]*/gi,        'tofu grelhado (150g) ou ovo cozido (3 unidades)');
      });
    }

    // ── Sem lactose / laticínios ────────────────────────────────────
    if (/lactose|laticín|queijo|iogurte sem|intoler/.test(r)) {
      m.proteinas = m.proteinas.map(function(p) {
        return p.replace(/iogurte[^,)]*/gi, 'iogurte sem lactose (150g) ou leite de coco');
      });
      m.extras = m.extras.map(function(e) {
        return e.replace(/iogurte[^,)]*/gi, 'iogurte sem lactose ou banana amassada');
      });
    }

    // ── Sem glúten ─────────────────────────────────────────────────
    if (/gl[úu]ten|cel[íi]ac/.test(r)) {
      m.carbos = m.carbos.map(function(c) {
        return c
          .replace(/pão integral[^,)]*/gi, 'tapioca (2 unidades) ou cuscuz de milho')
          .replace(/aveia[^,)]*/gi,         'farinha de arroz ou aveia certificada sem glúten');
      });
    }

    // ── Sem frango ─────────────────────────────────────────────────
    if (/sem frango|n[aã]o (?:como|gosto de) frango/.test(r)) {
      m.proteinas = m.proteinas.map(function(p) {
        return p.replace(/frango grelhado[^,)]*/gi, 'tilápia grelhada (130g) ou atum em conserva');
      });
    }

    // ── Sem carne vermelha ──────────────────────────────────────────
    if (/sem carne vermelha|n[aã]o (?:como|gosto de) carne vermelha/.test(r)) {
      m.proteinas = m.proteinas.map(function(p) {
        return p
          .replace(/carne moída[^,)]*/gi, 'frango picado refogado (130g)')
          .replace(/carne magra[^,)]*/gi, 'salmão grelhado (120g) ou frango');
      });
    }

    return m;
  });
}

// ─── Monta texto da refeição para o response ───────────────────────
function formatMeal(meal) {
  var lines = [meal.horario + ' — ' + meal.nome + ' (' + meal.foco + ')'];
  lines.push('  Proteínas: ' + meal.proteinas.join(' | '));
  lines.push('  Carboidratos: ' + meal.carbos.join(' | '));
  if (meal.extras && meal.extras.length) {
    lines.push('  Extras/Gorduras: ' + meal.extras.join(' | '));
  }
  return lines.join('\n');
}

// ─── Monta mensagem para enriquecimento por IA ────────────────────
function buildDietAIMessage(profile, meta, meals) {
  var objetivo    = profile.objetivo    || 'manter';
  var peso        = profile.peso        || '75';
  var nivel       = profile.nivel       || 'intermediário';
  var restricoes  = profile.restricoes  || 'nenhuma';
  var rotina      = profile.rotina      || 'não informada';

  var mealsText = meals.map(formatMeal).join('\n\n');

  return 'Analise este plano alimentar e adicione orientações específicas e práticas para este usuário:\n\n'
    + 'PERFIL:\n'
    + '- Objetivo: ' + objetivo + '\n'
    + '- Peso: ' + peso + 'kg\n'
    + '- Nível de treino: ' + nivel + '\n'
    + '- Rotina/atividade: ' + rotina + '\n'
    + '- Restrições alimentares: ' + restricoes + '\n\n'
    + 'METAS CALCULADAS:\n'
    + '- ' + meta.calorias + ' kcal/dia\n'
    + '- Proteína: ' + meta.proteina + 'g (' + round(meta.proteina / Number(peso), 1) + 'g/kg)\n'
    + '- Carboidrato: ' + meta.carbo + 'g\n'
    + '- Gordura: ' + meta.gordura + 'g\n'
    + '- Água: ' + round(Number(peso) * 0.035, 1) + 'L\n\n'
    + 'REFEIÇÕES BASE:\n' + mealsText + '\n\n'
    + 'Forneça:\n'
    + '1. Ajuste de porções específicas para bater as metas (em gramas ou medidas caseiras)\n'
    + '2. Timing ideal das refeições em relação ao treino\n'
    + '3. Dicas práticas de preparo para a rotina informada\n'
    + '4. Uma alternativa para cada refeição principal (caso não tenha o alimento)\n'
    + '5. Alerta se alguma meta estiver difícil de bater com o perfil informado\n'
    + 'Seja direto, específico e prático. Responda em português brasileiro.';
}

// ─── Função principal ─────────────────────────────────────────────
function buildDietPlan(profile) {
  var peso     = Number(profile.peso)  || 75;
  var objetivo = profile.objetivo      || 'manter';

  var calorias = calculateCalories(profile);
  var macros   = calculateMacros(calorias, peso, objetivo);
  var baseMeals = buildBaseMeals(objetivo);
  var meals    = applyRestrictions(baseMeals, profile.restricoes);

  return {
    meta: {
      calorias: calorias,
      proteina: macros.proteina,
      carbo:    macros.carbo,
      gordura:  macros.gordura
    },
    refeicoes:  meals,
    hidratacao: { litros: round(peso * 0.035, 1) },
    observacoes: [
      'Distribua a proteína em todas as refeições principais (mínimo 25-30g por refeição).',
      'Beba ' + round(peso * 0.035, 1) + 'L de água ao longo do dia.',
      'Pré-treino: priorize carboidrato. Pós-treino: priorize proteína em até 2h.',
      'Ajuste as porções semanalmente conforme a resposta do corpo.'
    ]
  };
}

module.exports = {
  buildDietPlan:       buildDietPlan,
  buildDietAIMessage:  buildDietAIMessage,
  calculateCalories:   calculateCalories,
  calculateMacros:     calculateMacros,
  applyRestrictions:   applyRestrictions,
  round:               round
};
