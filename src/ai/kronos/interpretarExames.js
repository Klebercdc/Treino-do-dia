"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var interpretarExames_exports = {};
__export(interpretarExames_exports, {
  interpretarExames: () => interpretarExames
});
module.exports = __toCommonJS(interpretarExames_exports);
function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "alto" || value === "high") return "alto";
  if (value === "baixo" || value === "low") return "baixo";
  if (value === "normal") return "normal";
  return "indeterminado";
}
function markerImpact(marker, patologias) {
  const name = String(marker.nome ?? marker.name ?? "").toLowerCase();
  const status = normalizeStatus(marker.status ?? marker.flag);
  const base = status === "alto" ? "acima da refer\xEAncia" : status === "baixo" ? "abaixo da refer\xEAncia" : "sem altera\xE7\xE3o objetiva";
  const pathologyText = patologias.length ? ` Deve ser ponderado junto da patologia registrada: ${patologias.join(", ")}.` : "";
  if (/glicose|insulina|hba1c|hemoglobina glicada/.test(name)) {
    return `Impacta controle glic\xEAmico, distribui\xE7\xE3o de carboidratos e intensidade do treino.${pathologyText}`;
  }
  if (/ldl|hdl|colesterol|triglicer/.test(name)) {
    return `Impacta escolha de gorduras, fibras, estrat\xE9gia cal\xF3rica e risco cardiometab\xF3lico.${pathologyText}`;
  }
  if (/creatinina|ureia|egfr|filtracao|renal/.test(name)) {
    return `Exige cautela com hidrata\xE7\xE3o, prote\xEDna total e carga de treino at\xE9 contextualiza\xE7\xE3o cl\xEDnica.${pathologyText}`;
  }
  if (/tsh|t3|t4|tireo/.test(name)) {
    return `Pode afetar gasto energ\xE9tico, fadiga, recupera\xE7\xE3o e resposta ao d\xE9ficit ou super\xE1vit cal\xF3rico.${pathologyText}`;
  }
  if (/ferritina|ferro|hemoglobina|hematocrito/.test(name)) {
    return `Pode afetar toler\xE2ncia ao treino, oxigena\xE7\xE3o, fadiga e necessidade de ajuste de recupera\xE7\xE3o.${pathologyText}`;
  }
  if (/testosterona|estradiol|lh|fsh|prolactina/.test(name)) {
    return `Pode afetar recupera\xE7\xE3o, composi\xE7\xE3o corporal, libido, fadiga e toler\xE2ncia a volume.${pathologyText}`;
  }
  if (/vitamina d|25.?oh/.test(name)) {
    return `Pode se relacionar a sa\xFAde \xF3ssea, fun\xE7\xE3o muscular e recupera\xE7\xE3o.${pathologyText}`;
  }
  if (/alt|ast|tgo|tgp|gama|ggt|hepatic/.test(name)) {
    return `Exige cautela com \xE1lcool, suplementos, medicamentos e carga sist\xEAmica do treino.${pathologyText}`;
  }
  return `Biomarcador ${base}; usar como restri\xE7\xE3o de seguran\xE7a e ajuste fino de treino/dieta.${pathologyText}`;
}
function interpretarExames(exames, contextoClinico) {
  const labs = exames && typeof exames === "object" ? exames : {};
  const clinical = contextoClinico && typeof contextoClinico === "object" ? contextoClinico : {};
  const patologias = Array.isArray(clinical.patologias) ? clinical.patologias : [];
  const biomarcadores = Array.isArray(labs.biomarcadores) ? labs.biomarcadores : [];
  const alterados = biomarcadores.filter((marker) => {
    const status = normalizeStatus(marker?.status);
    return marker?.nome && (status === "alto" || status === "baixo");
  });
  const alertas = alterados.map((marker) => ({
    biomarcador: marker.nome ?? "",
    valor: marker.valor ?? null,
    unidade: marker.unidade ?? null,
    referencia: marker.referencia ?? null,
    status: normalizeStatus(marker.status),
    alerta: `${marker.nome} ${normalizeStatus(marker.status)}` + (marker.valor != null ? ` (${marker.valor}${marker.unidade ? ` ${marker.unidade}` : ""})` : "")
  }));
  const impactoClinicoPorBiomarcador = alterados.map((marker) => ({
    biomarcador: marker.nome ?? "",
    status: normalizeStatus(marker.status),
    impactoClinico: markerImpact(marker, patologias)
  }));
  return {
    disponivel: !!labs.disponivel,
    dataUltimaColeta: labs.dataUltimaColeta ?? null,
    alertas,
    impactoClinicoPorBiomarcador,
    resumoClinico: {
      possuiExames: !!labs.disponivel,
      totalBiomarcadoresDisponiveis: biomarcadores.length,
      totalAlteracoes: alterados.length,
      patologiasConsideradas: patologias,
      observacoes: Array.isArray(labs.observacoes) ? labs.observacoes.slice(0, 6) : []
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  interpretarExames
});
