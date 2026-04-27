/* Etapa 3 — Saúde e Exames */

function renderDietStepHealth(data) {
  data = data || {};
  var patologias = [
    'Diabetes tipo 1', 'Diabetes tipo 2', 'Hipertensão', 'Dislipidemia',
    'Hipotireoidismo', 'Hipertireoidismo', 'DRC (Doença Renal Crônica)',
    'Hiperuricemia/Gota', 'Síndrome metabólica', 'Obesidade', 'Outra'
  ];
  var sel = data.patologias || [];

  return [
    '<div class="dw-step-title">Saúde e Exames</div>',
    '<p class="dw-step-desc">Nenhum campo obrigatório. Quanto mais soubermos, mais segura será sua dieta.</p>',

    '<div class="dw-alert-legal">',
      'O KroniA não substitui avaliação de nutricionista, médico ou profissional habilitado.',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Condições de saúde (selecione todas que se aplicam)</label>',
      '<div class="dw-chips-wrap">',
        patologias.map(function(p) {
          var active = sel.indexOf(p) !== -1;
          return '<button type="button" class="dw-chip' + (active ? ' active' : '') + '" data-group="patologias" data-multi="true" data-value="' + p + '">' + p + '</button>';
        }).join(''),
      '</div>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Observações clínicas (opcional)</label>',
      '<textarea class="dw-textarea" name="observacoesClincias" placeholder="Ex: uso de metformina, histórico de hipoglicemia...">' + (data.observacoesClincias || '') + '</textarea>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Restrições clínicas (opcional)</label>',
      '<textarea class="dw-textarea" name="restricoesClinicas" placeholder="Ex: sem potássio elevado, sem glúten por orientação médica...">' + (data.restricoesClinicas || '') + '</textarea>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Exames de laboratório</label>',
      '<p class="dw-info-text">Seus exames carregados anteriormente são considerados automaticamente.</p>',
      '<button type="button" class="dw-btn-secondary" onclick="try{openLabsSheet();}catch(_){}">Ver meus exames</button>',
    '</div>',
  ].join('');
}
