(function(){
  'use strict';
  var MODAL_ID='labsCtaModal';
  var STATE_ID='labsCtaState';
  var INPUT_ID='labsCtaFileInput';
  var REPORTS=['/api/kronia/labs/reports?limit=5','/api/system?__route=kronia-labs-reports&limit=5'];
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function state(html){var el=document.getElementById(STATE_ID);if(el)el.innerHTML=html;}
  function spin(t){state('<div style="display:flex;gap:10px;align-items:center"><div style="width:16px;height:16px;border:2px solid rgba(255,255,255,.25);border-top-color:#34d399;border-radius:50%;animation:labsSpin .8s linear infinite"></div><div>'+esc(t)+'</div></div><style>@keyframes labsSpin{to{transform:rotate(360deg)}}</style>');}
  function fmtDate(v){if(!v)return '';var d=new Date(v);return isNaN(d.getTime())?String(v).slice(0,10):d.toLocaleDateString('pt-BR');}
  function render(reports){
    if(!reports.length){state('<b style="color:#fff">Nenhum exame encontrado</b><div style="color:rgba(255,255,255,.68);margin-top:6px">A API respondeu, mas não retornou exames para esta sessão.</div>');return;}
    var cards=reports.slice(0,5).map(function(r,i){var b=(Array.isArray(r.biomarkers)?r.biomarkers:[]).map(function(x){return x.name||x.nome||x.marker||x.biomarker;}).filter(Boolean).slice(0,4);return '<div style="padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(0,0,0,.16);'+(i?'margin-top:10px':'')+'"><div style="font-weight:900;color:#fff">'+esc(r.fileName||r.name||('Exame '+(i+1)))+'</div><div style="font-size:.74rem;color:rgba(255,255,255,.55);margin:5px 0 8px">'+esc(fmtDate(r.processedAt||r.createdAt))+'</div>'+(b.length?'<div style="font-size:.8rem;color:#a7f3d0">Biomarcadores: '+esc(b.join(', '))+'</div>':'')+'</div>';}).join('');
    state('<div style="font-weight:900;color:#fff;margin-bottom:10px">Indicadores carregados</div>'+cards);
  }
  async function headers(){
    var h={Accept:'application/json'};
    if(typeof window.getAuthHeaders==='function'){
      try{Object.assign(h,await window.getAuthHeaders());}catch(e){}
    }
    return h;
  }
  async function getReports(){
    spin('Carregando indicadores...');
    var last=null;
    for(var i=0;i<REPORTS.length;i++){
      try{
        var opts={method:'GET',credentials:'include',headers:await headers()};
        var resp=typeof window.apiFetch==='function'?await window.apiFetch(REPORTS[i],opts):await fetch(REPORTS[i],opts);
        var data=await resp.json().catch(function(){return {};});
        if(!resp.ok||data.ok===false)throw new Error(data.message||data.error||('HTTP '+resp.status));
        var reports=Array.isArray(data.reports)?data.reports:(Array.isArray(data.data)?data.data:[]);
        render(reports);
        return reports;
      }catch(e){last=e;}
    }
    state('<b style="color:#fecaca">Não foi possível carregar seus exames agora.</b><div style="color:rgba(255,255,255,.68);margin-top:6px">'+esc(last&&last.message?last.message:'Falha ao consultar histórico.')+'</div><button type="button" onclick="window.loadLabIndicators&&window.loadLabIndicators()" style="margin-top:10px;border:1px solid rgba(248,113,113,.35);background:rgba(248,113,113,.12);color:#fecaca;border-radius:12px;padding:10px 12px;font-weight:800">Tentar novamente</button>');
    return [];
  }
  function ensureModal(){
    var m=document.getElementById(MODAL_ID);if(m)return m;
    m=document.createElement('div');m.id=MODAL_ID;m.style.cssText='display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.78);align-items:flex-end;justify-content:center';
    m.innerHTML='<div style="width:100%;max-width:520px;background:#07110d;border:1px solid rgba(16,185,129,.32);border-radius:28px 28px 0 0;padding:18px 18px calc(22px + env(safe-area-inset-bottom));font-family:Inter,system-ui;color:#fff"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div><div style="font-size:.72rem;font-weight:900;color:#34d399;letter-spacing:.13em">KRONOS IA</div><div style="font-size:1.2rem;font-weight:900">Exames &amp; Indicadores</div></div><button data-labs-close style="width:38px;height:38px;border-radius:14px;background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.12);font-size:22px">×</button></div><div id="'+STATE_ID+'" style="border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.045);border-radius:18px;padding:14px;margin-bottom:14px">Carregando...</div><input id="'+INPUT_ID+'" type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none"><button data-labs-pick-file style="width:100%;min-height:54px;border:none;border-radius:18px;background:linear-gradient(135deg,#10b981,#00d084);font-size:1rem;font-weight:900">Enviar PDF / JPEG / PNG agora</button><button data-labs-refresh style="width:100%;margin-top:10px;min-height:46px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(255,255,255,.055);color:#d1fae5;font-weight:800">Recarregar indicadores</button></div>';
    document.body.appendChild(m);
    m.addEventListener('click',function(ev){if(ev.target===m||ev.target.closest('[data-labs-close]')){m.style.display='none';document.body.style.overflow='';document.documentElement.style.overflow='';}if(ev.target.closest('[data-labs-refresh]'))getReports();if(ev.target.closest('[data-labs-pick-file]')){var input=document.getElementById(INPUT_ID);if(input)input.click();}});
    return m;
  }
  async function open(source){try{if(typeof window.navTo==='function')window.navTo('inicio');}catch(e){}var m=ensureModal();m.style.display='flex';document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';await getReports();}
  window.openLabsUploadScreen=open;
  window.loadLabIndicators=getReports;
  document.addEventListener('DOMContentLoaded',function(){window.openLabsUploadScreen=open;window.loadLabIndicators=getReports;});
})();
