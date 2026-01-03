const map={1:"A",2:"OFF",3:"B",4:"OFF",5:"C",6:"OFF",0:"OFF"};
const workouts={
A:{t:"SEGUNDA (A)",o:"Força geral",i:[
["Agachamento Livre","4","8-10","90s"],
["Supino Inclinado","4","8-10","90s"],
["Desenv. Militar","3","10-12","60s"],
["Fundos/Tríceps","3","Falha","60s"],
["Cadeira Extensora","3","15","45s"],
["Abdominal Infra","4","15-20","45s"]
]},
B:{t:"QUARTA (B)",o:"Posterior + costas",i:[
["Terra/Stiff","4","6-8","90s"],
["Remada Curvada","4","8-10","90s"],
["Puxada Alta","3","10-12","60s"],
["Face Pull","3","15","45s"],
["Rosca Direta","3","10-12","60s"],
["Prancha Abd.","4","Falha","45s"]
]},
C:{t:"SEXTA (C)",o:"Circuito/volume",i:[
["Leg Press","3","12","0s"],
["Flexão Braço","3","Máx","60s"],
["Passada","3","12","0s"],
["Elev. Lateral","3","15","60s"],
["Remada Máq.","3","12","0s"],
["Tríceps Corda","3","15","60s"]
]},
OFF:{t:"DESCANSO",o:"Recuperação",i:[]}
};
const d=new Date(),w=map[d.getDay()],W=workouts[w];
document.getElementById("pillDay").innerText=W.t;
document.getElementById("workoutTitle").innerText=W.t;
document.getElementById("workoutObjective").innerText=W.o;
document.getElementById("todayLabel").innerText=d.toLocaleDateString("pt-BR");
const list=document.getElementById("exerciseList");
W.i.forEach(x=>{
  const div=document.createElement("div");
  div.className="card";
  div.innerHTML=`<b>${x[0]}</b><div>${x[1]}x ${x[2]} — desc ${x[3]}</div>`;
  list.appendChild(div);
});
