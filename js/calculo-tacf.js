/* Cálculo do TACF pela NSCA 54-3/2026. Módulo puro: sem DOM, rede ou armazenamento. */
import {
  NORMA, OIC01, OIC05, OIC02, OIC06_SEM_JOELHO, OIC03, OIC07,
  OIC04_ROWS, OIC08_ROWS, OIC04_MARCHA_ROWS, OIC08_MARCHA_ROWS,
  M_COLS, F_COLS, tabela1Transicao,
} from './nsca-2026-tabelas.js';

export function buscarPontoArrayAsc(arr, valor, col) {
  if (valor < arr[0][0]) return 0;
  if (valor >= arr[arr.length-1][0]) return arr[arr.length-1][1][col];
  const exact = arr.find(r => r[0] === valor);
  if (exact) return exact[1][col];
  const above = arr.find(r => r[0] > valor);
  const below = arr.slice().reverse().find(r => r[0] < valor);
  const t = (valor - below[0]) / (above[0] - below[0]);
  return below[1][col] + t * (above[1][col] - below[1][col]);
}

export function buscarPontoObj(obj, valor, col) {
  const keys = Object.keys(obj).map(Number).sort((a,b)=>a-b);
  if (valor < keys[0]) return 0;
  if (valor >= keys[keys.length-1]) return obj[keys[keys.length-1]][col];
  return obj[valor] ? obj[valor][col] : 0;
}

/**
 * Tabelas decrescentes (cintura, marcha): usa a linha tabelada mais próxima que seja >= valor,
 * ou seja, nunca pontua acima do que a norma garante. Pior que a 1ª linha → 0.
 */
export function buscarPontoDegrauDesc(arr, valor, col) {
  let linha = null;
  for (const r of arr) { if (r[0] >= valor) linha = r; else break; }
  return linha ? linha[1][col] : 0;
}

export function sec2MMSS(s) { let m=Math.floor(s/60), sc=s%60; return String(m).padStart(2,'0')+':'+String(sc).padStart(2,'0'); }

function pontosFlexaoTransicao(flexao, idade) {
  const t = tabela1Transicao(idade);
  if (flexao < t.S) return 0;
  if (flexao < t.B) return 2.0 + ((flexao - t.S) / (t.B - t.S)) * 2.0;
  if (flexao < t.MB) return 4.0 + ((flexao - t.B) / (t.MB - t.B)) * 3.0;
  if (flexao < t.E) return 7.0 + ((flexao - t.MB) / (t.E - t.MB)) * 2.0;
  return 10.0;
}

/** Pontuação máxima de cada item (OIC). */
export const MAXIMOS = { cintura: 30, flexao: 10, abdominal: 10, aerobico: 50 };

/**
 * Pontos de um único item. Usa só o perfil (sexo, idade, estatura, transicaoFem, aerobicoModo)
 * e o valor do próprio item — serve tanto ao resultado final quanto à prévia enquanto se digita.
 * @param {'cintura'|'flexao'|'abdominal'|'aerobico'} item
 */
export function pontosItem(item, e) {
  const { sexo, idade, estatura } = e;
  const masc = sexo === 'M';
  switch (item) {
    case 'cintura':
      return masc
        ? buscarPontoDegrauDesc(OIC01, e.cintura, M_COLS.OIC01(estatura))
        : buscarPontoDegrauDesc(OIC05, e.cintura, F_COLS.OIC05(estatura));
    case 'flexao':
      if (masc) return buscarPontoObj(OIC02, e.flexao, M_COLS.OIC02(idade));
      return e.transicaoFem
        ? pontosFlexaoTransicao(e.flexao, idade)
        : buscarPontoObj(OIC06_SEM_JOELHO, e.flexao, F_COLS.OIC06(idade));
    case 'abdominal':
      return masc
        ? buscarPontoObj(OIC03, e.abdominal, M_COLS.OIC03(idade))
        : buscarPontoObj(OIC07, e.abdominal, F_COLS.OIC07(idade));
    case 'aerobico':
      if (e.aerobicoModo === 'corrida') {
        return masc
          ? buscarPontoArrayAsc(OIC04_ROWS, e.corridaM, M_COLS.OIC04(idade))
          : buscarPontoArrayAsc(OIC08_ROWS, e.corridaM, F_COLS.OIC08(idade));
      }
      return masc
        ? buscarPontoDegrauDesc(OIC04_MARCHA_ROWS, e.marchaSeg, M_COLS.MARCH(idade))
        : buscarPontoDegrauDesc(OIC08_MARCHA_ROWS, e.marchaSeg, F_COLS.MARCH(idade));
    default:
      throw new Error(`Item desconhecido: ${item}`);
  }
}

/** Menção pela regra da norma (Art. 36): não apto → I; apto → E ≥ 90, MB ≥ 70, B ≥ 40, senão S. */
export function mencaoDe(grau, apto) {
  if (!apto) return 'I';
  if (grau >= 90.0) return 'E';
  if (grau >= 70.0) return 'MB';
  if (grau >= 40.0) return 'B';
  return 'S';
}

/**
 * @param {{sexo:'M'|'F', idade:number, estatura:number, transicaoFem:boolean,
 *   cintura:number, flexao:number, abdominal:number,
 *   aerobicoModo:'corrida'|'marcha', corridaM?:number, marchaSeg?:number}} e
 * corridaM já arredondada a 10 m (ver normalizarEntrada).
 */
export function calcularTACF(e) {
  e = { ...e, transicaoFem: !!e.transicaoFem && e.sexo === 'F' };
  const cin = pontosItem('cintura', e);
  const fle = pontosItem('flexao', e);
  const abd = pontosItem('abdominal', e);
  const aer = pontosItem('aerobico', e);

  const grau = cin + fle + abd + aer;
  // Critério de Aptidão oficial (Art. 30, 35 e 36): grau >= 20 E nenhum OIC com zero
  const zeraOIC = (cin === 0 || fle === 0 || abd === 0 || aer === 0);
  const apto = !zeraOIC && grau >= 20.0;

  const mencao = mencaoDe(grau, apto);
  let motivoInapto = null;
  if (!apto) {
    if (zeraOIC && grau >= 20) {
      motivoInapto = '⚠️ Avaliado como Não Apto devido a desempenho inferior ao mínimo estabelecido (zero pontos) em um ou mais OIC, conforme Art. 30 e 33 da NSCA 54-3/2026.';
    } else if (grau < 20) {
      motivoInapto = '⚠️ Grau Final inferior a 20,0 pontos (Art. 36, inciso II).';
    }
  }

  let destaque = null;
  if (apto && Math.round(grau * 10) === 1000) destaque = 'maximo';
  else if (apto && grau >= 96.0) destaque = 'destaque96';

  return {
    norma: NORMA,
    pontos: { cintura: cin, flexao: fle, abdominal: abd, aerobico: aer },
    grau, apto, mencao, motivoInapto, destaque,
  };
}

/** Arredondamento que a tela aplica antes do cálculo (corrida de 10 em 10 m, norma: campo CORRIDA). */
export function normalizarEntrada(e) {
  return {
    ...e,
    corridaM: e.aerobicoModo === 'corrida' ? Math.round((e.corridaM || 0) / 10) * 10 : undefined,
    marchaSeg: e.aerobicoModo === 'marcha' ? e.marchaSeg : undefined,
  };
}

export const MENCOES = {
  E:  { rotulo: 'Excelente (E)',      cor: '#64B5F6' },
  MB: { rotulo: 'Muito Bom (MB)',     cor: '#81C784' },
  B:  { rotulo: 'Bom (B)',            cor: '#AED581' },
  S:  { rotulo: 'Satisfatório (S)',   cor: '#FFD54F' },
  I:  { rotulo: 'Insatisfatório (I)', cor: '#EF5350' },
};

// Grau mínimo de cada menção (Art. 36): S a partir de 20 (APTO), B 40, MB 70, E 90.
const LIMIAR_MENCAO = [['S', 20], ['B', 40], ['MB', 70], ['E', 90]];

/**
 * Próxima menção do grau final e quantos pontos faltam, arredondado para cima a 0,1.
 * null na menção máxima (E) ou quando o NÃO APTO vem de OIC zerado (mais pontos não resolvem).
 * @param {{apto:boolean, grau:number, pontos:Record<string, number>}} r resultado de calcularTACF
 */
export function proximaMencao(r) {
  if (!r.apto && Object.values(r.pontos).some(p => p === 0)) return null;
  const proxima = LIMIAR_MENCAO.find(([, limiar]) => r.grau < limiar);
  if (!proxima) return null;
  const [mencao, limiar] = proxima;
  // Centésimos inteiros antes de arredondar: evita que 15.4000001 vire 15.5.
  const centesimos = Math.round((limiar - r.grau) * 100);
  return { mencao, limiar, falta: Math.ceil(centesimos / 10) / 10 };
}
