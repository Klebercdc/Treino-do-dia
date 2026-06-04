/* KRONIA Labs Bridge Stable */
(function(){
'use strict';
var MODAL='labsCtaModal';
var STATE='labsCtaState';
var REPORTS='/api/kronia/labs/reports?limit=5';

function log(){try{console.info.apply(console,['[LabsBridge]'].concat([].slice.call(arguments)));}catch(_){}}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function state(html){var e=document.getElementById(STATE);if(e)e.innerHTML=html;}
function modal(){
 var m=document.getElementById(MODAL);
 if(m)return m;
 m=document.createElement('div');
 m.id=MODAL;
 m.style.cssText='display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.82);align-items:flex-end;justify-content:center';
 m.innerHTML='<div style="width:100%;max-width:520px;background:#07110d;color:white;border-radius:28px 28px 0 0;padding:20px"><div style="display:flex;justify-content:space-between"><div><div style="color:#34d399;font-weight:900">KRONOS IA</div><div style="font-size:22px;font-weight:900">Exames</div></div><button data-close style="background:none;border:none;color:white;font-size:28px">×</button></div><div id="labsCtaState" style="margin-top:16px;padding:16px;border-radius:16px;background:rgba(255,255,255,.05)">Carregando...</div><button data-refresh style="width:100%;margin-top:12px;padding:14px;border-radius:14px">Recarregar</button><button data-upload style="width:100%;margin-top:10px;padding:14px;border-radius:14px">Enviar exame</button></div>';
 document.body.appendChild(m);
 m.addEventListener('click',function(ev){
 if(ev.target===m||ev.target.closest('[data-close]'))close();
 if(ev.target.closest('[data-refresh]'))load();
 if(ev.target.closest('[data-upload]'))state('<div style="font-weight:900;color:#fde68a">Upload indisponível.</div><div>Backend de exames não encontrado ou não inicializado.</div>');
 });
 return m;
}
function open(){var m=modal();m.style.display='flex';document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';}
function close(){var m=document.getElementById(MODAL);if(m)m.style.display='none';document.body.style.overflow='';document.documentElement.style.overflow='';}
async function headers(){
 var h={Accept:'application/json'};
 try{if(typeof window.getAuthHeaders==='function')Object.assign(h,await window.getAuthHeaders());}
 catch(_){}
 try{
 if(!h.Authorization&&window._sb&&window._sb.auth){
 var s=await window._sb.auth.getSession();
 var t=s&&s.data&&s.data.session&&s.data.session.access_token;
 if(t)h.Authorization='Bearer '+t;
 }
 }catch(_){}
 return h;
}
async function load(){
 state('Carregando indicadores...');
 try{
 var resp=await (typeof window.apiFetch==='function'?window.apiFetch(REPORTS,{credentials:'include',headers:await headers()}):fetch(REPORTS,{credentials:'include',headers:await headers()}));
 if(!resp.ok)throw new Error('HTTP '+resp.status);
 var data=await resp.json().catch(function(){return {};});
 var reports=Array.isArray(data.reports)?data.reports:(Array.isArray(data.data)?data.data:[]);
 if(!reports.length){state('<b>Nenhum exame encontrado.</b><div style="opacity:.7">Se estiver usando GitHub Pages, confirme backend/API.</div>');return [];}
 state(reports.slice(0,5).map(function(r){return '<div style="padding:10px;border:1px solid rgba(255,255,255,.1);margin-top:8px;border-radius:12px"><b>'+esc(r.fileName||r.name||'Exame')+'</b></div>';}).join(''));
 return reports;
 }catch(e){
 state('<div style="font-weight:900;color:#fecaca">Não foi possível carregar exames.</div><div style="margin-top:6px">'+esc(e.message||'Falha')+'</div><div style="margin-top:8px;opacity:.7">GitHub Pages exige backend externo para esta funcionalidade.</div>');
 return [];
 }
}
async function openLabsUploadScreen(source){log('open',source||'unknown');open();await load();}
openLabsUploadScreen.__kroniaLabsMainBridge=true;
window.openLabsUploadScreen=openLabsUploadScreen;
window.loadLabIndicators=load;
try{window.dispatchEvent(new CustomEvent('kronia:labs:bridge-ready'));}catch(_){}
document.addEventListener('DOMContentLoaded',function(){modal();});
})();