import { useState, useMemo } from 'react';
import { useLiveQuery } from '../db/useLiveQuery';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { db } from '../db/db';
import { TIPOS, CORES_CATEGORIAS } from '../db/defaultData';
import { formatCurrency, NOMES_MESES, anoMesDe } from '../utils/format';
import { projetarTodasAsRecorrencias } from '../db/recorrencias';
import { contaTemSaldoControlado, calcularSaldoConta } from '../db/saldos';
import AllocationBar from '../components/AllocationBar';
import { IconFile } from '../components/Icons';

export default function Resumo({ onAbrirFaturas }) {
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

  function somaPorTipo(lista, tipo) {
    return lista.filter((e) => e.tipo === tipo).reduce((acc, e) => acc + e.valor, 0);
  }

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
  // "ano inteiro" selecionado, ficam escondidas (ver JSX mais abaixo).

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

  return (
    <div className="page">
      <h1>Resumo</h1>

      <button type="button" className="link-faturas" onClick={onAbrirFaturas}>
        <IconFile size={15} /> Ver faturas de cartão
      </button>

      <div className="filtros">
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          <option value={0}>Ano inteiro</option>
          {NOMES_MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
        </select>
      </div>

      {temPrevistoNoPeriodo && (
        <p className="aviso-previsao">
          Inclui lançamentos fixos previstos (ainda não realizados) para meses futuros.
        </p>
      )}

      <div className="kpi-panel">
        <div className="kpi-cell">
          <span className="kpi-label">Receitas</span>
          <span className="kpi-valor" style={{ color: TIPOS.receita.cor }}>{formatCurrency(totalReceitas)}</span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">Despesas</span>
          <span className="kpi-valor" style={{ color: TIPOS.despesa.cor }}>{formatCurrency(totalDespesas)}</span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">Investimentos</span>
          <span className="kpi-valor" style={{ color: TIPOS.investimento.cor }}>{formatCurrency(totalInvestimentos)}</span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">Saldo</span>
          <span className="kpi-valor" style={{ color: saldo >= 0 ? TIPOS.receita.cor : TIPOS.despesa.cor }}>
            {formatCurrency(saldo)}
          </span>
        </div>
      </div>

      <div className="chart-box allocation-box">
        <AllocationBar percentGasta={percentGasta} percentInvestida={percentInvestida} />
      </div>

      {mes !== 0 && (
        <>
          <h2>Métricas</h2>
          <div className="metricas-grid">
            <div className="metrica-card">
              <span className="metrica-label">Vs. mês anterior</span>
              {variacaoDespesa === null ? (
                <span className="metrica-valor metrica-neutra">Sem dados suficientes</span>
              ) : (
                <span className="metrica-valor" style={{ color: variacaoDespesa > 0 ? TIPOS.despesa.cor : TIPOS.receita.cor }}>
                  Despesas {variacaoDespesa > 0 ? '↑' : '↓'} {Math.abs(variacaoDespesa).toFixed(0)}%
                </span>
              )}
            </div>

            <div className="metrica-card">
              <span className="metrica-label">Sequência no azul</span>
              <span className="metrica-valor" style={{ color: sequenciaPositiva > 0 ? TIPOS.receita.cor : 'var(--text)' }}>
                {sequenciaPositiva > 0 ? `${sequenciaPositiva} ${sequenciaPositiva === 1 ? 'mês' : 'meses'}` : '—'}
              </span>
            </div>

            <div className="metrica-card">
              <span className="metrica-label">Maior categoria de gasto</span>
              {maiorCategoria ? (
                <span className="metrica-valor metrica-neutra">
                  {maiorCategoria.nome} · {maiorCategoriaPercent.toFixed(0)}%
                </span>
              ) : (
                <span className="metrica-valor metrica-neutra">—</span>
              )}
            </div>

            <div className="metrica-card">
              <span className="metrica-label">Maior lançamento do mês</span>
              {maiorLancamento ? (
                <span className="metrica-valor metrica-neutra">
                  {categoriaPorId[maiorLancamento.categoriaId]?.nome || '—'} · {formatCurrency(maiorLancamento.valor)}
                </span>
              ) : (
                <span className="metrica-valor metrica-neutra">—</span>
              )}
            </div>

            {percentualFixo !== null && (
              <div className="metrica-card metrica-card-wide">
                <span className="metrica-label">Despesas fixas vs. variáveis</span>
                <div className="orcamento-barra" style={{ margin: '6px 0' }}>
                  <div className="orcamento-barra-fill" style={{ width: `${percentualFixo}%`, background: 'var(--blue)' }} />
                </div>
                <span className="metrica-valor metrica-neutra" style={{ fontSize: 13 }}>
                  {percentualFixo.toFixed(0)}% fixo · {(100 - percentualFixo).toFixed(0)}% variável
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {contasComSaldo.length > 0 && (
        <>
          <h2>Saldo por conta</h2>
          <div className="chart-box saldo-contas-lista">
            {contasComSaldo.map((c) => (
              <div key={c.id} className="saldo-conta-linha">
                <span>{c.nome}</span>
                <strong style={{ color: c.saldoAtual >= 0 ? TIPOS.receita.cor : TIPOS.despesa.cor }}>
                  {formatCurrency(c.saldoAtual)}
                </strong>
              </div>
            ))}
          </div>
        </>
      )}

      <h2>Receitas x Despesas x Investimentos — {ano}</h2>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={dadosBarras}>
            <XAxis dataKey="mes" fontSize={12} />
            <YAxis fontSize={12} width={40} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="Receita" fill={TIPOS.receita.cor} />
            <Bar dataKey="Despesa" fill={TIPOS.despesa.cor} />
            <Bar dataKey="Investimento" fill={TIPOS.investimento.cor} />
            <Line type="monotone" dataKey="Média despesa (3m)" stroke="var(--text-tertiary)" strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <h2>Divisão de despesas por categoria</h2>
      {dadosPizza.length === 0 ? (
        <p className="vazio">Sem despesas neste período.</p>
      ) : (
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={dadosPizza}
                dataKey="valor"
                nameKey="nome"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ nome, percent }) => `${nome} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                fontSize={11}
              >
                {dadosPizza.map((_, idx) => (
                  <Cell key={idx} fill={CORES_CATEGORIAS[idx % CORES_CATEGORIAS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {orcamentos.length > 0 && (
        <>
          <h2>Orçamento por categoria</h2>
          {mes === 0 ? (
            <p className="vazio">Selecione um mês específico para acompanhar o orçamento.</p>
          ) : (
            <div className="chart-box orcamento-lista">
              {temPrevistoNoPeriodo && (
                <p className="aviso-previsao aviso-previsao-inline">Valores incluem previsão de lançamentos fixos.</p>
              )}
              {orcamentosComGasto.map((o) => {
                const percentual = o.limite > 0 ? Math.min(100, (o.gasto / o.limite) * 100) : 0;
                const estourou = o.gasto > o.limite;
                return (
                  <div key={o.id} className="orcamento-item">
                    <div className="orcamento-topo">
                      <span>{o.nomeCategoria}</span>
                      <span style={{ color: estourou ? 'var(--red)' : 'var(--text-secondary)' }}>
                        {formatCurrency(o.gasto)} / {formatCurrency(o.limite)}
                      </span>
                    </div>
                    <div className="orcamento-barra">
                      <div
                        className="orcamento-barra-fill"
                        style={{ width: `${percentual}%`, background: estourou ? 'var(--red)' : 'var(--blue)' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
