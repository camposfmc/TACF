/* Metas S/B/MB/E/Máx do Anexo IV por perfil. Módulo puro. */
import {
  OIC01, OIC05, OIC02, OIC06_SEM_JOELHO, OIC03, OIC07,
  OIC04_ROWS, OIC08_ROWS, OIC04_MARCHA_ROWS, OIC08_MARCHA_ROWS,
  M_COLS, F_COLS, tabela1Transicao,
} from './nsca-2026-tabelas.js';
import { sec2MMSS, pontosItem, MAXIMOS } from './calculo-tacf.js';
import { LIMITES_ENTRADA } from './limites.js';

/** Pontos mínimos de cada menção (S, B, MB, E, Máx) por pontuação máxima do item. */
export const LIMIARES = { 10: [2, 4, 7, 9, 10], 30: [6, 12, 21, 27, 30], 50: [10, 20, 35, 45, 50] };

const FAIXAS = ['S', 'B', 'MB', 'E', 'MAX'];

/** Menção alcançada por um item isolado, ou null se abaixo do mínimo (S). */
export function faixaItem(pontos, maxPts) {
  const limiares = LIMIARES[maxPts];
  let faixa = null;
  limiares.forEach((lim, i) => { if (pontos >= lim) faixa = FAIXAS[i]; });
  return faixa;
}

// Cada prova tem um sentido (≤ ou ≥), uma unidade e o formato do número; o texto completo
// (desktop) e o curto (celular, só o número) saem do mesmo valor.
const FORMATOS = {
  cm:     { sentido: '≤', unidade: 'cm',  numero: v => v.toFixed(1) },
  rep:    { sentido: '≥', unidade: 'rep', numero: v => String(v) },
  metros: { sentido: '≥', unidade: 'm',   numero: v => String(v) },
  tempo:  { sentido: '≤', unidade: 'min', numero: v => sec2MMSS(v) },
};

function textoCompleto(fmt, curto) {
  if (curto === '-') return '-';
  return `${fmt.sentido} ${curto}` + (fmt.unidade === 'min' ? '' : ` ${fmt.unidade}`);
}

// alvos: valor mínimo (≥) ou máximo (≤) de cada menção, em número; null se inalcançável.
function montarLinha(prova, nomeCurto, fmt, alvos) {
  const linha = { prova, nomeCurto, sentido: fmt.sentido, unidade: fmt.unidade, alvos, curto: {} };
  for (const k of FAIXAS) {
    linha.curto[k] = alvos[k] === null ? '-' : fmt.numero(alvos[k]);
    linha[k] = textoCompleto(fmt, linha.curto[k]);
  }
  return linha;
}

function linhaMetas(data, isObj, isDesc, col, maxPts, prova, nomeCurto, fmt) {
  const [tS, tB, tMB, tE, tMAX] = LIMIARES[maxPts];
  const items = isObj ? Object.keys(data).map(Number).sort((a,b)=>a-b).map(k => [k, data[k]]) : data;
  const alvo = t => {
    const validos = items.filter(i => i[1][col] >= t).map(i => i[0]);
    if (!validos.length) return null;
    return isDesc ? Math.max(...validos) : Math.min(...validos);
  };
  return montarLinha(prova, nomeCurto, fmt, { S: alvo(tS), B: alvo(tB), MB: alvo(tMB), E: alvo(tE), MAX: alvo(tMAX) });
}

const { cm, rep, metros, tempo } = FORMATOS;

/**
 * @returns {{prova:string, nomeCurto:string, sentido:'≤'|'≥', unidade:string,
 *   S:string, B:string, MB:string, E:string, MAX:string,
 *   curto:{S:string, B:string, MB:string, E:string, MAX:string},
 *   alvos:{S:number|null, B:number|null, MB:number|null, E:number|null, MAX:number|null}}[]}
 * S..MAX: texto completo da célula (ex.: '≤ 85.5 cm'); curto: só o número (ex.: '85.5') ou '-';
 * alvos: o mesmo valor em número (marcha em segundos).
 */
export function metasTACF({ sexo, idade, estatura, transicaoFem }) {
  if (sexo === 'M') {
    return [
      linhaMetas(OIC01, false, true, M_COLS.OIC01(estatura), 30, 'OIC 01 Cintura', 'Cintura', cm),
      linhaMetas(OIC02, true, false, M_COLS.OIC02(idade), 10, 'OIC 02 Flexão', 'Flexão', rep),
      linhaMetas(OIC03, true, false, M_COLS.OIC03(idade), 10, 'OIC 03 Abdominal', 'Abdominal', rep),
      linhaMetas(OIC04_ROWS, false, false, M_COLS.OIC04(idade), 50, 'OIC 04 Corrida 12min', 'Corrida 12 min', metros),
      linhaMetas(OIC04_MARCHA_ROWS, false, true, M_COLS.MARCH(idade), 50, 'OIC 04 Marcha 4.8km', 'Marcha 4,8 km', tempo),
    ];
  }
  let flexao;
  if (transicaoFem) {
    const t = tabela1Transicao(idade);
    flexao = montarLinha('OIC 06 Flexão (c/ Joelhos)', 'Flexão c/ joelhos', rep,
      { S: t.S, B: t.B, MB: t.MB, E: t.E, MAX: t.E });
  } else {
    flexao = linhaMetas(OIC06_SEM_JOELHO, true, false, F_COLS.OIC06(idade), 10, 'OIC 06 Flexão (s/ Joelhos)', 'Flexão', rep);
  }
  return [
    linhaMetas(OIC05, false, true, F_COLS.OIC05(estatura), 30, 'OIC 05 Cintura', 'Cintura', cm),
    flexao,
    linhaMetas(OIC07, true, false, F_COLS.OIC07(idade), 10, 'OIC 07 Abdominal', 'Abdominal', rep),
    linhaMetas(OIC08_ROWS, false, false, F_COLS.OIC08(idade), 50, 'OIC 08 Corrida 12min', 'Corrida 12 min', metros),
    linhaMetas(OIC08_MARCHA_ROWS, false, true, F_COLS.MARCH(idade), 50, 'OIC 08 Marcha 4.8km', 'Marcha 4,8 km', tempo),
  ];
}

// Linha da tabela de metas e valor digitado correspondentes a cada item.
function linhaEValor(item, e, metas) {
  switch (item) {
    case 'cintura': return [metas[0], e.cintura];
    case 'flexao': return [metas[1], e.flexao];
    case 'abdominal': return [metas[2], e.abdominal];
    case 'aerobico': return e.aerobicoModo === 'corrida' ? [metas[3], e.corridaM] : [metas[4], e.marchaSeg];
    default: throw new Error(`Item desconhecido: ${item}`);
  }
}

/**
 * Próxima menção do item e quanto falta para ela, a partir das mesmas metas da tabela.
 * @returns {{faixa:string, falta:number, sentido:'≤'|'≥', unidade:string, minimo:boolean} | null}
 * falta na unidade da prova (marcha em segundos); minimo=true quando o item está zerado
 * (a próxima faixa é o mínimo para APTO); null quando já está no máximo.
 */
export function proximaFaixa(item, e) {
  const atual = faixaItem(pontosItem(item, e), MAXIMOS[item]);
  if (atual === 'MAX') return null;
  const [linha, valor] = linhaEValor(item, e, metasTACF(e));
  for (let i = atual ? FAIXAS.indexOf(atual) + 1 : 0; i < FAIXAS.length; i++) {
    const alvo = linha.alvos[FAIXAS[i]];
    if (alvo === null) continue;
    const falta = linha.sentido === '≥' ? alvo - valor : valor - alvo;
    if (falta <= 0) continue;
    return { faixa: FAIXAS[i], falta, sentido: linha.sentido, unidade: linha.unidade, minimo: atual === null };
  }
  return null;
}

// Grau mínimo de cada alvo (Art. 36): Apto (S) 20, B 40, MB 70, E 90.
const ALVOS_AEROBICO = [['S', 20], ['B', 40], ['MB', 70], ['E', 90]];

/**
 * TACF parcial (prova aeróbica em outro dia, art. 20 III): quanto a corrida ou a marcha precisa para
 * cada menção, dado o que já foi feito. Varre os valores possíveis com o próprio pontosItem, então a
 * meta é exatamente a da tabela (inclusive a interpolação da corrida).
 * @param {{sexo:'M'|'F', idade:number, estatura:number, transicaoFem:boolean,
 *   cintura:number, flexao:number, abdominal:number}} e
 * @returns {{zerado:true, soma:number} | {zerado:false, soma:number,
 *   alvos:{mencao:'S'|'B'|'MB'|'E', corridaM:number|null, marchaSeg:number|null}[]}}
 * corridaM: menor distância (múltiplo de 10 m); marchaSeg: maior tempo (s); null = inalcançável.
 * zerado: cintura, flexão ou abdominal com zero ponto → Não Apto qualquer que seja a prova aeróbica (Art. 30/33).
 */
export function metasAerobico(e) {
  const p = { ...e, transicaoFem: !!e.transicaoFem && e.sexo === 'F' };
  const cin = pontosItem('cintura', p);
  const fle = pontosItem('flexao', p);
  const abd = pontosItem('abdominal', p);
  // Mesma ordem de soma de calcularTACF (cin + fle + abd + aer): o arredondamento em ponto flutuante coincide.
  const soma = cin + fle + abd;
  if (cin === 0 || fle === 0 || abd === 0) return { zerado: true, soma };
  const alcanca = (aer, limiar) => aer > 0 && soma + aer >= limiar;
  const { corridaM: limCorrida, marchaSeg: limMarcha } = LIMITES_ENTRADA;
  const alvos = ALVOS_AEROBICO.map(([mencao, limiar]) => {
    let corridaM = null;
    for (let m = 10; m <= limCorrida.max; m += 10) {
      if (alcanca(pontosItem('aerobico', { ...p, aerobicoModo: 'corrida', corridaM: m }), limiar)) { corridaM = m; break; }
    }
    let marchaSeg = null;
    for (let s = limMarcha.max; s >= limMarcha.min; s--) {
      if (alcanca(pontosItem('aerobico', { ...p, aerobicoModo: 'marcha', marchaSeg: s }), limiar)) { marchaSeg = s; break; }
    }
    return { mencao, corridaM, marchaSeg };
  });
  return { zerado: false, soma, alvos };
}
