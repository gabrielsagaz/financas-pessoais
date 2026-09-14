import { useMemo, useState } from 'react';
import { useLiveQuery } from '../db/useLiveQuery';
import { db } from '../db/db';
import { formatCurrency, hojeISO, anoMesDe } from '../utils/format';
import { contaTemSaldoControlado, calcularSaldoConta } from '../db/saldos';
import { classificacaoEfetiva } from '../utils/classificacao';

// ---------------------------------------------------------------------------
// Cascata: a renda do mês é alocada em ORDEM de prioridade — cada balde
// pega o que precisa (até seu limite), o resto desce pro próximo:
//
//   1. Reserva de emergência — até atingir a meta (meses de despesa média)
//   2. Dívidas — soma das parcelas mensais das dívidas ainda não quitadas
//   3. Investimento — % da RENDA (não do que sobrou), decisão já tomada
//   4. Necessidade/Desejo — não geram lançamento nenhum: é o dinheiro que já
//      fica na conta principal e é gasto normalmente, como sempre foi.
//      "Sobra Livre" (o que resta depois de 1-3) é só a referência de
//      quanto dá pra gastar sem tocar na reserva nem pular parcela.
//
// Reserva e Investimento SEMPRE tiram o valor cheio calculado, mesmo que a
// soma ultrapasse a renda do mês — a Sobra Livre fica negativa nesse caso,
// e o card avisa. Capar silenciosamente escondia justamente o problema que
// esse card existe pra mostrar.
// ---------------------------------------------------------------------------

function calcularCascata({ renda, reservaAtual, mesesReserva, mediaDespesaMensal, dividasAtivas, percentInvestimento }) {
  const metaReserva = mesesReserva * mediaDespesaMensal;
  const faltanteReserva = Math.max(0, metaReserva - reservaAtual);
  const aporteReserva = Math.min(renda, faltanteReserva);

  const pagamentoDividas = dividasAtivas.reduce((soma, d) => soma + Math.min(d.parcelaMensal, d.valorTotal - d.valorPago), 0);
  const aporteInvestimento = renda * (percentInvestimento / 100);
  const sobraLivre = renda - aporteReserva - pagamentoDividas - aporteInvestimento;

  return { metaReserva, faltanteReserva, aporteReserva, pagamentoDividas, aporteInvestimento, sobraLivre };
}

export default function CardPlanejamento({ mes, renda, entradas, categoriaPorId, contas }) {
  const dividasTodas = useLiveQuery(() => db.dividas.toArray(), []) || [];
  const registroMetas = useLiveQuery(() => db.configuracoes.where('chave').equals('metasCascata').first(), []);
  const metas = registroMetas ? JSON.parse(registroMetas.valor) : { mesesReserva: 6, percentInvestimento: 10 };

  const [confirmando, setConfirmando] = useState(false);
  const [contaOrigemId, setContaOrigemId] = useState(null);
  const [toast, setToast] = useState('');

  const dividasAtivas = useMemo(() => dividasTodas.filter((d) => d.valorTotal - d.valorPago > 0.01), [dividasTodas]);

  const contasReserva = useMemo(() => contas.filter((c) => c.reservaEmergencia === true), [contas]);
  const reservaAtual = useMemo(
    () => contasReserva.reduce((soma, c) => soma + (contaTemSaldoControlado(c) ? calcularSaldoConta(c, entradas) : 0), 0),
    [contasReserva, entradas]
  );

  // Média histórica mensal de despesa (todos os tipos) e, só como
  // referência (sem afetar a cascata), de Necessidade — pra avisar se a
  // Sobra Livre nem cobre o básico. Olha todo o histórico real (não
  // previsto), agrupado por mês, com pelo menos 1 despesa lançada.
  const { mediaDespesaMensal, mediaNecessidadeMensal, mesesComDados } = useMemo(() => {
    const porMes = {};
    for (const e of entradas) {
      if (e.tipo !== 'despesa' || e.previsto) continue;
      const { ano: a, mes: m } = anoMesDe(e.data);
      const chave = `${a}-${m}`;
      if (!porMes[chave]) porMes[chave] = { total: 0, necessidade: 0 };
      porMes[chave].total += e.valor;
      const categoria = categoriaPorId[e.categoriaId];
      if (classificacaoEfetiva(categoria, null) === 'necessidade') porMes[chave].necessidade += e.valor;
    }
    const meses = Object.values(porMes);
    const n = meses.length || 1;
    return {
      mediaDespesaMensal: meses.reduce((s, m) => s + m.total, 0) / n,
      mediaNecessidadeMensal: meses.reduce((s, m) => s + m.necessidade, 0) / n,
      mesesComDados: meses.length
    };
  }, [entradas, categoriaPorId]);

  const cascata = useMemo(
    () => calcularCascata({
      renda,
      reservaAtual,
      mesesReserva: metas.mesesReserva,
      mediaDespesaMensal,
      dividasAtivas,
      percentInvestimento: metas.percentInvestimento
    }),
    [renda, reservaAtual, metas, mediaDespesaMensal, dividasAtivas]
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
  if (mesesComDados < 2) {
    return <p className="vazio">Ainda faltam meses de histórico pra calcular uma média de despesa confiável (tem {mesesComDados}).</p>;
  }

  const deficit = cascata.sobraLivre < 0;

  return (
    <div className="chart-box planejamento-box">
      <div className="planejamento-linha">
        <span>Renda do mês</span>
        <strong>{formatCurrency(renda)}</strong>
      </div>
      <div className="planejamento-linha">
        <span>
          Reserva de emergência
          {cascata.faltanteReserva <= 0 && <span className="fatura-tag fatura-tag-positivo" style={{ marginLeft: 6 }}>Meta atingida</span>}
        </span>
        <strong>−{formatCurrency(cascata.aporteReserva)}</strong>
      </div>
      <p className="repeticao-explicacao" style={{ margin: '-4px 0 4px' }}>
        Meta: {formatCurrency(cascata.metaReserva)} ({metas.mesesReserva}× a média de despesa) · atual: {formatCurrency(reservaAtual)}
      </p>

      {dividasAtivas.length > 0 && (
        <div className="planejamento-linha">
          <span>Dívidas ({dividasAtivas.length})</span>
          <strong>−{formatCurrency(cascata.pagamentoDividas)}</strong>
        </div>
      )}

      <div className="planejamento-linha">
        <span>Investimento ({metas.percentInvestimento}% da renda)</span>
        <strong>−{formatCurrency(cascata.aporteInvestimento)}</strong>
      </div>

      <div className="planejamento-linha planejamento-linha-final">
        <span>Sobra Livre</span>
        <strong style={{ color: deficit ? 'var(--red)' : 'var(--green)' }}>{formatCurrency(cascata.sobraLivre)}</strong>
      </div>

      {deficit ? (
        <p className="aviso-fatura aviso-fatura-atrasada" style={{ margin: 0 }}>
          A renda do mês não cobre Reserva + Dívidas + Investimento — falta {formatCurrency(Math.abs(cascata.sobraLivre))}.
        </p>
      ) : cascata.sobraLivre < mediaNecessidadeMensal && (
        <p className="aviso-fatura" style={{ margin: 0 }}>
          Sua Sobra Livre ({formatCurrency(cascata.sobraLivre)}) é menor que sua média de gastos com Necessidade
          ({formatCurrency(mediaNecessidadeMensal)}) — pode não sobrar muito pra Desejo esse mês.
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
