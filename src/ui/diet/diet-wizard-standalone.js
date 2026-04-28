/* KroniA Diet Wizard Standalone — 6 etapas ricas, sem voltar para fluxo antigo */
(function () {
  var SCREEN_ID = 'dietProfileWizardScreen';
  var STATE_KEY = 'kronia_diet_wizard_state_v5_standalone';
  var LAST_PLAN_KEY = 'kronia_last_generated_diet';
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
  function toast(msg,type){ if(typeof window.showToast==='function') window.showToast(msg,type||'info',3500); else alert(msg); }

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
  function saveState(s){ try{ localStorage.setItem(STATE_KEY,JSON.stringify(s)); }catch(_){} }
  function clearState(){ try{ localStorage.removeItem(STATE_KEY); }catch(_){} }

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
    st.textContent='.kdw-screen,.kdw-screen *{box-sizing:border-box}.kdw-screen{position:fixed;inset:0;z-index:14000;background:#07090f;color:#fff;font-family:Inter,DM Sans,system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}.kdw-head{padding:18px 16px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:#07090f}.kdw-top{display:flex;gap:12px;align-items:center}.kdw-back{width:42px;height:42px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-size:22px}.kdw-badge{font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#22c55e}.kdw-title{font-size:24px;font-weight:950;letter-spacing:-.05em;line-height:1.05}.kdw-sub{font-size:13px;color:rgba(255,255,255,.62);line-height:1.45;margin-top:4px}.kdw-bar{height:4px;background:rgba(255,255,255,.08);border-radius:999px;margin-top:14px;overflow:hidden}.kdw-fill{height:100%;background:linear-gradient(90deg,#16a34a,#22c55e,#a3e635);border-radius:999px;transition:width .25s}.kdw-body{flex:1;overflow:auto;padding:18px 16px 126px;-webkit-overflow-scrolling:touch}.kdw-card{border:1px solid rgba(34,197,94,.20);background:linear-gradient(180deg,rgba(34,197,94,.10),rgba(255,255,255,.035));border-radius:24px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.35)}.kdw-mini{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);border-radius:18px;padding:14px;margin:0 0 12px}.kdw-section-title{font-size:14px;font-weight:900;color:#fff;margin:2px 0 10px}.kdw-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.kdw-label{display:block;font-size:11px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.65);margin:10px 0 6px}.kdw-input,.kdw-textarea{width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.11);background:#101722;color:#fff;padding:0 12px;font-size:16px;outline:none}.kdw-input{height:48px}.kdw-textarea{height:82px;padding:12px;resize:none}.kdw-chips{display:flex;flex-wrap:wrap;gap:9px;margin:10px 0 12px}.kdw-chip{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;border-radius:999px;padding:11px 13px;font-weight:800;font-size:13px}.kdw-chip.active{background:rgba(34,197,94,.18);border-color:rgba(34,197,94,.55);color:#4ade80}.kdw-alert{border:1px solid rgba(250,204,21,.22);background:rgba(250,204,21,.08);color:rgba(255,255,255,.78);padding:12px;border-radius:16px;font-size:13px;line-height:1.45}.kdw-foot{position:fixed;left:0;right:0;bottom:0;z-index:14001;padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(7,9,15,0),#07090f 22%,#07090f)}.kdw-next{width:100%;height:56px;border:0;border-radius:18px;background:#22c55e;color:#06110a;font-weight:950;font-size:16px;box-shadow:0 0 28px rgba(34,197,94,.28)}.kdw-secondary{width:100%;height:46px;margin-top:10px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-weight:850}.kdw-result-title{font-size:25px;font-weight:950;letter-spacing:-.05em}.kdw-result-box{white-space:pre-wrap;color:rgba(255,255,255,.76);font-size:13px;line-height:1.5}@media(max-width:360px){.kdw-grid2{grid-template-columns:1fr}.kdw-title{font-size:21px}}';
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
      source:'diet_wizard_standalone_v5', dietWizardFlow:state,
      sexo:d.body&&d.body.sex, idade:d.body&&d.body.age, peso:d.body&&d.body.weight_kg, altura:d.body&&d.body.height_cm,
      objetivo:d.goal&&d.goal.objective, objective:d.goal&&d.goal.objective, refeicoesPorDia:d.goal&&d.goal.meals,
      patologias:d.health&&d.health.pathologies, modalidades:d.training&&d.training.modalities
    });
  }

  function renderLoading(){ var b=$('kdwNext'); if(b){b.disabled=true;b.textContent='Gerando dieta...';} }
  function normalizePlan(json,payload){ return json && typeof json==='object' ? json : { success:true, fallback:true, message:'Plano salvo para geração.', payload:payload }; }
  async function submit(state){
    renderLoading(); state.completedAt=new Date().toISOString(); saveState(state);
    var payload=buildPayload(state); var json=null; var ok=false;
    try{
      var res=await fetch('/api/kronia/diet/generate',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});
      json=await res.json().catch(function(){return null;}); ok=res.ok;
    }catch(err){ console.error('[diet-standalone] generate failed',err); }
    var plan=normalizePlan(json,payload); plan.generatedAt=new Date().toISOString(); plan.requestPayload=payload;
    try{ localStorage.setItem(LAST_PLAN_KEY,JSON.stringify(plan)); localStorage.setItem('kronia_diet_wizard_last_payload',JSON.stringify(payload)); }catch(_){}
    clearState(); renderResult(plan, ok);
  }

  function renderResult(plan, ok){
    installStyles(); var old=$(SCREEN_ID); if(old) old.remove();
    var screen=document.createElement('div'); screen.id=SCREEN_ID; screen.className='kdw-screen';
    var raw=''; try{ raw=JSON.stringify(plan,null,2).slice(0,1200); }catch(_){ raw=String(plan||''); }
    screen.innerHTML='<div class="kdw-head"><div class="kdw-top"><button class="kdw-back" id="kdwCloseTop">×</button><div style="flex:1"><div class="kdw-badge">Dieta gerada</div><div class="kdw-title">Plano alimentar pronto</div><div class="kdw-sub">O fluxo terminou sem voltar para o início.</div></div></div></div><div class="kdw-body"><div class="kdw-card"><div class="kdw-result-title">'+(ok?'✅ Dieta enviada para geração':'⚠️ Plano salvo localmente')+'</div><p class="kdw-sub">Salvei o resultado no app. Se a API ainda não devolver layout visual, o payload fica preservado para renderização.</p><div class="kdw-mini"><div class="kdw-section-title">Resumo técnico</div><div class="kdw-result-box">'+esc(raw)+'</div></div></div></div><div class="kdw-foot"><button class="kdw-next" id="kdwGoDiet">Ver dieta</button><button class="kdw-secondary" id="kdwNewDiet">Criar outra dieta</button></div>';
    document.body.appendChild(screen); document.body.classList.add('diet-wizard-active');
    $('kdwCloseTop').onclick=closeDietProfileWizard;
    $('kdwGoDiet').onclick=function(){ closeDietProfileWizard(); if(typeof window.navTo==='function') window.navTo('dieta'); if(typeof window.renderDietFromPlan==='function') window.renderDietFromPlan(plan); };
    $('kdwNewDiet').onclick=function(){ openDietProfileWizard(null,{forceNew:true}); };
  }

  function render(state){
    state=sanitizeState(state,state.userId); installStyles(); var old=$(SCREEN_ID); if(old) old.remove();
    var idx=state.current, s=steps[idx], percent=Math.round(((idx+1)/steps.length)*100);
    var screen=document.createElement('div'); screen.id=SCREEN_ID; screen.className='kdw-screen';
    screen.innerHTML='<div class="kdw-head"><div class="kdw-top"><button class="kdw-back" id="kdwBack">‹</button><div style="min-width:0;flex:1"><div class="kdw-badge">'+esc(s.badge)+'</div><div class="kdw-title">'+esc(s.title)+'</div><div class="kdw-sub">'+esc(s.sub)+'</div></div></div><div class="kdw-bar"><div class="kdw-fill" style="width:'+percent+'%"></div></div></div><div class="kdw-body"><div class="kdw-card">'+renderStepHtml(state)+'</div></div><div class="kdw-foot"><button class="kdw-next" id="kdwNext">'+(idx===steps.length-1?'Gerar dieta premium':'Continuar')+'</button><button class="kdw-secondary" id="kdwClose">Fechar</button></div>';
    document.body.appendChild(screen); document.body.classList.add('diet-wizard-active'); bindChips(screen);
    $('kdwBack').onclick=function(){ if(state.current>0){ state.current-=1; saveState(state); render(state); } else closeDietProfileWizard(); };
    $('kdwClose').onclick=closeDietProfileWizard;
    $('kdwNext').onclick=function(){ var data=collectStep(); var err=validate(state,data); if(err){toast(err,'warning');return;} state.data[steps[state.current].key]=data; if(state.current<steps.length-1){state.current+=1;saveState(state);render(state);return;} submit(state); };
  }

  function openDietProfileWizard(userId,opts){ var state=readState(userId,opts&&opts.forceNew); render(state); return true; }
  function closeDietProfileWizard(){ var screen=$(SCREEN_ID); if(screen) screen.remove(); document.body.classList.remove('diet-wizard-active'); }
  window.openDietProfileWizard=openDietProfileWizard; window.closeDietProfileWizard=closeDietProfileWizard; window.__kroniaDietWizardStandaloneLoaded=true;
})();
