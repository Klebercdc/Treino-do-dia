/**
 * Calculadora determinística de dieta — KRONOS
 * Mifflin-St Jeor + macros por objetivo.
 * Não depende de IA — resultado imediato e previsível.
 */

function round(v, decimals) {
  var d = decimals || 0;
  var f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

var FATOR_ATIVIDADE = {
  sedentario:      1.2,
  leve:            1.375,
  moderado:        1.55,
  ativo:           1.725,
  muito_ativo:     1.9
};

function detectFatorAtividade(rotina) {
  if (!rotina) return 1.55;
  var r = String(rotina).toLowerCase();
  if (/sentado|escritorio|pouco|sedent/.test(r))    return FATOR_ATIVIDADE.sedentario;
  if (/leve|caminhada|1.{0,5}2.{0,5}vez/.test(r))  return FATOR_ATIVIDADE.leve;
  if (/ativo|academia|3.{0,5}4.{0,5}vez/.test(r))  return FATOR_ATIVIDADE.ativo;
  if (/muito ativo|todo dia|diaria/.test(r))        return FATOR_ATIVIDADE.muito_ativo;
  return FATOR_ATIVIDADE.moderado;
}

function calculateCalories(profile) {
  var peso    = Number(profile.peso)    || 75;
  var altura  = Number(profile.altura)  || 170;
  var idade   = Number(profile.idade)   || 30;
  var isMale  = (profile.sexo || 'masculino') !== 'feminino';
  var fator   = Number(profile.fatorAtividade) || detectFatorAtividade(profile.rotina);
  var objetivo = profile.objetivo || 'manter';

  var tmb = isMale
    ? (10 * peso) + (6.25 * altura) - (5 * idade) + 5
    : (10 * peso) + (6.25 * altura) - (5 * idade) - 161;

  var kcal = tmb * fator;

  if (/emagre/.test(objetivo))              kcal -= 400;
  if (/hipertrofia|ganhar|massa/.test(objetivo)) kcal += 300;

  return round(kcal);
}

function calculateMacros(calorias, peso, objetivo) {
  var obj = objetivo || 'manter';
  var protKg = /emagre/.test(obj) ? 2.2 : 2.0;
  var gordKg = /emagre/.test(obj) ? 0.8 : 0.9;

  var proteina = round(Number(peso) * protKg);
  var gordura  = round(Number(peso) * gordKg);
  var carbo    = round((calorias - (proteina * 4) - (gordura * 9)) / 4);

  return { proteina: proteina, carbo: carbo, gordura: gordura };
}

function buildDietPlan(profile) {
  var peso     = Number(profile.peso)  || 75;
  var objetivo = profile.objetivo      || 'manter';

  var calorias = calculateCalories(profile);
  var macros   = calculateMacros(calorias, peso, objetivo);

  return {
    meta: {
      calorias: calorias,
      proteina: macros.proteina,
      carbo:    macros.carbo,
      gordura:  macros.gordura
    },
    refeicoes: [
      {
        nome:     'Café da manhã',
        horario:  '07:00',
        foco:     'ENERGIA MATINAL',
        sugestao: 'Ovos mexidos (2-3 unidades) + pão integral + fruta + iogurte natural'
      },
      {
        nome:     'Almoço',
        horario:  '12:00',
        foco:     'RECUPERAÇÃO MUSCULAR',
        sugestao: 'Frango grelhado + arroz branco + feijão + salada verde'
      },
      {
        nome:     'Lanche',
        horario:  '16:00',
        foco:     'ENERGIA PRÉ-TREINO',
        sugestao: 'Banana + aveia + leite desnatado'
      },
      {
        nome:     'Jantar',
        horario:  '20:00',
        foco:     'RECUPERAÇÃO NOTURNA',
        sugestao: 'Carne magra (patinho ou filé) + batata-doce + brócolis'
      }
    ],
    hidratacao: {
      litros: round(peso * 0.035, 1)
    },
    observacoes: [
      'Distribua a proteína em todas as refeições principais.',
      'Ajuste as porções para atingir as metas de macros.',
      'Pese os alimentos cozidos quando possível.'
    ]
  };
}

module.exports = {
  buildDietPlan:       buildDietPlan,
  calculateCalories:   calculateCalories,
  calculateMacros:     calculateMacros
};
