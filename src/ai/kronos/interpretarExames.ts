interface Biomarcador {
  nome?: string;
  name?: string;
  status?: string;
  flag?: string;
  valor?: number | null;
  unidade?: string | null;
  referencia?: string | null;
}

interface ExamesInput {
  disponivel?: boolean;
  dataUltimaColeta?: string | null;
  biomarcadores?: Biomarcador[];
  observacoes?: string[];
}

interface ContextoClinico {
  patologias?: string[];
}

interface AlertaBiomarcador {
  biomarcador: string;
  valor: number | null;
  unidade: string | null;
  referencia: string | null;
  status: string;
  alerta: string;
}

interface ImpactoClinico {
  biomarcador: string;
  status: string;
  impactoClinico: string;
}

export interface ExamesInterpretados {
  disponivel: boolean;
  dataUltimaColeta: string | null;
  alertas: AlertaBiomarcador[];
  impactoClinicoPorBiomarcador: ImpactoClinico[];
  resumoClinico: {
    possuiExames: boolean;
    totalBiomarcadoresDisponiveis: number;
    totalAlteracoes: number;
    patologiasConsideradas: string[];
    observacoes: string[];
  };
}

function normalizeStatus(status: unknown): string {
  const value = String(status || '').toLowerCase();
  if (value === 'alto' || value === 'high') return 'alto';
  if (value === 'baixo' || value === 'low') return 'baixo';
  if (value === 'normal') return 'normal';
  return 'indeterminado';
}

function markerImpact(marker: Biomarcador, patologias: string[]): string {
  const name = String(marker.nome ?? marker.name ?? '').toLowerCase();
  const status = normalizeStatus(marker.status ?? marker.flag);
  const base = status === 'alto' ? 'acima da referência' : (status === 'baixo' ? 'abaixo da referência' : 'sem alteração objetiva');
  const pathologyText = patologias.length
    ? ` Deve ser ponderado junto da patologia registrada: ${patologias.join(', ')}.`
    : '';

  if (/glicose|insulina|hba1c|hemoglobina glicada/.test(name)) {
    return `Impacta controle glicêmico, distribuição de carboidratos e intensidade do treino.${pathologyText}`;
  }
  if (/ldl|hdl|colesterol|triglicer/.test(name)) {
    return `Impacta escolha de gorduras, fibras, estratégia calórica e risco cardiometabólico.${pathologyText}`;
  }
  if (/creatinina|ureia|egfr|filtracao|renal/.test(name)) {
    return `Exige cautela com hidratação, proteína total e carga de treino até contextualização clínica.${pathologyText}`;
  }
  if (/tsh|t3|t4|tireo/.test(name)) {
    return `Pode afetar gasto energético, fadiga, recuperação e resposta ao déficit ou superávit calórico.${pathologyText}`;
  }
  if (/ferritina|ferro|hemoglobina|hematocrito/.test(name)) {
    return `Pode afetar tolerância ao treino, oxigenação, fadiga e necessidade de ajuste de recuperação.${pathologyText}`;
  }
  if (/testosterona|estradiol|lh|fsh|prolactina/.test(name)) {
    return `Pode afetar recuperação, composição corporal, libido, fadiga e tolerância a volume.${pathologyText}`;
  }
  if (/vitamina d|25.?oh/.test(name)) {
    return `Pode se relacionar a saúde óssea, função muscular e recuperação.${pathologyText}`;
  }
  if (/alt|ast|tgo|tgp|gama|ggt|hepatic/.test(name)) {
    return `Exige cautela com álcool, suplementos, medicamentos e carga sistêmica do treino.${pathologyText}`;
  }

  return `Biomarcador ${base}; usar como restrição de segurança e ajuste fino de treino/dieta.${pathologyText}`;
}

export function interpretarExames(
  exames: ExamesInput | null | undefined,
  contextoClinico: ContextoClinico | null | undefined
): ExamesInterpretados {
  const labs = exames && typeof exames === 'object' ? exames : {};
  const clinical = contextoClinico && typeof contextoClinico === 'object' ? contextoClinico : {};
  const patologias: string[] = Array.isArray(clinical.patologias) ? clinical.patologias : [];
  const biomarcadores: Biomarcador[] = Array.isArray(labs.biomarcadores) ? labs.biomarcadores : [];

  const alterados = biomarcadores.filter((marker) => {
    const status = normalizeStatus(marker?.status);
    return marker?.nome && (status === 'alto' || status === 'baixo');
  });

  const alertas: AlertaBiomarcador[] = alterados.map((marker) => ({
    biomarcador: marker.nome ?? '',
    valor: marker.valor ?? null,
    unidade: marker.unidade ?? null,
    referencia: marker.referencia ?? null,
    status: normalizeStatus(marker.status),
    alerta:
      `${marker.nome} ${normalizeStatus(marker.status)}` +
      (marker.valor != null ? ` (${marker.valor}${marker.unidade ? ` ${marker.unidade}` : ''})` : ''),
  }));

  const impactoClinicoPorBiomarcador: ImpactoClinico[] = alterados.map((marker) => ({
    biomarcador: marker.nome ?? '',
    status: normalizeStatus(marker.status),
    impactoClinico: markerImpact(marker, patologias),
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
      observacoes: Array.isArray(labs.observacoes) ? labs.observacoes.slice(0, 6) : [],
    },
  };
}
