import { useState, useMemo } from 'react';
import { useLiveQuery } from '../db/useLiveQuery';
import { db } from '../db/db';
import { NOMES_MESES, anoMesDe } from '../utils/format';
import { projetarTodasAsRecorrencias } from '../db/recorrencias';
import { contaTemSaldoControlado, calcularSaldoConta } from '../db/saldos';

export function somaPorTipo(lista, tipo) {
  return lista.filter((e) => e.tipo === tipo).reduce((acc, e) => acc + e.valor, 0);
}

// Toda a lógica de "resumo financeiro do período selecionado" — usada tanto
// pela tela de Resumo (números essenciais + saldo por conta) quanto pelo
// Dashboard (métricas e gráficos). Extraído pra um hook só pra não duplicar
// esses cálculos entre as duas telas.
export function useResumoFinanceiro() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1); // padrão: mês atual

  const entradas = useLiveQuery(() => db.entries.toArray(), []) || [];
  const categorias = useLiveQuery(() => db.categorias.toArray(), []) || [];
  const orcamentos = useLiveQuery(() => db.orcamentos.toArray(), []) || [];
  const recorrencias = useLiveQuery(() => db.recorrencias.toArray(), []) || [];
  const excecoesValor = useLiveQuery(() => db.excecoesValor.toArray(), []) || [];
  const contas = useLiveQuery(() => db.contas.orderBy('ordem').toArray(), []) || [];
  const categoriaPorId = useMemo(() => Object.fromEntries(categorias.map((c) => [c.id, c])), [categorias]);

  // Saldo por conta é sempre "agora" (não depende do filtro ano/mês da
  // tela) — calculado a partir de TODOS os lançamentos reais, ignorando
  // previstos (que ainda não aconteceram de verdade).
  const contasComSaldo = useMemo(
    () => contas
      .filter(contaTemSaldoControlado)
      .map((c) => ({ ...c, saldoAtual: calcularSaldoConta(c, entradas) })),
    [contas, entradas]
  );
  const contasSemSaldo = useMemo(() => contas.filter((c) => !contaTemSaldoControlado(c)), [contas]);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set(entradas.map((e) => anoMesDe(e.data).ano));
    anos.add(new Date().getFullYear());
    return Array.from(anos).sort((a, b) => b - a);
  }, [entradas]);

  // Previsão dos lançamentos fixos futuros (até dez/{ano} ou até o mês
  // selecionado, o que for menor) — nunca gravada no banco, só somada aos
  // números pra dar visão do que ainda vem no período escolhido. Cada item
  // sai marcado com `previsto: true`.
  const previsoes = useMemo(
    () => projetarTodasAsRecorrencias(recorrencias, entradas, excecoesValor, ano, mes === 0 ? 12 : mes),
    [recorrencias, entradas, excecoesValor, ano, mes]
  );

  const entradasDoAno = useMemo(
    () => [...entradas.filter((e) => anoMesDe(e.data).ano === ano), ...previsoes.filter((p) => anoMesDe(p.data).ano === ano)],
    [entradas, previsoes, ano]
  );

  const entradasDoPeriodo = useMemo(
    () => entradasDoAno.filter((e) => mes === 0 || anoMesDe(e.data).mes === mes),
    [entradasDoAno, mes]
  );

  const temPrevistoNoPeriodo = useMemo(() => entradasDoPeriodo.some((e) => e.previsto), [entradasDoPeriodo]);

  const totalReceitas = somaPorTipo(entradasDoPeriodo, 'receita');
  const totalDespesas = somaPorTipo(entradasDoPeriodo, 'despesa');
  const totalInvestimentos = somaPorTipo(entradasDoPeriodo, 'investimento');
  const saldo = totalReceitas - totalDespesas - totalInvestimentos;

  const percentGasta = totalReceitas > 0 ? (totalDespesas / totalReceitas) * 100 : 0;
  const percentInvestida = totalReceitas > 0 ? (totalInvestimentos / totalReceitas) * 100 : 0;

  // Gráfico de barras: totais mês a mês, para o ano selecionado inteiro —
  // acompanhado da média móvel de despesa dos 3 meses anteriores a cada
  // mês (linha de referência, calculada sobre TODOS os lançamentos reais,
  // não só os do ano selecionado, pra não zerar em janeiro/fevereiro).
  const dadosBarras = useMemo(() => {
    return NOMES_MESES.map((nomeMes, idx) => {
      const mesNum = idx + 1;
      const doMes = entradasDoAno.filter((e) => anoMesDe(e.data).mes === mesNum);

      let a = ano;
      let m = mesNum;
      let somaMedia = 0;
      let countMedia = 0;
      for (let i = 0; i < 3; i++) {
        m -= 1;
        if (m === 0) { m = 12; a -= 1; }
        const doMesAnt = entradas.filter((e) => { const d = anoMesDe(e.data); return d.ano === a && d.mes === m; });
        if (doMesAnt.length > 0) { somaMedia += somaPorTipo(doMesAnt, 'despesa'); countMedia++; }
      }

      return {
        mes: nomeMes.slice(0, 3),
        Receita: somaPorTipo(doMes, 'receita'),
        Despesa: somaPorTipo(doMes, 'despesa'),
        Investimento: somaPorTipo(doMes, 'investimento'),
        'Média despesa (3m)': countMedia > 0 ? Math.round(somaMedia / countMedia) : null
      };
    });
  }, [entradasDoAno, entradas, ano]);

  // Gráfico de pizza: divisão de despesas por categoria no período selecionado
  const dadosPizza = useMemo(() => {
    const despesas = entradasDoPeriodo.filter((e) => e.tipo === 'despesa');
    const porCategoria = {};
    for (const e of despesas) {
      const nome = categoriaPorId[e.categoriaId]?.nome || 'Outros';
      porCategoria[nome] = (porCategoria[nome] || 0) + e.valor;
    }
    return Object.entries(porCategoria)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [entradasDoPeriodo, categoriaPorId]);

  // Mesma lógica do gráfico de despesas por categoria, mas pra receita e
  // investimento — "de onde veio o dinheiro" e "pra onde foi investido",
  // não só "pra onde foi gasto".
  function dividirPorCategoria(tipo) {
    const doTipo = entradasDoPeriodo.filter((e) => e.tipo === tipo);
    const porCategoria = {};
    for (const e of doTipo) {
      const nome = categoriaPorId[e.categoriaId]?.nome || 'Outros';
      porCategoria[nome] = (porCategoria[nome] || 0) + e.valor;
    }
    return Object.entries(porCategoria)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }
  const dadosReceita = useMemo(() => dividirPorCategoria('receita'), [entradasDoPeriodo, categoriaPorId]);
  const dadosInvestimento = useMemo(() => dividirPorCategoria('investimento'), [entradasDoPeriodo, categoriaPorId]);

  // Orçamento por categoria: só faz sentido comparar com um mês específico
  // (o limite é mensal — comparar com "ano inteiro" distorceria a conta).
  const totalDespesaPorCategoriaId = useMemo(() => {
    const mapa = {};
    for (const e of entradasDoPeriodo) {
      if (e.tipo !== 'despesa') continue;
      mapa[e.categoriaId] = (mapa[e.categoriaId] || 0) + e.valor;
    }
    return mapa;
  }, [entradasDoPeriodo]);

  const orcamentosComGasto = useMemo(() => {
    return orcamentos
      .map((o) => ({
        ...o,
        nomeCategoria: categoriaPorId[o.categoriaId]?.nome || '—',
        gasto: totalDespesaPorCategoriaId[o.categoriaId] || 0
      }))
      .sort((a, b) => (b.gasto / b.limite) - (a.gasto / a.limite));
  }, [orcamentos, totalDespesaPorCategoriaId, categoriaPorId]);

  // ------------------------- Métricas do dashboard -------------------------
  // Só fazem sentido comparando um mês específico com o histórico — com
  // "ano inteiro" selecionado, ficam escondidas (ver JSX de cada tela).

  const mesAnterior = useMemo(() => {
    if (mes === 0) return null;
    const anoAnt = mes === 1 ? ano - 1 : ano;
    const mesAnt = mes === 1 ? 12 : mes - 1;
    const doMesAnterior = entradas.filter((e) => { const d = anoMesDe(e.data); return d.ano === anoAnt && d.mes === mesAnt; });
    return { despesa: somaPorTipo(doMesAnterior, 'despesa'), temDados: doMesAnterior.length > 0 };
  }, [entradas, ano, mes]);

  const variacaoDespesa = mesAnterior?.temDados && mesAnterior.despesa > 0
    ? ((totalDespesas - mesAnterior.despesa) / mesAnterior.despesa) * 100
    : null;

  const maiorCategoria = dadosPizza[0] || null;
  const maiorCategoriaPercent = maiorCategoria && totalDespesas > 0 ? (maiorCategoria.valor / totalDespesas) * 100 : 0;

  const maiorLancamento = useMemo(() => {
    const despesas = entradasDoPeriodo.filter((e) => e.tipo === 'despesa' && !e.previsto);
    if (despesas.length === 0) return null;
    return despesas.reduce((maior, e) => (e.valor > maior.valor ? e : maior), despesas[0]);
  }, [entradasDoPeriodo]);

  const sequenciaPositiva = useMemo(() => {
    if (mes === 0) return 0;
    let streak = 0;
    let a = ano;
    let m = mes;
    for (let i = 0; i < 24; i++) {
      const doMes = entradas.filter((e) => { const d = anoMesDe(e.data); return d.ano === a && d.mes === m; });
      if (doMes.length === 0) break;
      const r = somaPorTipo(doMes, 'receita');
      const d = somaPorTipo(doMes, 'despesa');
      const inv = somaPorTipo(doMes, 'investimento');
      if (r - d - inv <= 0) break;
      streak++;
      m -= 1;
      if (m === 0) { m = 12; a -= 1; }
    }
    return streak;
  }, [entradas, ano, mes]);

  const percentualFixo = useMemo(() => {
    const despesas = entradasDoPeriodo.filter((e) => e.tipo === 'despesa');
    const total = despesas.reduce((acc, e) => acc + e.valor, 0);
    if (total === 0) return null;
    const fixo = despesas.filter((e) => e.recorrenciaId).reduce((acc, e) => acc + e.valor, 0);
    return (fixo / total) * 100;
  }, [entradasDoPeriodo]);

  return {
    ano, setAno, mes, setMes, anosDisponiveis,
    entradas, categorias, orcamentos, recorrencias, excecoesValor, contas, categoriaPorId,
    contasComSaldo, contasSemSaldo,
    entradasDoPeriodo, temPrevistoNoPeriodo,
    totalReceitas, totalDespesas, totalInvestimentos, saldo, percentGasta, percentInvestida,
    dadosBarras, dadosPizza, dadosReceita, dadosInvestimento, orcamentosComGasto,
    variacaoDespesa, sequenciaPositiva, maiorCategoria, maiorCategoriaPercent, maiorLancamento, percentualFixo
  };
}
