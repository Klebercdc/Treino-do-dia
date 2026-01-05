/* ========= UTIL ========= */
function toNum(x){const n=parseFloat(x);return isNaN(n)?0:n}
function calcRM(kg,reps){return kg && reps ? kg*(1+reps/30):0}
function alvoReps(){
  const o=document.getElementById("obj").value
  if(o==="forca") return 4
  if(o==="definicao") return 17
  return 10
}
function calcKgSug(rm){
  const r=alvoReps()
  return Math.round((rm/(1+r/30))/2.5)*2.5
}

/* ========= TIMER ========= */
let timeLeft=60,baseTime=60,isRunning=false,timerInt=null
function setT(s,b){if(isRunning)return;baseTime=timeLeft=s;updT()}
function updT(){const m=Math.floor(timeLeft/60),s=timeLeft%60;timerDisplay.innerText=`${m}:${s<10?"0":""}${s}`}
function toggleT(){
  const b=ctrlBtn
  if(isRunning){clearInterval(timerInt);isRunning=false;b.innerText="CONTINUAR"}
  else{
    isRunning=true;b.innerText="PAUSAR"
    timerInt=setInterval(()=>{timeLeft?timeLeft--:(clearInterval(timerInt),isRunning=false,timeLeft=baseTime);updT()},1000)
  }
}
function resetT(){clearInterval(timerInt);isRunning=false;timeLeft=baseTime;updT()}

/* ========= TREINO ========= */
const STORAGE={hist:"titan_hist_v3"}
let treino=[]

function gerarProtocolo(){
  nav.innerHTML=""
  container.innerHTML=""
  ["A","B","C"].forEach((t,i)=>{
    nav.innerHTML+=`<div class="pill ${i==0?"active":""}" onclick="tab(${i})">${t}</div>`
    const sec=document.createElement("div")
    sec.className="section"
    if(i==0) sec.classList.add("active")
    sec.dataset.treino=t
    container.appendChild(sec)
    criarCard("Rosca Direta",sec)
  })
}

function criarCard(nome,sec){
  const card=document.createElement("div")
  card.className="exercise-card"
  card.innerHTML=`<strong>${nome}</strong>`
  for(let i=0;i<3;i++){
    card.innerHTML+=`
    <div class="series-grid">
      <div>S${i+1}<div class="rmmini" id="rm-${nome}-${i}"></div></div>
      <div class="input-box"><input oninput="updRM(this,'${nome}',${i})"></div>
      <div class="input-box"><input oninput="updRM(this,'${nome}',${i})"></div>
      <div class="input-box"><input></div>
    </div>`
  }
  sec.appendChild(card)
}

function updRM(inp,nome,i){
  const row=inp.closest(".series-grid")
  const kg=toNum(row.children[1].querySelector("input").value)
  const reps=toNum(row.children[2].querySelector("input").value)
  const rm=Math.round(calcRM(kg,reps))
  document.getElementById(`rm-${nome}-${i}`).innerText=rm?`RM ${rm}`:""
}

/* ========= HISTÓRICO ========= */
function salvarTreino(){
  const state=[...document.querySelectorAll(".exercise-card")].map(c=>{
    const nome=c.querySelector("strong").innerText
    const series=[...c.querySelectorAll(".series-grid")].map(r=>{
      const kg=toNum(r.children[1].querySelector("input").value)
      const reps=toNum(r.children[2].querySelector("input").value)
      const rpe=toNum(r.children[3].querySelector("input").value)
      return {kg,reps,rpe,rm:Math.round(calcRM(kg,reps))}
    })
    return {nome,series}
  })
  const hist=JSON.parse(localStorage.getItem(STORAGE.hist)||"[]")
  hist.unshift({date:new Date(),state})
  localStorage.setItem(STORAGE.hist,JSON.stringify(hist))
  alert("Sessão salva com RM por série")
}

function verHistorico(){
  const hist=JSON.parse(localStorage.getItem(STORAGE.hist)||"[]")
  histList.innerHTML=""
  hist.forEach(h=>{
    const d=document.createElement("div")
    d.innerHTML=`<strong>${new Date(h.date).toLocaleString()}</strong><pre>${JSON.stringify(h.state,null,2)}</pre>`
    histList.appendChild(d)
  })
  modalHIST.showModal()
}

/* ========= INIT ========= */
window.onload=()=>{
  displayDate.innerText=new Date().toLocaleDateString("pt-BR")
  gerarProtocolo()
}