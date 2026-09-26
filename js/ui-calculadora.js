/* Calculadora: liga o formulário do index.html aos módulos puros de cálculo e metas. */
import { calcularTACF, normalizarEntrada, pontosItem, MAXIMOS, sec2MMSS, MENCOES } from './calculo-tacf.js';
import { metasTACF, faixaItem, proximaFaixa } from './metas.js';

const $ = id => document.getElementById(id);
let tipoAerobico = 'corrida';
let ultimoCalculo = null;

/** Último cálculo exibido na tela (usado pelo fluxo de salvar). */
export function obterUltimoCalculo() { return ultimoCalculo; }

function setAerobico(tipo) {
  tipoAerobico = tipo;
  $('btn-corrida').classList.toggle('active', tipo === 'corrida');
  $('btn-marcha').classList.toggle('active', tipo === 'marcha');
  $('input-corrida').style.display = tipo === 'corrida' ? 'grid' : 'none';
  $('input-marcha').style.display = tipo === 'marcha' ? 'grid' : 'none';
  atualizarPrevias();
}

function verificarFC() {
  const fc = parseInt($('fc_repouso').value);
  $('alert-fc').style.display = fc && fc > 100 ? 'block' : 'none';
  // A FC de repouso não pontua; a única regra da norma é o encaminhamento médico acima de 100 bpm (Art. 24).
  const el = $('previa-fc');
  if (!Number.isFinite(fc)) {
    el.textContent = '';
    el.className = 'previa';
  } else if (fc > 100) {
    el.textContent = `→ ${fc} bpm · acima de 100: encaminhar ao médico antes dos testes (Art. 24)`;
    el.className = 'previa previa-zero';
  } else {
    el.textContent = `→ ${fc} bpm · dentro do limite para os testes (≤ 100 bpm) · não pontua`;
    el.className = 'previa previa-ok';
  }
}

// Clique na área do cartão alterna a caixa. Cliques na própria caixa ou no rótulo já alternam
// nativamente (e disparam 'change'); tratá-los aqui desfaria a marcação.
function toggleTransicaoFem(ev) {
  const chk = $('transicao_fem');
  if (ev.target === chk || ev.target.closest('label')) return;
  chk.checked = !chk.checked;
  atualizarMetas();
}

// Célula com as duas versões: texto completo (desktop) e só o número (celular); o CSS escolhe.
function celulaMeta(classe, linha, k) {
  return `<td class="${classe} val-meta"><span class="so-desktop">${linha[k]}</span><span class="so-celular">${linha.curto[k]}</span></td>`;
}

function atualizarMetas() {
  atualizarPrevias();
  const sexo = $('sexo').value;
  const idade = parseInt($('idade').value);
  const estatura = parseFloat($('estatura').value);
  const isTransicao = $('transicao_fem').checked;

  if (sexo === 'F') {
    $('transicao-fem-container').style.display = 'flex';
    $('t-cintura').innerText = 'OIC 05 · Cintura';
    if (isTransicao) {
      $('t-flex').innerText = 'OIC 06 · Flexão de Braço (Transição Art. 109)';
      $('d-flex').innerText = 'Execução com apoio dos joelhos (somente militares recém-ingressas de cursos até 180 dias)';
    } else {
      $('t-flex').innerText = 'OIC 06 · Flexão de Braço (Padrão 2026)';
      $('d-flex').innerText = 'Sem apoio dos joelhos · Conforme Art. 108 da NSCA 54-3/2026';
    }
  } else {
    $('transicao-fem-container').style.display = 'none';
    $('t-cintura').innerText = 'OIC 01 · Cintura';
    $('t-flex').innerText = 'OIC 02 · Flexão de Braços';
    $('d-flex').innerText = 'Repetições sem pausa para descanso (corpo estendido a 45º)';
  }

  if (!idade || !estatura) {
    $('card-metas').style.display = 'none';
    return;
  }
  $('card-metas').style.display = 'block';

  $('metas-body').innerHTML = metasTACF({ sexo, idade, estatura, transicaoFem: isTransicao })
    .map(l => `<tr><td class="oic-label"><span class="so-desktop">${l.prova}</span><span class="so-celular">${l.nomeCurto}<small>${l.sentido} ${l.unidade}</small></span></td>
          ${celulaMeta('c-s', l, 'S')}
          ${celulaMeta('c-b', l, 'B')}
          ${celulaMeta('c-mb', l, 'MB')}
          ${celulaMeta('c-e', l, 'E')}
          ${celulaMeta('c-max', l, 'MAX')}</tr>`)
    .join('');
}

function lerEntrada() {
  const sexo = $('sexo').value;
  const e = {
    sexo,
    idade: parseInt($('idade').value),
    estatura: parseFloat($('estatura').value),
    transicaoFem: $('transicao_fem').checked && sexo === 'F',
    cintura: parseFloat($('cintura').value),
    flexao: parseInt($('flexao').value),
    abdominal: parseInt($('abdominal').value),
    aerobicoModo: tipoAerobico,
  };
  if (tipoAerobico === 'corrida') e.corridaM = parseFloat($('corrida_m').value) || 0;
  else e.marchaSeg = (parseInt($('marcha_min').value) || 0) * 60 + (parseInt($('marcha_seg').value) || 0);
  return normalizarEntrada(e);
}

const ROTULO_FAIXA = { S: 'Satisfatório (S)', B: 'Bom (B)', MB: 'Muito Bom (MB)', E: 'Excelente (E)', MAX: 'Máximo' };
const CLASSE_FAIXA = { S: 'c-s', B: 'c-b', MB: 'c-mb', E: 'c-e', MAX: 'c-max' };

// Campos do formulário que alimentam cada item; o item só tem prévia se algum deles foi preenchido.
function camposItem(item) {
  if (item !== 'aerobico') return [item];
  return tipoAerobico === 'corrida' ? ['corrida_m'] : ['marcha_min', 'marcha_seg'];
}

// Ex.: 'falta 1 rep para Bom (B)', 'reduzir 0.8 cm para o Máximo', 'reduzir 3:00 para ... — mínimo para APTO'.
function textoFalta(p) {
  if (!p) return '';
  const alvo = p.faixa === 'MAX' ? 'o Máximo' : ROTULO_FAIXA[p.faixa];
  let quanto;
  if (p.unidade === 'min') quanto = `${Math.floor(p.falta / 60)}:${String(p.falta % 60).padStart(2, '0')}`;
  else if (p.unidade === 'cm') quanto = `${p.falta.toFixed(1)} cm`;
  else quanto = `${p.falta} ${p.unidade}`;
  const verbo = p.sentido === '≤' ? 'reduzir' : (p.falta === 1 ? 'falta' : 'faltam');
  return `${verbo} ${quanto} para ${alvo}` + (p.minimo ? ' — mínimo para APTO' : '');
}

/** Prévia dos pontos de cada item enquanto a pessoa digita (mesma conta do resultado final). */
function atualizarPrevias() {
  const e = lerEntrada();
  const perfilOk = !!e.idade && !!e.estatura;
  for (const item of ['cintura', 'flexao', 'abdominal', 'aerobico']) {
    const el = $('previa-' + item);
    const falta = $('falta-' + item);
    falta.textContent = '';
    const preenchido = camposItem(item).some(id => $(id).value.trim() !== '');
    if (!preenchido) {
      el.textContent = '';
      el.className = 'previa';
    } else if (!perfilOk) {
      el.textContent = 'Informe idade e estatura para ver a prévia';
      el.className = 'previa previa-pendente';
    } else {
      const pontos = pontosItem(item, e);
      const faixa = faixaItem(pontos, MAXIMOS[item]);
      el.textContent = `→ ${pontos.toFixed(1)} de ${MAXIMOS[item]} pts · ` +
        (faixa ? ROTULO_FAIXA[faixa] : 'abaixo do mínimo (NÃO APTO)');
      el.className = 'previa ' + (faixa ? CLASSE_FAIXA[faixa] : 'previa-zero');
      falta.textContent = textoFalta(proximaFaixa(item, e));
    }
  }
}

function calcular() {
  const e = lerEntrada();
  const aeroVal = e.aerobicoModo === 'corrida' ? e.corridaM : e.marchaSeg;
  if (!e.idade || !e.estatura || isNaN(e.cintura) || isNaN(e.flexao) || isNaN(e.abdominal) || aeroVal === 0) {
    $('alert-err').classList.add('show');
    return;
  }
  $('alert-err').classList.remove('show');

  const r = calcularTACF(e);
  const fc = parseInt($('fc_repouso').value);
  ultimoCalculo = { entrada: e, resultado: r, fcRepouso: Number.isFinite(fc) ? fc : null };

  $('resultado').style.display = 'block';
  $('res-info').textContent =
    (e.sexo === 'M' ? 'Segmento Masculino' : 'Segmento Feminino' + (e.transicaoFem ? ' (Transição Art. 109)' : '')) +
    ' · ' + e.idade + ' anos · ' + e.estatura + ' cm';
  $('res-grau').innerText = r.grau.toFixed(1);

  $('msg-max-score').style.display = r.destaque === 'maximo' ? 'block' : 'none';
  $('msg-destaque-score').style.display = r.destaque === 'destaque96' ? 'block' : 'none';

  $('res-apt').innerText = r.apto ? '✓ APTO NO TACF' : '✗ NÃO APTO NO TACF';
  $('res-apt').className = 'badge-apt ' + (r.apto ? 'apt-apto' : 'apt-inapto');

  const mencao = MENCOES[r.mencao];
  $('res-conceito').innerText = 'Conceito Global: ' + mencao.rotulo;
  $('res-conceito').style.color = mencao.cor;

  if (r.motivoInapto) {
    $('res-motivo-inapto').innerText = r.motivoInapto;
    $('res-motivo-inapto').style.display = 'block';
  } else {
    $('res-motivo-inapto').style.display = 'none';
  }

  const aeroTxt = e.aerobicoModo === 'corrida' ? e.corridaM + ' m' : sec2MMSS(e.marchaSeg);
  const bDown = [
    { n: e.sexo === 'M' ? 'OIC 01 Cintura' : 'OIC 05 Cintura', v: e.cintura + ' cm', p: r.pontos.cintura, mx: 30 },
    { n: e.sexo === 'M' ? 'OIC 02 Flexão' : (e.transicaoFem ? 'OIC 06 Flexão (c/ Joelhos)' : 'OIC 06 Flexão (s/ Joelhos)'), v: e.flexao + ' rep', p: r.pontos.flexao, mx: 10 },
    { n: e.sexo === 'M' ? 'OIC 03 Abdominal' : 'OIC 07 Abdominal', v: e.abdominal + ' rep', p: r.pontos.abdominal, mx: 10 },
    { n: e.sexo === 'M' ? 'OIC 04 Aeróbico' : 'OIC 08 Aeróbico', v: aeroTxt, p: r.pontos.aerobico, mx: 50 },
  ];

  $('oic-breakdown').innerHTML = bDown.map((o, i) => {
    const pBar = Math.min((o.p / o.mx) * 100, 100);
    return `
    <div class="oic-card" style="animation-delay:${i * 0.08}s; border-color:${o.p > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(239,83,80,0.4)'}">
      <div class="oic-name">${o.n}</div>
      <div class="oic-value" style="color:${o.p > 0 ? '#fff' : '#EF9A9A'}">${o.p.toFixed(1)}</div>
      <div class="oic-pts">de ${o.mx} pts · <strong>${o.v}</strong></div>
      <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:4px;margin:8px 0 4px">
        <div style="height:100%;width:${pBar}%;background:${o.p > 0 ? 'var(--sky-bright)' : '#EF5350'};border-radius:4px;transition:width 0.8s ease ${i * 0.1}s"></div>
      </div>
      <div style="font-size:10px; color:${o.p > 0 ? '#81C784' : '#EF5350'}">${o.p > 0 ? 'Índice Atingido' : 'Abaixo do Mínimo'}</div>
    </div>`;
  }).join('');

  $('card-resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetarFormulario() {
  document.querySelectorAll('input').forEach(i => {
    if (i.type === 'checkbox') i.checked = false;
    else i.value = '';
  });
  ultimoCalculo = null;
  $('resultado').style.display = 'none';
  $('card-metas').style.display = 'none';
  $('alert-err').classList.remove('show');
  $('alert-fc').style.display = 'none';
  setAerobico('corrida');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('sexo').addEventListener('change', atualizarMetas);
$('idade').addEventListener('input', atualizarMetas);
$('estatura').addEventListener('input', atualizarMetas);
$('transicao-fem-container').addEventListener('click', toggleTransicaoFem);
$('transicao_fem').addEventListener('change', atualizarMetas);
$('fc_repouso').addEventListener('input', verificarFC);
$('btn-corrida').addEventListener('click', () => setAerobico('corrida'));
$('btn-marcha').addEventListener('click', () => setAerobico('marcha'));
$('btn-calcular').addEventListener('click', calcular);
$('btn-reset').addEventListener('click', resetarFormulario);
for (const id of ['cintura', 'flexao', 'abdominal', 'corrida_m', 'marcha_min', 'marcha_seg']) {
  $(id).addEventListener('input', atualizarPrevias);
}
