import { TIPOS } from '../db/defaultData';
import { formatCurrency, NOMES_MESES } from '../utils/format';
import { useResumoFinanceiro } from '../hooks/useResumoFinanceiro';
import AllocationBar from '../components/AllocationBar';
import Faturas from '../components/Faturas';

// Tela de Resumo: números essenciais do período (receitas/despesas/
// investimentos/saldo), saldo por conta e faturas em aberto. Métricas
// mais detalhadas e gráficos ficam no Dashboard (aba própria) — ver
// src/hooks/useResumoFinanceiro.js pra lógica compartilhada entre as duas.
export default function Resumo() {
  const {
    ano, setAno, mes, setMes, anosDisponiveis,
    entradas, recorrencias, excecoesValor, contas,
    contasComSaldo, contasSemSaldo,
    temPrevistoNoPeriodo,
    totalReceitas, totalDespesas, totalInvestimentos, saldo, percentGasta, percentInvestida
  } = useResumoFinanceiro();

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

      {contasComSaldo.length > 0 && (
        <>
          <h2>Saldo por conta</h2>
          <div className="chart-box fatura-lista">
            {contasComSaldo.map((c) => {
              const positivo = c.saldoAtual >= 0;
              return (
                <div key={c.id} className="fatura-item-bloco">
                  <div className="fatura-item">
                    <div className="fatura-mes">{c.nome}</div>
                    <div className="fatura-direita">
                      <span className={`fatura-tag ${positivo ? 'fatura-tag-positivo' : 'fatura-tag-negativo'}`}>
                        {positivo ? 'Positivo' : 'Negativo'}
                      </span>
                      <strong style={{ color: positivo ? TIPOS.receita.cor : TIPOS.despesa.cor }}>
                        {formatCurrency(c.saldoAtual)}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {contasSemSaldo.length > 0 && (
            <p className="aviso-previsao">
              {contasSemSaldo.length === 1
                ? `1 conta sem saldo informado (${contasSemSaldo[0].nome})`
                : `${contasSemSaldo.length} contas sem saldo informado`}
              {' — configure em Perfil → Contas.'}
            </p>
          )}
        </>
      )}

      <Faturas contas={contas} entradas={entradas} recorrencias={recorrencias} excecoesValor={excecoesValor} />
    </div>
  );
}
