/* KroniA Diet Wizard Standalone — 6 etapas + geração visual garantida */
(function () {
  var SCREEN_ID = 'dietProfileWizardScreen';
  var STATE_KEY = 'kronia_diet_wizard_state_v6_standalone';
  var LAST_PLAN_KEY = 'kronia_last_generated_diet';
  window.__kroniaDietGenerationCompleted = window.__kroniaDietGenerationCompleted === true;
  var steps = [
    { key:'body', badge:'Etapa 1/6', title:'Composição corporal', sub:'Base metabólica, BCM/manual e medidas para calcular sua dieta com precisão.' },
    { key:'goal', badge:'Etapa 2/6', title:'Objetivo e estratégia', sub:'Foco, velocidade de resultado, refeições e meta calórica.' },
    { key:'health', badge:'Etapa 3/6', title:'Saúde, patologias e exames', sub:'Contexto clínico para um plano mais seguro.' },
    { key:'food', badge:'Etapa 4/6', title:'Preferências alimentares', sub:'Alimentos, restrições, rotina e aderência prática.' },
    { key:'training', badge:'Etapa 5/6', title:'Treino e gasto real', sub:'Musculação, cardio, CrossFit, frequência e intensidade.' },
    { key:'metabolism', badge:'Etapa 6/6', title:'Metabolismo e adesão', sub:'Fome, sono, estresse, resposta do peso e ajustes finos.' }
  ];

  function $(id){ return document.getElementById(id); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function num(v){ var n = Number(String(v || '').replace(',','.')); return Number.isFinite(n) ? n : null; }
  function round(n){ return Math.round(Number(n)||0); }
  function toast(msg,type){ if(typeof window.showToast==='function') window.showToast(msg,type||'info',3500); else alert(msg); }
  function getUserId(){
    try { return (window.currentUser && (window.currentUser.id || window.currentUser.uid)) || (window.authUser && window.authUser.id) || null; }
    catch(_) { return null; }
  }

  function freshState(userId){ return { userId:userId||null, current:0, data:{}, startedAt:new Date().toISOString() }; }
  function readState(userId, forceNew){
    if(!forceNew){ try{ var s=JSON.parse(localStorage.getItem(STATE_KEY)||'null'); if(s && s.userId===(userId||null) && typeof s.current==='number') return sanitizeState(s,userId); }catch(_){} }
    return freshState(userId);
  }
  function sanitizeState(s,userId){
    if(!s || typeof s!=='object') return freshState(userId);
    if(typeof s.current!=='number' || s.current<0 || s.current>=steps.length) s.current=0;
    if(!s.data || typeof s.data!=='object') s.data={};
    s.userId=userId||null;
    return s;
  }
  function saveState(s){ window.__kroniaDietWizardState=s; try{ localStorage.setItem(STATE_KEY,JSON.stringify(s)); }catch(_){} }
  function clearState(){ try{ localStorage.removeItem(STATE_KEY); }catch(_){} }
  function toActiveDietPlan(plan){
    var meals = Array.isArray(plan && plan.meals) ? plan.meals : [];
    return {
      title: plan && plan.title || 'Plano alimentar KroniA',
      source: plan && plan.source || 'diet_wizard_standalone',
      status: 'active',
      objective: plan && plan.requestPayload && (plan.requestPayload.objective || plan.requestPayload.objetivo) || 'recomposicao',
      targets: {
        kcal: round(plan && plan.target && plan.target.kcal),
        protein: round(plan && plan.target && plan.target.protein),
        carbs: round(plan && plan.target && plan.target.carbs),
        fat: round(plan && plan.target && plan.target.fat)
      },
      meals: meals.map(function(m, mealIndex){
        return {
          id: 'standalone_meal_' + (mealIndex + 1),
          name: m.name || 'Refeição',
          time: m.time || '',
          slot: m.name || 'refeicao',
          items: (Array.isArray(m.items) ? m.items : []).map(function(i, itemIndex){
            return {
              id: 'standalone_item_' + (mealIndex + 1) + '_' + (itemIndex + 1),
              name: i.name || 'Alimento',
              quantity: i.qty || i.quantity || '1 porção',
              kcal: round(i.kcal),
              protein: Number(i.protein || 0),
              carbs: Number(i.carbs || 0),
              fat: Number(i.fat || 0)
            };
          })
        };
      }),
      orientacoes: Array.isArray(plan && plan.warnings) ? plan.warnings : [],
      rawGeneratedPlan: plan || null
    };
  }

  function chip(group,value,label,multi){ return '<button type="button" class="kdw-chip" data-group="'+esc(group)+'" data-value="'+esc(value)+'" data-multi="'+(multi?'1':'0')+'">'+esc(label)+'</button>'; }
  function field(label,name,type,ph){ return '<label class="kdw-label">'+label+'</label><input class="kdw-input" name="'+esc(name)+'" type="'+(type||'text')+'" inputmode="'+(type==='number'?'decimal':'text')+'" placeholder="'+esc(ph||'')+'">'; }
  function textarea(label,name,ph){ return '<label class="kdw-label">'+label+'</label><textarea class="kdw-textarea" name="'+esc(name)+'" placeholder="'+esc(ph||'')+'"></textarea>'; }
  function select(label,name,opts){ return '<label class="kdw-label">'+label+'</label><select class="kdw-input" name="'+esc(name)+'">'+opts.map(function(o){return '<option value="'+esc(o[0])+'">'+esc(o[1])+'</option>';}).join('')+'</select>'; }
  function section(t,html){ return '<div class="kdw-mini"><div class="kdw-section-title">'+t+'</div>'+html+'</div>'; }
  function chipsHtml(items,group,multi){ return '<div class="kdw-chips">'+items.map(function(i){return chip(group,i[0],i[1],multi);}).join('')+'</div>'; }

  function renderStepHtml(state){
    var idx = (typeof state.current==='number' && state.current>=0 && state.current<steps.length) ? state.current : 0;
    var k = steps[idx].key;
    if(k==='body') return ''+
      section('Dados obrigatórios','<div class="kdw-grid2"><div>'+select('Sexo','sex',[['masculino','Masculino'],['feminino','Feminino']])+'</div><div>'+field('Idade','age','number','30')+'</div><div>'+field('Peso atual (kg)','weight_kg','number','75')+'</div><div>'+field('Altura (cm)','height_cm','number','175')+'</div></div>')+
      section('BCM / composição manual','<div class="kdw-grid2"><div>'+field('% gordura / BCM','body_fat_percent','number','18')+'</div><div>'+field('Massa magra kg','lean_mass_kg','number','60')+'</div><div>'+field('Massa muscular kg','muscle_mass_kg','number','35')+'</div><div>'+field('Água corporal %','water_percent','number','55')+'</div></div>')+
      section('Medidas corporais opcionais','<div class="kdw-grid2"><div>'+field('Cintura cm','waist_cm','number','85')+'</div><div>'+field('Abdômen cm','abdomen_cm','number','90')+'</div><div>'+field('Quadril cm','hip_cm','number','100')+'</div><div>'+field('Pescoço cm','neck_cm','number','38')+'</div></div>');

    if(k==='goal') return ''+
      section('Objetivo principal', chipsHtml([['emagrecimento','Emagrecimento'],['hipertrofia','Hipertrofia'],['recomposicao','Recomposição corporal'],['performance','Performance'],['saude','Saúde/metabólico']], 'objective', false))+
      section('Estratégia', chipsHtml([['agressiva','Mais rápida'],['moderada','Equilibrada'],['conservadora','Conservadora/sustentável']], 'strategy', false))+
      section('Organização diária','<div class="kdw-grid2"><div>'+select('Refeições por dia','meals',[['3','3 refeições'],['4','4 refeições'],['5','5 refeições'],['6','6 refeições']])+'</div><div>'+field('Meta kcal manual','target_kcal','number','Opcional')+'</div><div>'+select('Horário mais difícil','hard_period',[['manha','Manhã'],['tarde','Tarde'],['noite','Noite'],['madrugada','Madrugada']])+'</div><div>'+select('Prioridade','priority',[['saciedade','Saciedade'],['praticidade','Praticidade'],['performance','Performance'],['baixo_custo','Baixo custo']])+'</div></div>');

    if(k==='health') return ''+
      section('Patologias e alertas', chipsHtml([['hipertensao','Hipertensão'],['diabetes','Diabetes'],['renal','Doença renal'],['gastrite','Gastrite/refluxo'],['hepatico','Hepática'],['dislipidemia','Colesterol/triglicerídeos'],['tireoide','Tireoide'],['nenhuma','Nenhuma']], 'pathologies', true))+
      section('Exames e cuidados', textarea('Exames alterados / observações clínicas','clinical_notes','Ex: ferritina baixa, TSH, glicemia, creatinina, potássio, restrição médica...') + textarea('Restrições clínicas','clinical_restrictions','Ex: reduzir sódio, controlar potássio, intolerância, alergia...'))+
      '<button type="button" class="kdw-secondary" data-action="open-labs">Ver meus exames</button>'+
      '<div class="kdw-alert">⚠️ O KroniA usa essas informações para alertas e personalização, mas não substitui avaliação de nutricionista/médico.</div>';

    if(k==='food') return ''+
      section('Padrão alimentar', chipsHtml([['tradicional','Tradicional BR'],['lowcarb','Low carb'],['vegetariano','Vegetariano'],['simples','Simples/barato'],['flexivel','Flexível'],['limpo','Mais limpo/fitness']], 'food_pattern', false))+
      section('Preferências', textarea('Alimentos que gosta','likes','Arroz, feijão, frango, ovos, pão, frutas...') + textarea('Alimentos que evita','dislikes','Peixe, leite, legumes, whey, etc.'))+
      section('Restrições e suplementos', chipsHtml([['lactose','Lactose'],['gluten','Glúten'],['ovo','Ovo'],['amendoim','Amendoim'],['frutos_mar','Frutos do mar'],['nenhuma','Nenhuma']], 'food_restrictions', true) + chipsHtml([['whey','Whey'],['creatina','Creatina'],['cafeina','Cafeína'],['multivitaminico','Multivitamínico'],['nenhum','Nenhum']], 'supplements', true));

    if(k==='training') return ''+
      section('Modalidades', chipsHtml([['musculacao','Musculação'],['cardio','Cardio'],['crossfit','CrossFit'],['corrida','Corrida'],['caminhada','Caminhada'],['luta','Luta/esporte'],['nenhum','Não treino']], 'modalities', true))+
      section('Frequência e intensidade','<div class="kdw-grid2"><div>'+select('Dias/semana','training_days',[['0','0'],['2','2'],['3','3'],['4','4'],['5','5'],['6','6'],['7','7']])+'</div><div>'+select('Duração média','duration_min',[['30','30 min'],['45','45 min'],['60','60 min'],['75','75 min'],['90','90 min'],['120','120 min']])+'</div><div>'+select('Intensidade','intensity',[['leve','Leve'],['moderada','Moderada'],['intensa','Intensa']])+'</div><div>'+select('Rotina fora treino','daily_activity',[['sedentaria','Sedentária'],['leve','Leve'],['ativa','Ativa'],['muito_ativa','Muito ativa']])+'</div></div>')+
      section('Recuperação', chipsHtml([['baixa','Fadiga baixa'],['media','Fadiga média'],['alta','Fadiga alta'],['queda_rendimento','Queda de rendimento']], 'fatigue', true));

    return ''+
      section('Resposta do corpo', chipsHtml([['perde_facil','Perde peso fácil'],['estagnado','Estagna fácil'],['ganha_facil','Ganha peso fácil']], 'weight_response', false) + chipsHtml([['baixa','Pouca fome'],['normal','Fome normal'],['alta','Muita fome'],['compulsao','Compulsão/vontade forte']], 'appetite', false))+
      section('Sono, estresse e adesão','<div class="kdw-grid2"><div>'+select('Sono','sleep',[['ruim','Ruim'],['medio','Médio'],['bom','Bom']])+'</div><div>'+select('Estresse','stress',[['baixo','Baixo'],['medio','Médio'],['alto','Alto']])+'</div><div>'+select('Adesão esperada','adherence',[['baixa','Baixa'],['media','Média'],['alta','Alta']])+'</div><div>'+select('Uso hormonal','hormones',[['nao','Não'],['sim','Sim'],['prefiro_nao','Prefiro não dizer']])+'</div></div>')+
      section('Observação final', textarea('Algo importante para o plano?','final_notes','Ex: trabalho em turnos, pouco tempo, refeições fora de casa, preferência por marmita...'));
  }

  function installStyles(){
    if($('kdwStyles')) return;
    var st=document.createElement('style'); st.id='kdwStyles';
    st.textContent='.kdw-screen,.kdw-screen *{box-sizing:border-box}.kdw-screen{position:fixed;inset:0;z-index:14000;background:#07090f;color:#fff;font-family:Inter,DM Sans,system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}.kdw-head{padding:18px 16px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:#07090f}.kdw-top{display:flex;gap:12px;align-items:center}.kdw-back{width:42px;height:42px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-size:22px}.kdw-badge{font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#22c55e}.kdw-title{font-size:24px;font-weight:950;letter-spacing:-.05em;line-height:1.05}.kdw-sub{font-size:13px;color:rgba(255,255,255,.62);line-height:1.45;margin-top:4px}.kdw-bar{height:4px;background:rgba(255,255,255,.08);border-radius:999px;margin-top:14px;overflow:hidden}.kdw-fill{height:100%;background:linear-gradient(90deg,#16a34a,#22c55e,#a3e635);border-radius:999px;transition:width .25s}.kdw-body{flex:1;overflow:auto;padding:18px 16px 126px;-webkit-overflow-scrolling:touch}.kdw-card{border:1px solid rgba(34,197,94,.20);background:linear-gradient(180deg,rgba(34,197,94,.10),rgba(255,255,255,.035));border-radius:24px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.35)}.kdw-mini{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);border-radius:18px;padding:14px;margin:0 0 12px}.kdw-section-title{font-size:14px;font-weight:900;color:#fff;margin:2px 0 10px}.kdw-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.kdw-label{display:block;font-size:11px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.65);margin:10px 0 6px}.kdw-input,.kdw-textarea{width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.11);background:#101722;color:#fff;padding:0 12px;font-size:16px;outline:none}.kdw-input{height:48px}.kdw-textarea{height:82px;padding:12px;resize:none}.kdw-chips{display:flex;flex-wrap:wrap;gap:9px;margin:10px 0 12px}.kdw-chip{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;border-radius:999px;padding:11px 13px;font-weight:800;font-size:13px}.kdw-chip.active{background:rgba(34,197,94,.18);border-color:rgba(34,197,94,.55);color:#4ade80}.kdw-alert{border:1px solid rgba(250,204,21,.22);background:rgba(250,204,21,.08);color:rgba(255,255,255,.78);padding:12px;border-radius:16px;font-size:13px;line-height:1.45;margin-top:10px}.kdw-foot{position:fixed;left:0;right:0;bottom:0;z-index:14001;padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(7,9,15,0),#07090f 22%,#07090f)}.kdw-next{width:100%;height:56px;border:0;border-radius:18px;background:#22c55e;color:#06110a;font-weight:950;font-size:16px;box-shadow:0 0 28px rgba(34,197,94,.28)}.kdw-secondary{width:100%;height:46px;margin-top:10px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-weight:850;pointer-events:auto;touch-action:manipulation;position:relative;z-index:14002;cursor:pointer}.kdw-result-title{font-size:25px;font-weight:950;letter-spacing:-.05em}.kdw-meal{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);border-radius:18px;padding:14px;margin:12px 0}.kdw-meal-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.kdw-meal-name{font-weight:950;font-size:17px}.kdw-meal-kcal{color:#4ade80;font-weight:950}.kdw-food{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid rgba(255,255,255,.06);font-size:13px}.kdw-macros{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.kdw-macro{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:10px;text-align:center}.kdw-macro strong{display:block;color:#fff;font-size:17px}.kdw-macro span{font-size:11px;color:rgba(255,255,255,.58);font-weight:850;text-transform:uppercase}.kdw-plan-note{border:1px solid rgba(34,197,94,.25);background:rgba(34,197,94,.08);border-radius:16px;padding:12px;color:rgba(255,255,255,.78);font-size:13px;line-height:1.45}.kdw-plan-actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px}@media(max-width:360px){.kdw-grid2,.kdw-macros{grid-template-columns:1fr}.kdw-title{font-size:21px}}';
    document.head.appendChild(st);
  }

  function bindChips(root){ root.querySelectorAll('.kdw-chip').forEach(function(btn){ btn.onclick=function(){ var g=btn.dataset.group; var multi=btn.dataset.multi==='1'; if(!multi) root.querySelectorAll('.kdw-chip[data-group="'+g+'"]').forEach(function(b){b.classList.remove('active');}); btn.classList.toggle('active'); }; }); }

  function collectStep(){
    var data={}, screen=$(SCREEN_ID); if(!screen) return data;
    screen.querySelectorAll('input,select,textarea').forEach(function(el){ data[el.name]= el.type==='number'?num(el.value):el.value; });
    var groups={}; screen.querySelectorAll('.kdw-chip.active').forEach(function(b){ var g=b.dataset.group,v=b.dataset.value; if(b.dataset.multi==='1'){ if(!groups[g]) groups[g]=[]; groups[g].push(v); } else groups[g]=v; });
    Object.keys(groups).forEach(function(k){ data[k]=groups[k]; }); return data;
  }
  function validate(state,data){ var key=steps[state.current].key; if(key==='body'){ if(!data.age||data.age<14)return'Informe uma idade válida.'; if(!data.weight_kg||data.weight_kg<35)return'Informe o peso.'; if(!data.height_cm||data.height_cm<100)return'Informe a altura.'; } if(key==='goal'&&!data.objective)return'Selecione o objetivo.'; return null; }

  function buildPayload(state){
    var d=state.data||{}; return Object.assign({}, d.body||{}, d.goal||{}, d.health||{}, d.food||{}, d.training||{}, d.metabolism||{}, {
      source:'diet_wizard_standalone_v6', dietWizardFlow:state,
      sexo:d.body&&d.body.sex, idade:d.body&&d.body.age, peso:d.body&&d.body.weight_kg, altura:d.body&&d.body.height_cm,
      objetivo:d.goal&&d.goal.objective, objective:d.goal&&d.goal.objective, refeicoesPorDia:d.goal&&d.goal.meals,
      patologias:d.health&&d.health.pathologies, modalidades:d.training&&d.training.modalities
    });
  }

  function calcTargets(payload){
    var weight = Number(payload.weight_kg || payload.peso || 75);
    var height = Number(payload.height_cm || payload.altura || 175);
    var age = Number(payload.age || payload.idade || 30);
    var sex = payload.sex || payload.sexo || 'masculino';
    var objective = payload.objective || payload.objetivo || 'recomposicao';
    var activity = payload.daily_activity || 'leve';
    var trainingDays = Number(payload.training_days || 3);
    var bmr = sex === 'feminino' ? (10*weight + 6.25*height - 5*age - 161) : (10*weight + 6.25*height - 5*age + 5);
    var factor = activity === 'muito_ativa' ? 1.72 : activity === 'ativa' ? 1.55 : activity === 'leve' ? 1.38 : 1.25;
    if(trainingDays >= 5) factor += 0.08;
    var kcal = Number(payload.target_kcal || payload.metaCaloricaManual) || Math.round(bmr * factor);
    if(objective === 'emagrecimento') kcal -= payload.strategy === 'agressiva' ? 550 : payload.strategy === 'conservadora' ? 250 : 400;
    if(objective === 'hipertrofia') kcal += payload.strategy === 'agressiva' ? 450 : payload.strategy === 'conservadora' ? 200 : 300;
    if(objective === 'performance') kcal += 250;
    kcal = Math.max(1300, Math.min(4200, Math.round(kcal/50)*50));
    var protein = Math.round(weight * (objective === 'hipertrofia' || objective === 'recomposicao' ? 2.0 : 1.8));
    var fat = Math.round(weight * (objective === 'emagrecimento' ? 0.75 : 0.85));
    var carbs = Math.max(80, Math.round((kcal - protein*4 - fat*9) / 4));
    return { kcal:kcal, protein:protein, carbs:carbs, fat:fat };
  }

  function foodLine(name, qty, kcal, p, c, f){ return { name:name, qty:qty, kcal:kcal, protein:p, carbs:c, fat:f }; }
  function meal(name, time, items){
    var total = items.reduce(function(a,i){ a.kcal+=i.kcal; a.protein+=i.protein; a.carbs+=i.carbs; a.fat+=i.fat; return a; }, {kcal:0,protein:0,carbs:0,fat:0});
    return { name:name, time:time, items:items, kcal:round(total.kcal), protein:round(total.protein), carbs:round(total.carbs), fat:round(total.fat) };
  }

  function generateLocalPlan(payload, apiJson, apiOk){
    var target = calcTargets(payload);
    var mealsCount = Number(payload.meals || payload.refeicoesPorDia || 5);
    var objective = payload.objective || payload.objetivo || 'recomposicao';
    var pattern = payload.food_pattern || 'tradicional';
    var meals = [];
    var scale = target.kcal / 2100;
    function s(v){ return Math.max(1, round(v * scale)); }
    if(pattern === 'lowcarb'){
      meals = [
        meal('Café da manhã','07:00',[foodLine('Ovos mexidos','3 unidades',s(210),18,2,15),foodLine('Abacate','80 g',s(130),2,7,12),foodLine('Café sem açúcar','1 xícara',0,0,0,0)]),
        meal('Almoço','12:00',[foodLine('Frango grelhado','160 g',s(260),48,0,6),foodLine('Salada grande com azeite','1 prato',s(160),3,8,14),foodLine('Feijão','1 concha pequena',s(90),6,14,1)]),
        meal('Lanche','16:00',[foodLine('Iogurte natural ou whey','1 porção',s(160),24,8,3),foodLine('Castanhas','15 g',s(90),3,3,8)]),
        meal('Jantar','20:00',[foodLine('Carne magra ou peixe','150 g',s(250),38,0,9),foodLine('Legumes cozidos','2 porções',s(120),5,18,3)]),
        meal('Ceia','22:00',[foodLine('Queijo cottage ou ovos','1 porção',s(130),18,3,5)])
      ];
    } else if(pattern === 'vegetariano'){
      meals = [
        meal('Café da manhã','07:00',[foodLine('Aveia','50 g',s(190),7,32,4),foodLine('Banana','1 unidade',s(90),1,23,0),foodLine('Iogurte ou bebida proteica','1 porção',s(140),18,10,3)]),
        meal('Almoço','12:00',[foodLine('Arroz','120 g',s(155),3,34,0),foodLine('Feijão/lentilha','1 concha',s(120),8,20,1),foodLine('Ovos ou tofu','2 ovos ou 150 g',s(180),18,4,10),foodLine('Salada','à vontade',s(45),2,8,1)]),
        meal('Lanche','16:00',[foodLine('Pão integral','2 fatias',s(140),6,24,2),foodLine('Pasta de amendoim','15 g',s(90),4,3,8)]),
        meal('Jantar','20:00',[foodLine('Macarrão integral ou arroz','1 prato moderado',s(260),9,48,3),foodLine('Grão-de-bico/tofu','1 porção',s(180),14,22,5)]),
        meal('Ceia','22:00',[foodLine('Fruta + iogurte','1 porção',s(150),12,22,2)])
      ];
    } else {
      meals = [
        meal('Café da manhã','07:00',[foodLine('Pão integral','2 fatias',s(140),6,24,2),foodLine('Ovos','2 unidades',s(140),12,1,10),foodLine('Fruta','1 unidade',s(80),1,20,0)]),
        meal('Almoço','12:00',[foodLine('Arroz','120 g',s(155),3,34,0),foodLine('Feijão','1 concha',s(110),7,18,1),foodLine('Frango/carne magra','150 g',s(240),42,0,6),foodLine('Salada e legumes','1 prato',s(70),3,12,1)]),
        meal('Lanche da tarde','16:00',[foodLine('Iogurte ou whey','1 porção',s(160),24,10,2),foodLine('Aveia ou fruta','1 porção',s(120),4,24,2)]),
        meal('Jantar','20:00',[foodLine('Batata/arroz/macarrão','1 porção',s(220),5,45,1),foodLine('Proteína magra','140 g',s(220),38,0,6),foodLine('Legumes','1 porção',s(60),3,10,1)]),
        meal('Ceia','22:00',[foodLine('Ovos, cottage ou iogurte','1 porção',s(150),18,6,5)])
      ];
    }
    if(mealsCount <= 3) meals = [meals[0], meals[1], meals[3]];
    if(mealsCount === 4) meals = [meals[0], meals[1], meals[2], meals[3]];
    if(mealsCount >= 6) meals.splice(3,0,meal('Pré/Pós-treino','18:00',[foodLine('Banana ou pão','1 porção',s(120),3,26,1),foodLine('Whey ou ovos','1 porção',s(130),22,3,2)]));
    var totals = meals.reduce(function(a,m){ a.kcal+=m.kcal; a.protein+=m.protein; a.carbs+=m.carbs; a.fat+=m.fat; return a; }, {kcal:0,protein:0,carbs:0,fat:0});
    return {
      success:true,
      type:'visual_diet_plan',
      source: apiOk ? 'api_with_local_visual_normalization' : 'standalone_local_generation',
      apiResponse: apiJson || null,
      title: objective === 'emagrecimento' ? 'Dieta para emagrecimento' : objective === 'hipertrofia' ? 'Dieta para hipertrofia' : objective === 'performance' ? 'Dieta para performance' : 'Dieta personalizada KroniA',
      target: target,
      totals: { kcal:round(totals.kcal), protein:round(totals.protein), carbs:round(totals.carbs), fat:round(totals.fat) },
      meals: meals,
      warnings: buildWarnings(payload),
      generatedAt: new Date().toISOString(),
      requestPayload: payload
    };
  }

  function buildWarnings(payload){
    var warnings=[]; var p=payload.pathologies || payload.patologias || [];
    if(Array.isArray(p) && p.indexOf('renal')>=0) warnings.push('Atenção: doença renal exige ajuste individual de proteína, potássio, fósforo e líquidos com profissional.');
    if(Array.isArray(p) && p.indexOf('diabetes')>=0) warnings.push('Distribuir carboidratos ao longo do dia e monitorar glicemia.');
    if(Array.isArray(p) && p.indexOf('hipertensao')>=0) warnings.push('Priorizar baixo sódio, comida simples e evitar ultraprocessados.');
    if(!warnings.length) warnings.push('Plano inicial gerado automaticamente. Ajuste por evolução, fome, treino e adesão.');
    return warnings;
  }

  function hasRenderablePlan(json){ return !!(json && typeof json==='object' && (Array.isArray(json.meals) || Array.isArray(json.refeicoes) || Array.isArray(json.plan))); }
  function renderLoading(){ var b=$('kdwNext'); if(b){b.disabled=true;b.textContent='Gerando dieta...';} }

  async function submit(state){
    renderLoading(); state.completedAt=new Date().toISOString(); saveState(state);
    var payload=buildPayload(state); var json=null; var ok=false;
    try{
      var res=await fetch('/api/kronia/diet/generate',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});
      json=await res.json().catch(function(){return null;}); ok=!!(res && res.ok);
    }catch(err){ console.warn('[diet-standalone] API indisponível; usando gerador local',err); }
    var plan = hasRenderablePlan(json) ? Object.assign(generateLocalPlan(payload,json,ok), json) : generateLocalPlan(payload,json,ok);
    try{
      localStorage.setItem(LAST_PLAN_KEY,JSON.stringify(plan));
      localStorage.setItem('kronia_diet_wizard_last_payload',JSON.stringify(payload));
      localStorage.removeItem(STATE_KEY);
    }catch(_){}
    clearState();
    window.__kroniaDietGenerationCompleted = true;
    window.__kroniaDietWizardState = null;
    if (window.KroniaUI && typeof window.KroniaUI.unblockScreens === 'function') window.KroniaUI.unblockScreens('diet-generation-success');
    try { if(typeof window.setActiveDietPlan === 'function') window.setActiveDietPlan(toActiveDietPlan(plan), { render:false }); } catch(_) {}
    var screen = $(SCREEN_ID);
    if(screen) screen.remove();
    document.body.classList.remove('diet-wizard-active','kdw-active','nutrition-flow-active','overlay-open');
    var rendered = false;
    try {
      if(typeof window.renderDietFromPlan === 'function') rendered = window.renderDietFromPlan(plan) !== false;
      else if(typeof window.openLastGeneratedDiet === 'function') rendered = window.openLastGeneratedDiet() !== false;
      else console.warn('[diet] renderer indisponível após geração');
    } catch(err) {
      console.error('[diet-standalone] falha ao renderizar dieta gerada', err);
      rendered = false;
    }
    if(!rendered) renderResult(plan);
    toast('Dieta gerada e salva com sucesso.','success');
  }

  function renderMeal(m){
    return '<div class="kdw-meal"><div class="kdw-meal-top"><div><div class="kdw-meal-name">'+esc(m.name)+'</div><div class="kdw-sub">'+esc(m.time||'')+' · P '+round(m.protein)+'g · C '+round(m.carbs)+'g · G '+round(m.fat)+'g</div></div><div class="kdw-meal-kcal">'+round(m.kcal)+' kcal</div></div>'+
      (m.items||[]).map(function(i){ return '<div class="kdw-food"><span>'+esc(i.name)+' <span style="color:rgba(255,255,255,.48)">· '+esc(i.qty)+'</span></span><strong>'+round(i.kcal)+' kcal</strong></div>'; }).join('')+'</div>';
  }

  function renderResult(plan){
    installStyles(); var old=$(SCREEN_ID); if(old) old.remove();
    var screen=document.createElement('div'); screen.id=SCREEN_ID; screen.className='kdw-screen';
    var meals = Array.isArray(plan.meals) ? plan.meals : [];
    var warnings = Array.isArray(plan.warnings) ? plan.warnings : [];
    screen.innerHTML='<div class="kdw-head"><div class="kdw-top"><button class="kdw-back" id="kdwCloseTop">×</button><div style="flex:1"><div class="kdw-badge">Dieta gerada</div><div class="kdw-title">'+esc(plan.title||'Plano alimentar pronto')+'</div><div class="kdw-sub">Plano visual criado e salvo. Fonte: '+esc(plan.source||'local')+'</div></div></div></div><div class="kdw-body"><div class="kdw-card"><div class="kdw-result-title">Plano alimentar pronto</div><p class="kdw-sub">Meta diária aproximada: '+round(plan.target && plan.target.kcal)+' kcal. Total montado: '+round(plan.totals && plan.totals.kcal)+' kcal.</p><div class="kdw-macros"><div class="kdw-macro"><strong>'+round(plan.totals && plan.totals.protein)+'g</strong><span>Proteína</span></div><div class="kdw-macro"><strong>'+round(plan.totals && plan.totals.carbs)+'g</strong><span>Carbo</span></div><div class="kdw-macro"><strong>'+round(plan.totals && plan.totals.fat)+'g</strong><span>Gordura</span></div></div>'+meals.map(renderMeal).join('')+'<div class="kdw-plan-note">'+warnings.map(esc).join('<br><br>')+'</div></div></div><div class="kdw-foot"><button class="kdw-next" id="kdwGoDiet">Abrir plano salvo</button></div>';
    document.body.appendChild(screen); document.body.classList.add('diet-wizard-active');
    function go(){
      try{ localStorage.setItem(LAST_PLAN_KEY,JSON.stringify(plan)); }catch(_){}
      if(typeof window.renderDietFromPlan === 'function' && window.renderDietFromPlan(plan) !== false) return;
      if(typeof window.openLastGeneratedDiet === 'function' && window.openLastGeneratedDiet() !== false) return;
      closeDietProfileWizard(); if(typeof window.navTo==='function') window.navTo('dieta'); toast('Plano salvo.','success');
    }
    $('kdwCloseTop').onclick=closeDietProfileWizard;
    $('kdwGoDiet').onclick=go;
  }

  function render(state){
    state=sanitizeState(state,state.userId); installStyles(); var old=$(SCREEN_ID); if(old) old.remove();
    window.__kroniaDietGenerationCompleted = false;
    window.__kroniaDietWizardState = state;
    var idx=state.current, s=steps[idx], percent=Math.round(((idx+1)/steps.length)*100);
    var screen=document.createElement('div'); screen.id=SCREEN_ID; screen.className='kdw-screen';
    screen.innerHTML='<div class="kdw-head"><div class="kdw-top"><button class="kdw-back" id="kdwBack">‹</button><div style="min-width:0;flex:1"><div class="kdw-badge">'+esc(s.badge)+'</div><div class="kdw-title">'+esc(s.title)+'</div><div class="kdw-sub">'+esc(s.sub)+'</div></div></div><div class="kdw-bar"><div class="kdw-fill" style="width:'+percent+'%"></div></div></div><div class="kdw-body"><div class="kdw-card">'+renderStepHtml(state)+'</div></div><div class="kdw-foot"><button class="kdw-next" id="kdwNext">'+(idx===steps.length-1?'Gerar dieta premium':'Continuar')+'</button><button class="kdw-secondary" id="kdwClose">Fechar</button></div>';
    document.body.appendChild(screen); document.body.classList.add('diet-wizard-active'); bindChips(screen);
    $('kdwBack').onclick=function(){ if(state.current>0){ state.current-=1; saveState(state); render(state); } else closeDietProfileWizard(); };
    $('kdwClose').onclick=closeDietProfileWizard;
    $('kdwNext').onclick=function(){ var data=collectStep(); var err=validate(state,data); if(err){toast(err,'warning');return;} state.data[steps[state.current].key]=data; if(state.current<steps.length-1){state.current+=1;saveState(state);render(state);return;} submit(state); };
  }

  function openDietProfileWizard(userId,opts){ window.__kroniaDietGenerationCompleted = false; if(window.KroniaUI && typeof window.KroniaUI.unblockScreens === 'function') window.KroniaUI.unblockScreens('before-open-diet-profile-wizard'); if(typeof window.KroniaDiet?.hideLegacyScreens === 'function') window.KroniaDiet.hideLegacyScreens(); if(typeof window.closeAllDietGenerationLayers === 'function') window.closeAllDietGenerationLayers(); var state=readState(userId,opts&&opts.forceNew); render(state); return true; }
  function closeDietProfileWizard(){ var screen=$(SCREEN_ID); if(screen) screen.remove(); document.body.classList.remove('diet-wizard-active','kdw-active'); if(window.KroniaUI && typeof window.KroniaUI.unblockScreens === 'function') window.KroniaUI.unblockScreens('after-close-diet-profile-wizard'); }
  document.addEventListener('click', function(e) {
    var target = e.target;
    var btn = target && target.closest && target.closest('[data-action="open-labs"]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      var state = window.__kroniaDietWizardState || readState(getUserId(), false);
      saveState(state);
    } catch(err) {
      console.warn('[diet-standalone] falha ao preservar estado antes de abrir exames', err);
    }
    var candidates = [
      'openLabsSheet',
      'openExamsScreen',
      'openLabExams',
      'openCheckupsScreen',
      'openMedicalExamsScreen',
      'openUserExams',
      'openLabsScreen',
      'openLabsUploadScreen'
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var name = candidates[i];
      if (typeof window[name] === 'function') {
        window[name]({ source: 'diet_wizard_health_step', returnTo: 'diet_wizard' });
        return;
      }
    }
    toast('Nenhum módulo de exames encontrado ainda. Seus exames carregados serão considerados quando disponíveis.', 'info');
  }, true);
  window.openDietProfileWizard=openDietProfileWizard; window.closeDietProfileWizard=closeDietProfileWizard; window.__kroniaDietWizardStandaloneLoaded=true;
})();
