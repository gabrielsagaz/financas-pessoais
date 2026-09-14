import { useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip, Legend
} from 'recharts';
import { useLiveQuery } from '../db/useLiveQuery';
import { TIPOS } from '../db/defaultData';
import { formatCurrency, NOMES_MESES } from '../utils/format';
import { useResumoFinanceiro } from '../hooks/useResumoFinanceiro';
import { db } from '../db/db';
import { salvarMetas, metasPadrao } from '../db/preferencias';

// Barras horizontais pra divisão por categoria (despesa/receita/
// investimento) — mesmo estilo pros três, cor única por seção (como na
// planilha antiga: gasto é vermelho, receita é verde, investimento é
// dourado — não uma cor por categoria).
function GraficoCategorias({ dados, cor }) {
  if (dados.length === 0) return <p className="vazio">Sem lançamentos neste período.</p>;
  const altura = Math.max(140, dados.length * 40 + 40);
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" fontSize={12} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
          <YAxis type="category" dataKey="nome" fontSize={12} width={100} />
          <Tooltip formatter={(v) => formatCurrency(v)} />
          <Bar dataKey="valor" fill={cor} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Meta de % da renda gasta/investida, comparada com o percentual real do
// período — mesmo conceito que já existia na planilha antiga. A meta é
// editável direto aqui e fica salva pra sempre (não é por período).
function CardMeta({ label, metaAtual, onSalvarMeta, percentReal, corBoa, quantoMenorMelhor }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(metaAtual ?? '');

  async function salvar() {
    const numero = valor === '' ? null : Math.min(100, Math.max(0, Number(valor)));
    await onSalvarMeta(numero);
    setEditando(false);
  }

  const dentroDaMeta = metaAtual == null
    ? null
    : quantoMenorMelhor ? percentReal <= metaAtual : percentReal >= metaAtual;

  return (
    <div className="metrica-card metrica-card-wide">
      <div className="orcamento-topo">
        <span className="metrica-label">{label}</span>
        {!editando ? (
          <button type="button" className="botao-link" style={{ fontSize: 13 }} onClick={() => setEditando(true)}>
            {metaAtual == null ? 'Definir meta' : `Meta: ${metaAtual}%`}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number"
              min="0"
              max="100"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              style={{ width: 56, textAlign: 'center' }}
              autoFocus
            />
            <button type="button" className="btn-confirm" style={{ padding: '6px 10px' }} onClick={salvar}>OK</button>
          </div>
        )}
      </div>
      <div className="orcamento-barra" style={{ margin: '6px 0', position: 'relative' }}>
        <div
          className="orcamento-barra-fill"
          style={{ width: `${Math.min(100, percentReal)}%`, background: corDaBarraMeta(dentroDaMeta, corBoa) }}
        />
        {metaAtual != null && (
          <div style={{
            position: 'absolute', top: -2, bottom: -2, left: `${Math.min(100, metaAtual)}%`,
            width: 2, background: 'var(--text)'
          }} />
        )}
      </div>
      <span className="metrica-valor metrica-neutra" style={{ fontSize: 13 }}>
        {percentReal.toFixed(1)}% real{metaAtual != null && ` · meta ${metaAtual}%`}
      </span>
    </div>
  );
}

function corDaBarraMeta(dentroDaMeta, corBoa) {
  if (dentroDaMeta === null) return 'var(--blue)';
  return dentroDaMeta ? corBoa : 'var(--red)';
}

// Métricas e gráficos mais detalhados — separado do Resumo (que ficou só
// com os números essenciais) pra não sobrecarregar uma tela só. Usa o
// mesmo hook de cálculo, mas com seu próprio filtro de ano/mês (não é
// compartilhado com o Resumo — cada tela lembra o que você escolheu nela).
export default function Dashboard() {
  const {
    ano, setAno, mes, setMes, anosDisponiveis,
    categoriaPorId, temPrevistoNoPeriodo,
    dadosBarras, dadosPizza, dadosReceita, dadosInvestimento, orcamentosComGasto,
    percentGasta, percentInvestida,
    variacaoDespesa, sequenciaPositiva, maiorCategoria, maiorCategoriaPercent, maiorLancamento, percentualFixo
  } = useResumoFinanceiro();

  const registroMetas = useLiveQuery(() => db.configuracoes.where('chave').equals('metas').first(), []);
  const metas = registroMetas ? JSON.parse(registroMetas.valor) : metasPadrao();

  async function salvarMetaGasta(percentGastaMeta) {
    await salvarMetas({ ...metas, percentGastaMeta });
  }
  async function salvarMetaInvestida(percentInvestidaMeta) {
    await salvarMetas({ ...metas, percentInvestidaMeta });
  }

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

      <h2>Metas</h2>
      <div className="metricas-grid">
        <CardMeta
          label="% da renda gasta"
          metaAtual={metas.percentGastaMeta}
          onSalvarMeta={salvarMetaGasta}
          percentReal={percentGasta}
          corBoa="var(--green)"
          quantoMenorMelhor
        />
        <CardMeta
          label="% da renda investida"
          metaAtual={metas.percentInvestidaMeta}
          onSalvarMeta={salvarMetaInvestida}
          percentReal={percentInvestida}
          corBoa="var(--green)"
          quantoMenorMelhor={false}
        />
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
      <GraficoCategorias dados={dadosPizza} cor={TIPOS.despesa.cor} />

      <h2>Divisão de receita por categoria</h2>
      <GraficoCategorias dados={dadosReceita} cor={TIPOS.receita.cor} />

      <h2>Divisão de investimentos por categoria</h2>
      <GraficoCategorias dados={dadosInvestimento} cor={TIPOS.investimento.cor} />

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
