import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { db } from '../db/db';
import { TIPOS, CORES_CATEGORIAS } from '../db/defaultData';
import { formatCurrency, NOMES_MESES, anoMesDe } from '../utils/format';
import AllocationBar from '../components/AllocationBar';

export default function Resumo() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(0); // 0 = ano inteiro

  const entradas = useLiveQuery(() => db.entries.toArray(), []) || [];
  const categorias = useLiveQuery(() => db.categorias.toArray(), []) || [];
  const categoriaPorId = useMemo(() => Object.fromEntries(categorias.map((c) => [c.id, c])), [categorias]);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set(entradas.map((e) => anoMesDe(e.data).ano));
    anos.add(new Date().getFullYear());
    return Array.from(anos).sort((a, b) => b - a);
  }, [entradas]);

  const entradasDoAno = useMemo(
    () => entradas.filter((e) => anoMesDe(e.data).ano === ano),
    [entradas, ano]
  );

  const entradasDoPeriodo = useMemo(
    () => entradasDoAno.filter((e) => mes === 0 || anoMesDe(e.data).mes === mes),
    [entradasDoAno, mes]
  );

  function somaPorTipo(lista, tipo) {
    return lista.filter((e) => e.tipo === tipo).reduce((acc, e) => acc + e.valor, 0);
  }

  const totalReceitas = somaPorTipo(entradasDoPeriodo, 'receita');
  const totalDespesas = somaPorTipo(entradasDoPeriodo, 'despesa');
  const totalInvestimentos = somaPorTipo(entradasDoPeriodo, 'investimento');
  const saldo = totalReceitas - totalDespesas - totalInvestimentos;

  const percentGasta = totalReceitas > 0 ? (totalDespesas / totalReceitas) * 100 : 0;
  const percentInvestida = totalReceitas > 0 ? (totalInvestimentos / totalReceitas) * 100 : 0;

  // Gráfico de barras: totais mês a mês, para o ano selecionado inteiro
  const dadosBarras = useMemo(() => {
    return NOMES_MESES.map((nomeMes, idx) => {
      const doMes = entradasDoAno.filter((e) => anoMesDe(e.data).mes === idx + 1);
      return {
        mes: nomeMes.slice(0, 3),
        Receita: somaPorTipo(doMes, 'receita'),
        Despesa: somaPorTipo(doMes, 'despesa'),
        Investimento: somaPorTipo(doMes, 'investimento')
      };
    });
  }, [entradasDoAno]);

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

  return (
    <div className="page">
      <h1>Resumo</h1>

      <div className="filtros">
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          <option value={0}>Ano inteiro</option>
          {NOMES_MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
        </select>
      </div>

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

      <h2>Receitas x Despesas x Investimentos — {ano}</h2>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={dadosBarras}>
            <XAxis dataKey="mes" fontSize={12} />
            <YAxis fontSize={12} width={40} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="Receita" fill={TIPOS.receita.cor} />
            <Bar dataKey="Despesa" fill={TIPOS.despesa.cor} />
            <Bar dataKey="Investimento" fill={TIPOS.investimento.cor} />
          </BarChart>
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
    </div>
  );
}
