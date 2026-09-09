import { db } from './db';
import { anoMesDe, montarDataISO, anoMesAtualChave } from '../utils/format';

// Um "lançamento fixo" é uma RECORRÊNCIA (valor, categoria, conta, dia do
// mês) que gera um lançamento de verdade em `entries` todo mês. Não existe
// servidor/backend nesta fase, então a geração é feita "sob demanda": toda
// vez que o app abre, comparamos a última geração de cada recorrência com o
// mês atual e criamos os lançamentos que faltarem — inclusive vários meses
// de uma vez, se o app ficou fechado por um tempo.
//
// `totalParcelas` é opcional: null/undefined = repete pra sempre (salário,
// aluguel). Um número (ex: 3) = compra parcelada — para de gerar sozinha
// depois da última parcela e a recorrência fica marcada como concluída
// (`ativa: false`).

export async function criarRecorrencia({ tipo, valor, categoriaId, subcategoriaId, contaId, nota, dataInicio, totalParcelas }) {
  const { ano, mes } = anoMesDe(dataInicio);
  const diaDoMes = Number(dataInicio.split('-')[2]);

  const recorrenciaId = await db.recorrencias.add({
    tipo,
    valor,
    categoriaId,
    subcategoriaId: subcategoriaId ?? null,
    contaId: contaId ?? null,
    nota: nota || '',
    diaDoMes,
    ativa: true,
    dataInicio,
    totalParcelas: totalParcelas || null,
    ultimaGeracao: null // ainda não gerou nenhum lançamento
  });

  // Gera já o primeiro lançamento (o mês de início) e atualiza o controle.
  await gerarLancamentoDoMes(await db.recorrencias.get(recorrenciaId), ano, mes);
  await db.recorrencias.update(recorrenciaId, { ultimaGeracao: `${ano}-${String(mes).padStart(2, '0')}` });

  return recorrenciaId;
}

async function jaGerouEsteMes(recorrenciaId, ano, mes) {
  const dataInicioDoMes = montarDataISO(ano, mes, 1);
  const dataFimDoMes = montarDataISO(ano, mes, 31); // clampado pro último dia real do mês
  const existente = await db.entries
    .where('recorrenciaId')
    .equals(recorrenciaId)
    .and((e) => e.data >= dataInicioDoMes && e.data <= dataFimDoMes)
    .first();
  return !!existente;
}

// Gera o lançamento do mês e, se era a última parcela, marca a recorrência
// como concluída (ativa: false) pra ela parar de gerar sozinha. Devolve
// `true` se a recorrência acabou de ser concluída (sinal pra quem chamou
// parar o loop de meses).
async function gerarLancamentoDoMes(recorrencia, ano, mes) {
  const jaExiste = await jaGerouEsteMes(recorrencia.id, ano, mes);
  if (jaExiste) return false;

  const jaGeradas = await db.entries.where('recorrenciaId').equals(recorrencia.id).count();
  const numeroParcela = jaGeradas + 1;
  const ehParcelada = !!recorrencia.totalParcelas;

  await db.entries.add({
    tipo: recorrencia.tipo,
    valor: recorrencia.valor,
    data: montarDataISO(ano, mes, recorrencia.diaDoMes),
    categoriaId: recorrencia.categoriaId,
    subcategoriaId: recorrencia.subcategoriaId ?? null,
    contaId: recorrencia.contaId ?? null,
    nota: recorrencia.nota || '',
    origem: 'manual',
    externalId: null,
    recorrenciaId: recorrencia.id,
    numeroParcela: ehParcelada ? numeroParcela : null,
    criadoEm: new Date().toISOString()
  });

  if (ehParcelada && numeroParcela >= recorrencia.totalParcelas) {
    await db.recorrencias.update(recorrencia.id, { ativa: false });
    return true;
  }
  return false;
}

function proximoMes(ano, mes) {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

// Roda no início do app: para cada recorrência ativa, gera todos os meses
// que faltam entre a última geração e o mês atual (inclusive) — parando
// antes se a última parcela for atingida no meio do caminho.
export async function gerarLancamentosPendentes() {
  const todas = await db.recorrencias.toArray();
  // `ativa` não é indexado de propósito: booleano não é uma chave válida de
  // índice no IndexedDB, então filtramos em memória (a lista é sempre
  // pequena — poucas recorrências por pessoa).
  const ativas = todas.filter((r) => r.ativa);
  const chaveAtual = anoMesAtualChave();
  const { ano: anoAtual, mes: mesAtual } = anoMesDe(`${chaveAtual}-01`);

  for (const recorrencia of ativas) {
    let { ano, mes } = recorrencia.ultimaGeracao
      ? anoMesDe(`${recorrencia.ultimaGeracao}-01`)
      : anoMesDe(recorrencia.dataInicio);

    // Se ainda não gerou nada, começa no próprio mês de início; senão,
    // continua a partir do mês seguinte ao último gerado.
    if (recorrencia.ultimaGeracao) {
      ({ ano, mes } = proximoMes(ano, mes));
    }

    let seguranca = 0; // evita loop infinito em caso de dado corrompido
    while ((ano < anoAtual || (ano === anoAtual && mes <= mesAtual)) && seguranca < 600) {
      const concluiu = await gerarLancamentoDoMes(recorrencia, ano, mes);
      await db.recorrencias.update(recorrencia.id, { ultimaGeracao: `${ano}-${String(mes).padStart(2, '0')}` });
      if (concluiu) break; // última parcela gerada — não continua pros meses seguintes
      ({ ano, mes } = proximoMes(ano, mes));
      seguranca++;
    }
  }
}

export async function alternarRecorrencia(id, ativa) {
  await db.recorrencias.update(id, { ativa });
}

// Exclui só a DEFINIÇÃO da recorrência — os lançamentos já gerados
// permanecem no histórico (são fatos que já aconteceram), só para de gerar
// novos a partir daqui.
export async function excluirRecorrencia(id) {
  await db.recorrencias.delete(id);
}
