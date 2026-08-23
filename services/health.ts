/**
 * Metas de saúde.
 *
 * Tudo aqui é estimativa de população, aplicada a uma pessoa. Serve para dar um
 * ponto de partida e uma direção — não para substituir avaliação profissional, e
 * a tela diz isso.
 *
 * As fórmulas e faixas:
 *
 * - **IMC** = peso ÷ altura². Faixas da OMS: abaixo de 18,5; 18,5–24,9 adequado;
 *   25–29,9 sobrepeso; 30 ou mais obesidade. O IMC não distingue músculo de
 *   gordura — quem treina há tempo costuma cair na faixa de cima sem que isso
 *   signifique excesso, e o texto na tela avisa.
 * - **Peso de referência** é o intervalo que corresponde a IMC 18,5 a 24,9 para
 *   a altura informada. Não existe "um" peso ideal: existe uma faixa.
 * - **Gasto energético** pela equação de Mifflin‑St Jeor (1990), que é a de
 *   melhor acerto entre as preditivas sem medir composição corporal:
 *   homens 10·kg + 6,25·cm − 5·idade + 5; mulheres, o mesmo com −161.
 * - **Fator de atividade** multiplica a taxa basal. Aqui ele não é perguntado:
 *   sai da frequência real de treino registrada no app.
 * - **Déficit e superávit.** Perder gordura preservando músculo pede um déficit
 *   moderado, na faixa de 15% a 20% do gasto — cerca de 0,5% do peso corporal
 *   por semana. Cortes agressivos custam massa magra. Ganhar massa pede um
 *   superávit pequeno, ~10%.
 * - **Proteína.** 1,6 g/kg por dia é o ponto onde o ganho de massa magra
 *   estabiliza em quem treina (Morton et al., 2018); em déficit calórico sobe
 *   para 2,0–2,2 g/kg, porque a proteína também protege o músculo enquanto se
 *   perde peso.
 * - **Água.** ~35 ml por quilo por dia como base, mais ~500 ml por hora de
 *   treino para repor o suor. Clima quente aumenta; a tela não tenta adivinhar.
 */

export type Sexo = 'feminino' | 'masculino' | 'nao_informado';

export type ObjetivoMeta = 'perder' | 'manter' | 'ganhar';

export type FaixaImc = 'abaixo' | 'adequado' | 'sobrepeso' | 'obesidade';

export type PerfilSaude = {
  pesoKg: number | null;
  alturaCm: number | null;
  idade: number | null;
  sexo: Sexo;
  objetivo: ObjetivoMeta;
  /** dias de treino por semana, medidos no histórico */
  diasDeTreinoPorSemana: number;
  /** minutos treinados hoje, para o acréscimo de água */
  minutosDeTreinoHoje: number;
};

export type Metas = {
  imc: number | null;
  faixa: FaixaImc | null;
  /** onde o IMC cai dentro da régua, de 0 a 1, para posicionar o marcador */
  posicaoNaRegua: number | null;
  pesoDeReferencia: { min: number; max: number } | null;
  /** quanto falta (negativo) ou sobra (positivo) para entrar na faixa */
  diferencaParaFaixa: number | null;
  taxaBasal: number | null;
  fatorAtividade: number;
  gastoDiario: number | null;
  metaCalorica: number | null;
  /** diferença entre a meta e o gasto: negativo é déficit */
  ajusteCalorico: number | null;
  proteinaGramas: number | null;
  proteinaPorKg: number | null;
  aguaMl: number | null;
  /** true quando o sexo não foi informado e a estimativa é a média das duas equações */
  estimativaGrosseira: boolean;
};

/** Limites da OMS, também usados como bordas da régua na tela. */
export const IMC_LIMITES = { magreza: 18.5, sobrepeso: 25, obesidade: 30 } as const;

/** Extremos desenhados na régua. Fora disso o marcador encosta na ponta. */
const REGUA_MIN = 15;
const REGUA_MAX = 35;

export function imcDe(pesoKg: number, alturaCm: number): number {
  const metros = alturaCm / 100;
  return pesoKg / (metros * metros);
}

export function faixaDoImc(imc: number): FaixaImc {
  if (imc < IMC_LIMITES.magreza) return 'abaixo';
  if (imc < IMC_LIMITES.sobrepeso) return 'adequado';
  if (imc < IMC_LIMITES.obesidade) return 'sobrepeso';
  return 'obesidade';
}

export const ROTULO_DA_FAIXA: Record<FaixaImc, string> = {
  abaixo: 'Abaixo do esperado',
  adequado: 'Na faixa adequada',
  sobrepeso: 'Acima da faixa',
  obesidade: 'Bem acima da faixa',
};

/** Intervalo de peso correspondente a IMC 18,5 a 24,9 para a altura. */
export function pesoDeReferencia(alturaCm: number): { min: number; max: number } {
  const metros = alturaCm / 100;
  return {
    min: IMC_LIMITES.magreza * metros * metros,
    max: (IMC_LIMITES.sobrepeso - 0.1) * metros * metros,
  };
}

/** Mifflin‑St Jeor. Sem sexo informado, a média das duas equações. */
export function taxaMetabolicaBasal(
  pesoKg: number,
  alturaCm: number,
  idade: number,
  sexo: Sexo,
): number {
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * idade;

  if (sexo === 'masculino') return base + 5;
  if (sexo === 'feminino') return base - 161;
  return base + (5 - 161) / 2;
}

/**
 * Fator de atividade a partir da frequência real de treino.
 *
 * As faixas clássicas descrevem a semana inteira, não só o treino; por isso
 * mesmo quem treina zero dia fica em 1,2, e não em 1.
 */
export function fatorDeAtividade(diasPorSemana: number): number {
  if (diasPorSemana >= 6) return 1.725;
  if (diasPorSemana >= 4) return 1.55;
  if (diasPorSemana >= 2) return 1.375;
  if (diasPorSemana > 0) return 1.3;
  return 1.2;
}

/** Ajuste calórico do objetivo, como fração do gasto diário. */
function ajusteDoObjetivo(objetivo: ObjetivoMeta): number {
  if (objetivo === 'perder') return -0.18;
  if (objetivo === 'ganhar') return 0.1;
  return 0;
}

/** Proteína por quilo, mais alta quando se está em déficit. */
export function proteinaPorQuilo(objetivo: ObjetivoMeta): number {
  if (objetivo === 'perder') return 2.0;
  if (objetivo === 'ganhar') return 1.8;
  return 1.6;
}

export function aguaDiariaMl(pesoKg: number, minutosDeTreino: number): number {
  const base = pesoKg * 35;
  const extra = (minutosDeTreino / 60) * 500;
  return Math.round((base + extra) / 50) * 50;
}

/** Idade em anos completos, a partir da data de nascimento e do dia de hoje. */
export function idadeEm(nascimento: string, hoje: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return null;

  const [ano, mes, dia] = nascimento.split('-').map(Number);
  const [anoHoje, mesHoje, diaHoje] = hoje.split('-').map(Number);

  let anos = anoHoje - ano;
  if (mesHoje < mes || (mesHoje === mes && diaHoje < dia)) anos -= 1;

  return anos >= 0 && anos < 130 ? anos : null;
}

/** Traduz o objetivo do perfil para a direção calórica. */
export function objetivoCalorico(goal: string | null): ObjetivoMeta {
  if (goal === 'perder_gordura' || goal === 'melhorar_shape') return 'perder';
  if (goal === 'ganhar_massa' || goal === 'ganhar_forca') return 'ganhar';
  return 'manter';
}

export function calcularMetas(perfil: PerfilSaude): Metas {
  const { pesoKg, alturaCm, idade, sexo, objetivo } = perfil;
  const fatorAtividade = fatorDeAtividade(perfil.diasDeTreinoPorSemana);

  const imc = pesoKg !== null && alturaCm !== null ? imcDe(pesoKg, alturaCm) : null;
  const faixa = imc !== null ? faixaDoImc(imc) : null;

  const referencia = alturaCm !== null ? pesoDeReferencia(alturaCm) : null;

  const diferencaParaFaixa =
    pesoKg !== null && referencia !== null
      ? pesoKg < referencia.min
        ? pesoKg - referencia.min
        : pesoKg > referencia.max
          ? pesoKg - referencia.max
          : 0
      : null;

  const taxaBasal =
    pesoKg !== null && alturaCm !== null && idade !== null
      ? taxaMetabolicaBasal(pesoKg, alturaCm, idade, sexo)
      : null;

  const gastoDiario = taxaBasal !== null ? taxaBasal * fatorAtividade : null;
  const metaCalorica =
    gastoDiario !== null ? gastoDiario * (1 + ajusteDoObjetivo(objetivo)) : null;

  const proteinaPorKg = proteinaPorQuilo(objetivo);

  return {
    imc,
    faixa,
    posicaoNaRegua:
      imc === null
        ? null
        : Math.min(1, Math.max(0, (imc - REGUA_MIN) / (REGUA_MAX - REGUA_MIN))),
    pesoDeReferencia: referencia,
    diferencaParaFaixa,
    taxaBasal: taxaBasal === null ? null : Math.round(taxaBasal),
    fatorAtividade,
    gastoDiario: gastoDiario === null ? null : Math.round(gastoDiario),
    metaCalorica: metaCalorica === null ? null : Math.round(metaCalorica),
    ajusteCalorico:
      metaCalorica === null || gastoDiario === null
        ? null
        : Math.round(metaCalorica - gastoDiario),
    proteinaGramas: pesoKg === null ? null : Math.round(pesoKg * proteinaPorKg),
    proteinaPorKg,
    aguaMl: pesoKg === null ? null : aguaDiariaMl(pesoKg, perfil.minutosDeTreinoHoje),
    estimativaGrosseira: sexo === 'nao_informado',
  };
}

/** Posição de um IMC na régua desenhada, de 0 a 1. Serve para as bordas também. */
export function posicaoNaRegua(imc: number): number {
  return Math.min(1, Math.max(0, (imc - REGUA_MIN) / (REGUA_MAX - REGUA_MIN)));
}
