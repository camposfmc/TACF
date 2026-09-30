/*
 * Limites de entrada da calculadora (fonte única: calculadora pública, app e servidor).
 * Módulo puro: sem DOM, rede ou armazenamento. Os limites são os mesmos dos CHECK de
 * tacf_registros no banco; valor fora deles nunca é pontuado.
 */

/** Limites por campo. `inteiro`: não aceita fração. */
export const LIMITES_ENTRADA = {
  idade:          { min: 18,  max: 75,   inteiro: true,  mensagem: 'Idade: informe de 18 a 75 anos.' },
  estatura:       { min: 140, max: 220,  inteiro: false, mensagem: 'Estatura: informe de 140 a 220 cm.' },
  cintura:        { min: 50,  max: 150,  inteiro: false, mensagem: 'Cintura: informe de 50 a 150 cm.' },
  flexao:         { min: 0,   max: 150,  inteiro: true,  mensagem: 'Flexão: informe de 0 a 150 repetições.' },
  abdominal:      { min: 0,   max: 150,  inteiro: true,  mensagem: 'Abdominal: informe de 0 a 150 repetições.' },
  // 0 m continua significando "não preenchido" (ver validarEntrada).
  corridaM:       { min: 1,   max: 5000, inteiro: true,  mensagem: 'Corrida: informe de 1 a 5000 metros.' },
  // 600 s = 10:00; 7200 s = 2:00:00.
  marchaSeg:      { min: 600, max: 7200, inteiro: true,  mensagem: 'Marcha: informe de 10:00 a 2:00:00.' },
  fcRepouso:      { min: 30,  max: 220,  inteiro: true,  mensagem: 'FC de repouso: informe de 30 a 220 bpm.' },
  // Campo "segundos" da marcha, conferido na leitura do formulário.
  segundosMarcha: { min: 0,   max: 59,   inteiro: true,  mensagem: 'Segundos: informe de 0 a 59.' },
};

/**
 * Mensagem de erro do valor de um campo, ou null se estiver dentro do limite.
 * @param {keyof typeof LIMITES_ENTRADA} campo
 * @param {number} valor
 * @returns {string|null}
 */
export function erroCampo(campo, valor) {
  const l = LIMITES_ENTRADA[campo];
  if (!l) throw new Error(`Campo sem limite: ${campo}`);
  const ok = Number.isFinite(valor) && valor >= l.min && valor <= l.max && (!l.inteiro || Number.isInteger(valor));
  return ok ? null : l.mensagem;
}

/**
 * Erros de limite da entrada normalizada, na ordem do formulário. Só confere os campos
 * preenchidos (número finito): ausente/NaN fica para a checagem de completude. Na prova
 * aeróbica, só a do modo escolhido, e 0 significa "não preenchido".
 * @returns {{campo: string, mensagem: string}[]}
 */
export function validarEntrada(e) {
  const campos = ['idade', 'estatura', 'cintura', 'flexao', 'abdominal',
    e.aerobicoModo === 'marcha' ? 'marchaSeg' : 'corridaM'];
  const erros = [];
  for (const campo of campos) {
    const v = e[campo];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if ((campo === 'corridaM' || campo === 'marchaSeg') && v === 0) continue;
    const mensagem = erroCampo(campo, v);
    if (mensagem) erros.push({ campo, mensagem });
  }
  return erros;
}
