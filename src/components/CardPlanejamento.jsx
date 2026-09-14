import { useMemo, useState } from 'react';
import { useLiveQuery } from '../db/useLiveQuery';
import { db } from '../db/db';
import { formatCurrency, hojeISO } from '../utils/format';
import { contaTemSaldoControlado, calcularSaldoConta } from '../db/saldos';

// ---------------------------------------------------------------------------
// Cascata: a renda do mês é alocada em ORDEM de prioridade — cada balde
// pega o que precisa (até seu limite), o resto desce pro próximo:
//
//   1. Investimento — % da renda OU um valor fixo em R$ (o usuário escolhe
//      qual dos dois usar, editando o campo correspondente em Perfil)
//   2. Reserva de emergência — até atingir a meta (meses × despesa mensal
//      ESTIMADA, um valor que você define direto em Perfil > Planejamento —
//      não uma média calculada do histórico de lançamentos)
//   3. Dívidas — soma das parcelas mensais das dívidas ainda não quitadas
//   4. Necessidade/Desejo — não geram lançamento nenhum: é o dinheiro que já
//      fica na conta principal e é gasto normalmente, como sempre foi.
//      "Sobra Livre" (o que resta depois de 1-3) é só a referência de
//      quanto dá pra gastar sem tocar na reserva nem pular parcela.
//
// Cada balde é CAPADO pelo que sobrou do anterior — é uma cascata de
// verdade, não três cálculos independentes contra a renda cheia. Só o
// Investimento pode "faltar renda" (se for valor fixo maior que a renda do
// mês): nesse caso os baldes seguintes zeram e o card avisa.
// ---------------------------------------------------------------------------

function calcularCascata({ renda, modoInvestimento, percentInvestimento, valorFixoInvestimento, reservaAtual, mesesReserva, despesaMensalEstimada, dividasAtivas }) {
  const aporteInvestimento = modoInvestimento === 'fixo' ? valorFixoInvestimento : renda * (percentInvestimento / 100);
  const restanteAposInvestimento = Math.max(0, renda - aporteInvestimento);
  const investimentoEstourouRenda = aporteInvestimento > renda;

  const metaReserva = mesesReserva * despesaMensalEstimada;
  const faltanteReserva = Math.max(0, metaReserva - reservaAtual);
  const aporteReserva = Math.min(restanteAposInvestimento, faltanteReserva);
  const restanteAposReserva = restanteAposInvestimento - aporteReserva;

  const totalParcelas = dividasAtivas.reduce((soma, d) => soma + Math.min(d.parcelaMensal, d.valorTotal - d.valorPago), 0);
  const pagamentoDividas = Math.min(restanteAposReserva, totalParcelas);
  const sobraLivre = restanteAposReserva - pagamentoDividas;

  return { metaReserva, faltanteReserva, aporteReserva, pagamentoDividas, aporteInvestimento, sobraLivre, investimentoEstourouRenda };
}

export default function CardPlanejamento({ mes, renda, entradas, contas }) {
  const dividasTodas = useLiveQuery(() => db.dividas.toArray(), []) || [];
  const registroMetas = useLiveQuery(() => db.configuracoes.where('chave').equals('metasCascata').first(), []);
  const metas = registroMetas
    ? JSON.parse(registroMetas.valor)
    : { mesesReserva: 6, despesaMensalEstimada: 0, percentInvestimento: 10, valorFixoInvestimento: 0, modoInvestimento: 'percent' };

  const [confirmando, setConfirmando] = useState(false);
  const [contaOrigemId, setContaOrigemId] = useState(null);
  const [toast, setToast] = useState('');

  const dividasAtivas = useMemo(() => dividasTodas.filter((d) => d.valorTotal - d.valorPago > 0.01), [dividasTodas]);

  const contasReserva = useMemo(() => contas.filter((c) => c.reservaEmergencia === true), [contas]);
  const reservaAtual = useMemo(
    () => contasReserva.reduce((soma, c) => soma + (contaTemSaldoControlado(c) ? calcularSaldoConta(c, entradas) : 0), 0),
    [contasReserva, entradas]
  );

  const cascata = useMemo(
    () => calcularCascata({
      renda,
      modoInvestimento: metas.modoInvestimento,
      percentInvestimento: metas.percentInvestimento,
      valorFixoInvestimento: metas.valorFixoInvestimento,
      reservaAtual,
      mesesReserva: metas.mesesReserva,
      despesaMensalEstimada: metas.despesaMensalEstimada,
      dividasAtivas
    }),
    [renda, reservaAtual, metas, dividasAtivas]
  );

  async function confirmarAlocacao() {
    if (!contaOrigemId) return;
    const agora = new Date().toISOString();
    const dataHoje = hojeISO();

    if (cascata.aporteReserva > 0 && contasReserva.length > 0) {
      // Mais de uma conta marcada como reserva: o aporte todo vai pra
      // primeira (por ordem) — dividir entre várias é refinamento futuro.
      await db.entries.add({
        tipo: 'transferencia',
        valor: cascata.aporteReserva,
        data: dataHoje,
        categoriaId: null,
        subcategoriaId: null,
        contaId: contaOrigemId,
        contaDestinoId: contasReserva[0].id,
        cartaoId: null,
        nota: 'Aporte reserva de emergência (planejamento)',
        pagamentoFaturaChave: null,
        origem: 'manual',
        externalId: null,
        recorrenciaId: null,
        criadoEm: agora
      });
    }

    for (const divida of dividasAtivas) {
      const parcela = Math.min(divida.parcelaMensal, divida.valorTotal - divida.valorPago);
      if (parcela <= 0) continue;
      await db.entries.add({
        tipo: 'despesa',
        valor: parcela,
        data: dataHoje,
        categoriaId: null,
        subcategoriaId: null,
        contaId: contaOrigemId,
        formaPagamento: 'debito',
        nota: `Parcela: ${divida.nome} (planejamento)`,
        origem: 'manual',
        externalId: null,
        recorrenciaId: null,
        criadoEm: agora
      });
      await db.dividas.update(divida.id, { valorPago: divida.valorPago + parcela });
    }

    if (cascata.aporteInvestimento > 0) {
      await db.entries.add({
        tipo: 'investimento',
        valor: cascata.aporteInvestimento,
        data: dataHoje,
        categoriaId: null,
        subcategoriaId: null,
        contaId: contaOrigemId,
        nota: 'Aporte mensal (planejamento)',
        origem: 'manual',
        externalId: null,
        recorrenciaId: null,
        criadoEm: agora
      });
    }

    setConfirmando(false);
    setToast('Alocação do mês confirmada ✓');
  }

  if (mes === 0) {
    return <p className="vazio">Selecione um mês específico pra ver o planejamento — a cascata é sempre mensal.</p>;
  }
  if (metas.despesaMensalEstimada <= 0) {
    return <p className="vazio">Defina sua despesa mensal estimada em Perfil → Planejamento pra calcular a meta de reserva.</p>;
  }

  return (
    <div className="chart-box planejamento-box">
      <div className="planejamento-linha">
        <span>Renda do mês</span>
        <strong>{formatCurrency(renda)}</strong>
      </div>

      <div className="planejamento-linha">
        <span>
          Investimento ({metas.modoInvestimento === 'fixo' ? 'valor fixo' : `${metas.percentInvestimento}% da renda`})
        </span>
        <strong>−{formatCurrency(cascata.aporteInvestimento)}</strong>
      </div>

      <div className="planejamento-linha">
        <span>
          Reserva de emergência
          {cascata.faltanteReserva <= 0 && <span className="fatura-tag fatura-tag-positivo" style={{ marginLeft: 6 }}>Meta atingida</span>}
        </span>
        <strong>−{formatCurrency(cascata.aporteReserva)}</strong>
      </div>
      <p className="repeticao-explicacao" style={{ margin: '-4px 0 4px' }}>
        Meta: {formatCurrency(cascata.metaReserva)} ({metas.mesesReserva}× a despesa mensal estimada) · atual: {formatCurrency(reservaAtual)}
      </p>

      {dividasAtivas.length > 0 && (
        <div className="planejamento-linha">
          <span>Dívidas ({dividasAtivas.length})</span>
          <strong>−{formatCurrency(cascata.pagamentoDividas)}</strong>
        </div>
      )}

      <div className="planejamento-linha planejamento-linha-final">
        <span>Sobra Livre</span>
        <strong style={{ color: 'var(--green)' }}>{formatCurrency(cascata.sobraLivre)}</strong>
      </div>

      {cascata.investimentoEstourouRenda && (
        <p className="aviso-fatura aviso-fatura-atrasada" style={{ margin: 0 }}>
          O valor fixo de investimento ({formatCurrency(cascata.aporteInvestimento)}) é maior que a renda do mês —
          não sobra nada pra Reserva, Dívidas ou Sobra Livre.
        </p>
      )}

      {!confirmando ? (
        <button type="button" className="btn-primary" style={{ marginTop: 8 }} onClick={() => setConfirmando(true)}>
          Confirmar alocação do mês
        </button>
      ) : (
        <div className="fatura-pagar-form">
          <div className="field">
            <label>De qual conta sai (reserva, dívidas e investimento)</label>
            <select value={contaOrigemId ?? ''} onChange={(e) => setContaOrigemId(e.target.value || null)}>
              <option value="">Selecione a conta</option>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="edit-actions">
            <button type="button" className="btn-cancel" onClick={() => setConfirmando(false)}>Cancelar</button>
            <button type="button" className="btn-primary" disabled={!contaOrigemId} onClick={confirmarAlocacao}>
              Confirmar
            </button>
          </div>
        </div>
      )}

      {toast && <p className="mensagem">{toast}</p>}
    </div>
  );
}
