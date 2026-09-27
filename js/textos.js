/* Textos derivados do cálculo, usados pela calculadora pública e pelo App TACF. Módulo puro. */
import { MAXIMOS } from './calculo-tacf.js';
import { faixaItem } from './metas.js';

export const ROTULO_FAIXA = { S: 'Satisfatório (S)', B: 'Bom (B)', MB: 'Muito Bom (MB)', E: 'Excelente (E)', MAX: 'Máximo' };
export const NOME_MENCAO = { S: 'Satisfatório', B: 'Bom', MB: 'Muito Bom', E: 'Excelente' };

// Ex.: 'falta 1 rep para Bom (B)', 'reduzir 0.8 cm para o Máximo', 'reduzir 3:00 para ... — mínimo para APTO'.
export function textoFalta(p) {
  if (!p) return '';
  const alvo = p.faixa === 'MAX' ? 'o Máximo' : ROTULO_FAIXA[p.faixa];
  let quanto;
  if (p.unidade === 'min') quanto = `${Math.floor(p.falta / 60)}:${String(p.falta % 60).padStart(2, '0')}`;
  else if (p.unidade === 'cm') quanto = `${p.falta.toFixed(1)} cm`;
  else quanto = `${p.falta} ${p.unidade}`;
  const verbo = p.sentido === '≤' ? 'reduzir' : (p.falta === 1 ? 'falta' : 'faltam');
  return `${verbo} ${quanto} para ${alvo}` + (p.minimo ? ' — mínimo para APTO' : '');
}

/** Prévia de um item enquanto se digita: pontos, máximo e faixa (null = abaixo do mínimo). */
export function textoPrevia(item, pontos) {
  const faixa = faixaItem(pontos, MAXIMOS[item]);
  return {
    texto: `→ ${pontos.toFixed(1)} de ${MAXIMOS[item]} pts · ` + (faixa ? ROTULO_FAIXA[faixa] : 'abaixo do mínimo (NÃO APTO)'),
    faixa,
  };
}

// A FC de repouso não pontua; a única regra da norma é o encaminhamento médico acima de 100 bpm (Art. 24).
export function avaliarFC(fc) {
  if (!Number.isFinite(fc)) return null;
  return fc > 100
    ? { alerta: true, texto: `→ ${fc} bpm · acima de 100: encaminhar ao médico antes dos testes (Art. 24)` }
    : { alerta: false, texto: `→ ${fc} bpm · dentro do limite para os testes (≤ 100 bpm) · não pontua` };
}

/** 'Faltam 15.4 pontos para Muito Bom (70).' — em português, abaixo de 2 o substantivo fica no singular. */
export function textoProximaMencao(p) {
  if (!p) return '';
  const singular = p.falta < 2;
  return `${singular ? 'Falta' : 'Faltam'} ${p.falta.toFixed(1)} ${singular ? 'ponto' : 'pontos'} para ${NOME_MENCAO[p.mencao]} (${p.limiar}).`;
}
