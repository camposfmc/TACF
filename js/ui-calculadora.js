/* Calculadora: liga o formulário do index.html aos módulos puros de cálculo e metas. */
import { calcularTACF, normalizarEntrada, pontosItem, sec2MMSS, MENCOES } from './calculo-tacf.js';
import { metasTACF, proximaFaixa } from './metas.js';
import { ROTULO_FAIXA, textoFalta, textoPrevia, avaliarFC } from './textos.js';
import { erroCampo, validarEntrada } from './limites.js';

const $ = id => document.getElementById(id);
let tipoAerobico = 'corrida';
let flexaoExecucao = 'padrao'; // 'padrao' | 'joelhos' (Art. 109: transição adaptativa feminina)
let ultimoCalculo = null;
let errosMostrados = []; // erros de limite listados no #alert-err (somem ao editar o campo)
const TEXTO_ALERTA_ERR = document.getElementById('alert-err').textContent;

// Campo de limite (js/limites.js) → input do formulário que recebe aria-invalid.
const INPUT_DO_CAMPO = {
  idade: 'idade', estatura: 'estatura', cintura: 'cintura', flexao: 'flexao', abdominal: 'abdominal',
  corridaM: 'corrida_m', marchaSeg: 'marcha_min', segundosMarcha: 'marcha_seg', fcRepouso: 'fc_repouso',
};

/** Último cálculo exibido na tela (usado pelo fluxo de salvar). */
export function obterUltimoCalculo() { return ultimoCalculo; }

function setAerobico(tipo) {
  tipoAerobico = tipo;
  $('btn-corrida').classList.toggle('active', tipo === 'corrida');
  $('btn-marcha').classList.toggle('active', tipo === 'marcha');
  $('input-corrida').style.display = tipo === 'corrida' ? 'grid' : 'none';
  $('input-marcha').style.display = tipo === 'marcha' ? 'grid' : 'none';
  limparErros(['corridaM', 'marchaSeg', 'segundosMarcha']);
  atualizarPrevias();
}

function verificarFC() {
  const fc = parseInt($('fc_repouso').value);
  $('alert-fc').style.display = fc && fc > 100 ? 'block' : 'none';
  const el = $('previa-fc');
  const bruto = $('fc_repouso').value.trim();
  const erro = bruto !== '' ? erroCampo('fcRepouso', parseFloat(bruto)) : null;
  if (erro) {
    el.textContent = erro;
    el.className = 'previa previa-zero';
    return;
  }
  const avaliacao = avaliarFC(fc);
  el.textContent = avaliacao ? avaliacao.texto : '';
  el.className = !avaliacao ? 'previa' : avaliacao.alerta ? 'previa previa-zero' : 'previa previa-ok';
}

// "Como fez a flexão?" (Art. 109): Padrão ou Joelhos apoiados. Só visível/aplicável ao feminino.
function setFlexaoExecucao(modo) {
  flexaoExecucao = modo;
  $('btn-flexao-padrao').classList.toggle('active', modo === 'padrao');
  $('btn-flexao-padrao').setAttribute('aria-pressed', String(modo === 'padrao'));
  $('btn-flexao-joelhos').classList.toggle('active', modo === 'joelhos');
  $('btn-flexao-joelhos').setAttribute('aria-pressed', String(modo === 'joelhos'));
  $('aviso-transicao').classList.toggle('show', modo === 'joelhos');
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
  const isTransicao = flexaoExecucao === 'joelhos';

  if (sexo === 'F') {
    $('grupo-flexao-execucao').style.display = 'block';
    $('t-cintura').innerText = 'OIC 05 · Cintura';
    if (isTransicao) {
      $('t-flex').innerText = 'OIC 06 · Flexão de Braço (Transição Art. 109)';
      $('d-flex').innerText = 'Execução com apoio dos joelhos (somente militares recém-ingressas de cursos até 180 dias)';
    } else {
      $('t-flex').innerText = 'OIC 06 · Flexão de Braço (Padrão 2026)';
      $('d-flex').innerText = 'Sem apoio dos joelhos · Conforme Art. 108 da NSCA 54-3/2026';
    }
  } else {
    $('grupo-flexao-execucao').style.display = 'none';
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
    transicaoFem: flexaoExecucao === 'joelhos' && sexo === 'F',
    cintura: parseFloat($('cintura').value),
    flexao: parseInt($('flexao').value),
    abdominal: parseInt($('abdominal').value),
    aerobicoModo: tipoAerobico,
  };
  if (tipoAerobico === 'corrida') e.corridaM = parseFloat($('corrida_m').value) || 0;
  else e.marchaSeg = (parseInt($('marcha_min').value) || 0) * 60 + (parseInt($('marcha_seg').value) || 0);
  return normalizarEntrada(e);
}

/** Segundos da marcha como digitados (0–59), conferidos na leitura do formulário. */
function erroSegundosMarcha() {
  const v = $('marcha_seg').value.trim();
  return tipoAerobico === 'marcha' && v !== '' ? erroCampo('segundosMarcha', parseFloat(v)) : null;
}

/** Erro de limite do valor de uma prova já preenchida. */
function erroPrevia(item, e) {
  if (item !== 'aerobico') return erroCampo(item, e[item]);
  if (e.aerobicoModo === 'corrida') return erroCampo('corridaM', e.corridaM);
  return erroSegundosMarcha() ?? erroCampo('marchaSeg', e.marchaSeg);
}

/** Idade e estatura preenchidas e dentro do limite (senão a prévia fica pendente, nunca com pontos). */
function perfilValido(e) {
  return !!e.idade && !!e.estatura && !erroCampo('idade', e.idade) && !erroCampo('estatura', e.estatura);
}

/** Todos os erros de limite do formulário (campos vazios ficam para a checagem de completude). */
function errosLimite(e) {
  const erros = validarEntrada(e);
  const seg = erroSegundosMarcha();
  if (seg) erros.push({ campo: 'segundosMarcha', mensagem: seg });
  const fc = $('fc_repouso').value.trim();
  const errFC = fc !== '' ? erroCampo('fcRepouso', parseFloat(fc)) : null;
  if (errFC) erros.push({ campo: 'fcRepouso', mensagem: errFC });
  return erros;
}

function marcarInvalidos(erros) {
  for (const id of Object.values(INPUT_DO_CAMPO)) $(id).removeAttribute('aria-invalid');
  for (const { campo } of erros) $(INPUT_DO_CAMPO[campo]).setAttribute('aria-invalid', 'true');
}

/** Aviso de erro: lista de erros de limite, ou (null) o texto original de campos faltando. */
function mostrarErro(erros) {
  const el = $('alert-err');
  errosMostrados = erros ?? [];
  if (!erros) {
    el.textContent = TEXTO_ALERTA_ERR;
  } else {
    el.textContent = '⚠️ Corrija os campos destacados:';
    for (const { mensagem: m } of erros) {
      const linha = document.createElement('div');
      linha.textContent = m;
      el.appendChild(linha);
    }
  }
  el.classList.add('show');
}

// Erros de limite que cada input apaga ao mudar (segundos da marcha também mudam o tempo total).
const LIMPA = {
  idade: ['idade'], estatura: ['estatura'], cintura: ['cintura'], flexao: ['flexao'], abdominal: ['abdominal'],
  corrida_m: ['corridaM'], marcha_min: ['marchaSeg'], marcha_seg: ['marchaSeg', 'segundosMarcha'], fc_repouso: ['fcRepouso'],
};

/** Ao editar: tira do aviso os erros do campo; sem erros restantes (ou aviso de campos faltando), o aviso some. */
function limparErros(campos) {
  if (!$('alert-err').classList.contains('show')) return;
  const restantes = errosMostrados.filter(x => !campos.includes(x.campo));
  marcarInvalidos(restantes);
  if (restantes.length === 0) {
    errosMostrados = [];
    $('alert-err').classList.remove('show');
  } else if (restantes.length !== errosMostrados.length) {
    mostrarErro(restantes);
  }
}

const CLASSE_FAIXA = { S: 'c-s', B: 'c-b', MB: 'c-mb', E: 'c-e', MAX: 'c-max' };

// Campos do formulário que alimentam cada item; o item só tem prévia se algum deles foi preenchido.
function camposItem(item) {
  if (item !== 'aerobico') return [item];
  return tipoAerobico === 'corrida' ? ['corrida_m'] : ['marcha_min', 'marcha_seg'];
}

/** Prévia dos pontos de cada item enquanto a pessoa digita (mesma conta do resultado final). */
function atualizarPrevias() {
  const e = lerEntrada();
  const perfilOk = perfilValido(e);
  for (const item of ['cintura', 'flexao', 'abdominal', 'aerobico']) {
    const el = $('previa-' + item);
    const falta = $('falta-' + item);
    falta.textContent = '';
    // Corrida que arredonda a 0 m (0–4 m) conta como não preenchida, como no Calcular.
    const preenchido = camposItem(item).some(id => $(id).value.trim() !== '')
      && !(item === 'aerobico' && e.aerobicoModo === 'corrida' && e.corridaM === 0);
    if (!preenchido) {
      el.textContent = '';
      el.className = 'previa';
    } else if (erroPrevia(item, e)) {
      // Valor fora do limite nunca é pontuado.
      el.textContent = erroPrevia(item, e);
      el.className = 'previa previa-zero';
    } else if (!perfilOk) {
      el.textContent = 'Informe idade e estatura para ver a prévia';
      el.className = 'previa previa-pendente';
    } else {
      const { texto, faixa } = textoPrevia(item, pontosItem(item, e));
      el.textContent = texto;
      el.className = 'previa ' + (faixa ? CLASSE_FAIXA[faixa] : 'previa-zero');
      falta.textContent = textoFalta(proximaFaixa(item, e));
    }
  }
}

function calcular() {
  const e = lerEntrada();
  // Valor fora do limite (js/limites.js) nunca é calculado.
  const erros = errosLimite(e);
  marcarInvalidos(erros);
  if (erros.length > 0) {
    ultimoCalculo = null;
    $('resultado').style.display = 'none';
    mostrarErro(erros);
    return;
  }
  const aeroVal = e.aerobicoModo === 'corrida' ? e.corridaM : e.marchaSeg;
  if (!e.idade || !e.estatura || isNaN(e.cintura) || isNaN(e.flexao) || isNaN(e.abdominal) || aeroVal === 0) {
    mostrarErro(null);
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
  document.querySelectorAll('input').forEach(i => { i.value = ''; });
  setFlexaoExecucao('padrao');
  ultimoCalculo = null;
  $('resultado').style.display = 'none';
  $('card-metas').style.display = 'none';
  $('alert-err').classList.remove('show');
  marcarInvalidos([]);
  $('alert-fc').style.display = 'none';
  setAerobico('corrida');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('sexo').addEventListener('change', atualizarMetas);
$('idade').addEventListener('input', atualizarMetas);
$('estatura').addEventListener('input', atualizarMetas);
$('btn-flexao-padrao').addEventListener('click', () => setFlexaoExecucao('padrao'));
$('btn-flexao-joelhos').addEventListener('click', () => setFlexaoExecucao('joelhos'));
$('fc_repouso').addEventListener('input', verificarFC);
$('btn-corrida').addEventListener('click', () => setAerobico('corrida'));
$('btn-marcha').addEventListener('click', () => setAerobico('marcha'));
$('btn-calcular').addEventListener('click', calcular);
$('btn-reset').addEventListener('click', resetarFormulario);
for (const id of ['cintura', 'flexao', 'abdominal', 'corrida_m', 'marcha_min', 'marcha_seg']) {
  $(id).addEventListener('input', atualizarPrevias);
}
// O erro de um campo (destaque e linha no aviso) some quando ele muda.
for (const [id, campos] of Object.entries(LIMPA)) {
  $(id).addEventListener('input', () => { $(id).removeAttribute('aria-invalid'); limparErros(campos); });
}
