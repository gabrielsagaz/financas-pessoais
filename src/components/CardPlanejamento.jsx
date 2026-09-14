import { useMemo, useState } from 'react';
import { useLiveQuery } from '../db/useLiveQuery';
import { db } from '../db/db';
import { formatCurrency, hojeISO } from '../utils/format';
import { contaTemSaldoControlado, calcularSaldoConta } from '../db/saldos';

// ---------------------------------------------------------------------------
// Cascata: a renda do mês é alocada em ORDEM de prioridade — cada balde
// pega o que precisa (até seu limite), o resto desce pro próximo. A ordem
// muda de acordo com a FAIXA em que a reserva de emergência está:
//
//   Reserva ABAIXO da mínima (nem o básico):
//     1. Reserva — prioridade total, tira o que precisar da renda antes
//        até do investimento
//     2. Investimento — o que sobrar, até o valor calculado (% ou fixo)
//
//   Reserva ENTRE mínima e completa:
//     1. Investimento — valor cheio calculado (% ou fixo) sai primeiro
//     2. Dentro desse valor, uma % configurada é DESVIADA pra reserva
//        (o resto continua sendo investimento de verdade) — reversão
//        gradual, não um chaveamento seco
//
//   Reserva COMPLETA:
//     1. Investimento — 100% do valor calculado, nada mais desviado
//
// Depois da Reserva+Investimento, na ordem: Dívidas (parcelas das dívidas
// ativas) → Provisões (aportes mensais dos envelopes) → Sobra Livre (o
// resto — Necessidade/Desejo não geram lançamento, é o dinheiro que já
// fica na conta e é gasto normalmente).
//
// Se o que sobra não for suficiente pra cobrir Dívidas+Provisões no valor
// cheio, os dois são reduzidos PROPORCIONALMENTE (não um "para" o outro) —
// e o card avisa. Só o Investimento (se for valor FIXO maior que a renda)
// pode zerar tudo que vem depois dele.
// ---------------------------------------------------------------------------

function calcularCascata({
  renda, modoInvestimento, percentInvestimento, valorFixoInvestimento,
  reservaAtual, mesesReservaMinima, mesesReservaCompleta, despesaMensalEstimada,
  percentDivisaoReservaInvestimento, dividasAtivas, provisoes
}) {
  const metaMinima = mesesReservaMinima * despesaMensalEstimada;
  const metaCompleta = mesesReservaCompleta * despesaMensalEstimada;
  const aporteInvestimentoBase = modoInvestimento === 'fixo' ? valorFixoInvestimento : renda * (percentInvestimento / 100);
  const investimentoEstourouRenda = aporteInvestimentoBase > renda;

  let aporteReserva = 0;
  let aporteInvestimento = 0;
  let restante;
  let faixaReserva;

  if (reservaAtual < metaMinima) {
    faixaReserva = 'abaixo_minima';
    const faltanteMinima = metaMinima - reservaAtual;
    aporteReserva = Math.min(renda, faltanteMinima);
    const restanteAposReserva = Math.max(0, renda - aporteReserva);
    aporteInvestimento = Math.min(restanteAposReserva, aporteInvestimentoBase);
    restante = restanteAposReserva - aporteInvestimento;
  } else if (reservaAtual < metaCompleta) {
    faixaReserva = 'entre';
    const restanteAposInvestimentoTotal = Math.max(0, renda - aporteInvestimentoBase);
    const desviado = aporteInvestimentoBase * (percentDivisaoReservaInvestimento / 100);
    const faltanteCompleta = metaCompleta - reservaAtual;
    aporteReserva = Math.min(desviado, faltanteCompleta);
    aporteInvestimento = aporteInvestimentoBase - aporteReserva;
    restante = restanteAposInvestimentoTotal;
  } else {
    faixaReserva = 'completa';
    aporteInvestimento = Math.min(renda, aporteInvestimentoBase);
    restante = Math.max(0, renda - aporteInvestimento);
  }

  const totalParcelasDividas = dividasAtivas.reduce((s, d) => s + Math.min(d.parcelaMensal, d.valorTotal - d.valorPago), 0);
  const totalAportesProvisoes = provisoes.reduce((s, p) => s + (p.aporteMensal || 0), 0);
  const totalDividasEProvisoes = totalParcelasDividas + totalAportesProvisoes;

  // Se não sobrar o suficiente pros dois juntos, reduz PROPORCIONALMENTE —
  // nenhum dos dois "ganha" prioridade sobre o outro dentro desse balde.
  const fatorReducao = totalDividasEProvisoes > 0 ? Math.min(1, restante / totalDividasEProvisoes) : 1;
  const pagamentoDividas = totalParcelasDividas * fatorReducao;
  const aporteProvisoes = totalAportesProvisoes * fatorReducao;
  const sobraLivre = restante - pagamentoDividas - aporteProvisoes;

  return {
    metaMinima, metaCompleta, faixaReserva, aporteReserva, aporteInvestimento,
    pagamentoDividas, aporteProvisoes, sobraLivre, investimentoEstourouRenda,
    reducaoDividasProvisoes: fatorReducao < 1
  };
}

export default function CardPlanejamento({ mes, renda, entradas, contas }) {
  const dividasTodas = useLiveQuery(() => db.dividas.toArray(), []) || [];
  const provisoesTodas = useLiveQuery(() => db.provisoes.toArray(), []) || [];
  const registroMetas = useLiveQuery(() => db.configuracoes.where('chave').equals('metasCascata').first(), []);
  const metas = registroMetas
    ? JSON.parse(registroMetas.valor)
    : {
        mesesReservaMinima: 3, mesesReservaCompleta: 6, despesaMensalEstimada: 0,
        percentDivisaoReservaInvestimento: 50,
        percentInvestimento: 10, valorFixoInvestimento: 0, modoInvestimento: 'percent'
      };

  const [confirmando, setConfirmando] = useState(false);
  const [contaOrigemId, setContaOrigemId] = useState(null);
  const [toast, setToast] = useState('');

  const dividasAtivas = useMemo(() => dividasTodas.filter((d) => d.valorTotal - d.valorPago > 0.01), [dividasTodas]);
  const provisoesComAporte = useMemo(() => provisoesTodas.filter((p) => (p.aporteMensal || 0) > 0), [provisoesTodas]);

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
      mesesReservaMinima: metas.mesesReservaMinima,
      mesesReservaCompleta: metas.mesesReservaCompleta,
      despesaMensalEstimada: metas.despesaMensalEstimada,
      percentDivisaoReservaInvestimento: metas.percentDivisaoReservaInvestimento,
      dividasAtivas,
      provisoes: provisoesComAporte
    }),
    [renda, reservaAtual, metas, dividasAtivas, provisoesComAporte]
  );

  async function confirmarAlocacao() {
    if (!contaOrigemId) return;
    const agora = new Date().toISOString();
    const dataHoje = hojeISO();
    // Mesmo fator usado no cálculo de exibição, aplicado aqui pra cada
    // dívida/provisão individualmente — garante que o total criado bate
    // exatamente com o que o card mostrou, mesmo quando reduzido.
    const totalParcelasDividas = dividasAtivas.reduce((s, d) => s + Math.min(d.parcelaMensal, d.valorTotal - d.valorPago), 0);
    const totalAportesProvisoes = provisoesComAporte.reduce((s, p) => s + (p.aporteMensal || 0), 0);
    const totalPrevisto = totalParcelasDividas + totalAportesProvisoes;
    const fator = totalPrevisto > 0 ? Math.min(1, (cascata.pagamentoDividas + cascata.aporteProvisoes) / totalPrevisto) : 1;

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
      const parcelaCheia = Math.min(divida.parcelaMensal, divida.valorTotal - divida.valorPago);
      const parcela = parcelaCheia * fator;
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

    for (const provisao of provisoesComAporte) {
      const aporte = (provisao.aporteMensal || 0) * fator;
      if (aporte <= 0 || !provisao.contaId) continue;
      await db.entries.add({
        tipo: 'transferencia',
        valor: aporte,
        data: dataHoje,
        categoriaId: null,
        subcategoriaId: null,
        contaId: contaOrigemId,
        contaDestinoId: provisao.contaId,
        cartaoId: null,
        nota: `Aporte provisão: ${provisao.nome} (planejamento)`,
        pagamentoFaturaChave: null,
        origem: 'manual',
        externalId: null,
        recorrenciaId: null,
        criadoEm: agora
      });
      await db.provisoes.update(provisao.id, { valorAcumulado: (provisao.valorAcumulado || 0) + aporte });
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

  const rotuloFaixa = {
    abaixo_minima: 'Abaixo da mínima — prioridade total',
    entre: 'Entre mínima e completa — reversão parcial',
    completa: 'Completa — 100% pro investimento'
  }[cascata.faixaReserva];

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
        <span>Reserva de emergência</span>
        <strong>−{formatCurrency(cascata.aporteReserva)}</strong>
      </div>
      <p className="repeticao-explicacao" style={{ margin: '-4px 0 4px' }}>
        {rotuloFaixa} · mínima: {formatCurrency(cascata.metaMinima)} · completa: {formatCurrency(cascata.metaCompleta)} ·
        atual: {formatCurrency(reservaAtual)}
      </p>

      {dividasAtivas.length > 0 && (
        <div className="planejamento-linha">
          <span>Dívidas ({dividasAtivas.length})</span>
          <strong>−{formatCurrency(cascata.pagamentoDividas)}</strong>
        </div>
      )}

      {provisoesComAporte.length > 0 && (
        <div className="planejamento-linha">
          <span>Provisões ({provisoesComAporte.length})</span>
          <strong>−{formatCurrency(cascata.aporteProvisoes)}</strong>
        </div>
      )}

      <div className="planejamento-linha planejamento-linha-final">
        <span>Sobra Livre</span>
        <strong style={{ color: 'var(--green)' }}>{formatCurrency(cascata.sobraLivre)}</strong>
      </div>

      {cascata.investimentoEstourouRenda && (
        <p className="aviso-fatura aviso-fatura-atrasada" style={{ margin: 0 }}>
          O valor fixo de investimento ({formatCurrency(cascata.aporteInvestimento)}) é maior que a renda do mês —
          não sobra nada pra Reserva, Dívidas, Provisões ou Sobra Livre.
        </p>
      )}
      {cascata.reducaoDividasProvisoes && (
        <p className="aviso-fatura" style={{ margin: 0 }}>
          A renda não é suficiente pras parcelas de dívidas e aportes de provisões no valor cheio — os dois foram
          reduzidos proporcionalmente esse mês.
        </p>
      )}

      {!confirmando ? (
        <button type="button" className="btn-primary" style={{ marginTop: 8 }} onClick={() => setConfirmando(true)}>
          Confirmar alocação do mês
        </button>
      ) : (
        <div className="fatura-pagar-form">
          <div className="field">
            <label>De qual conta sai (investimento, reserva, dívidas e provisões)</label>
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
