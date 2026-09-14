import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { TIPOS, CORES_CATEGORIAS } from '../db/defaultData';
import { formatCurrency, NOMES_MESES } from '../utils/format';
import { useResumoFinanceiro } from '../hooks/useResumoFinanceiro';

// Métricas e gráficos mais detalhados — separado do Resumo (que ficou só
// com os números essenciais) pra não sobrecarregar uma tela só. Usa o
// mesmo hook de cálculo, mas com seu próprio filtro de ano/mês (não é
// compartilhado com o Resumo — cada tela lembra o que você escolheu nela).
export default function Dashboard() {
  const {
    ano, setAno, mes, setMes, anosDisponiveis,
    categoriaPorId, temPrevistoNoPeriodo,
    dadosBarras, dadosPizza, orcamentosComGasto,
    variacaoDespesa, sequenciaPositiva, maiorCategoria, maiorCategoriaPercent, maiorLancamento, percentualFixo
  } = useResumoFinanceiro();

  return (
    <div className="page">
      <h1>Dashboard</h1>

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

      {orcamentosComGasto.length > 0 && (
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
