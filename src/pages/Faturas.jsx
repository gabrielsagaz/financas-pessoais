import { useState, useMemo } from 'react';
import { useLiveQuery } from '../db/useLiveQuery';
import { db } from '../db/db';
import { formatCurrency, formatDateBR, hojeISO, NOMES_MESES } from '../utils/format';
import { calcularFaturaDoLancamento, contaEhCartao } from '../utils/cartao';
import { projetarTodasAsRecorrencias } from '../db/recorrencias';
import { IconArrowLeft, IconCard } from '../components/Icons';
import MoneyInput from '../components/MoneyInput';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Faturas({ onVoltar }) {
  const contas = useLiveQuery(() => db.contas.orderBy('ordem').toArray(), []) || [];
  const entradas = useLiveQuery(() => db.entries.toArray(), []) || [];
  const recorrencias = useLiveQuery(() => db.recorrencias.toArray(), []) || [];
  const excecoesValor = useLiveQuery(() => db.excecoesValor.toArray(), []) || [];

  const cartoes = useMemo(() => contas.filter(contaEhCartao), [contas]);
  // Pagar a fatura sempre parte de uma conta que NÃO é cartão (não faz
  // sentido "pagar o cartão com o próprio cartão").
  const contasParaPagar = useMemo(() => contas.filter((c) => !contaEhCartao(c)), [contas]);

  // Projeta os lançamentos fixos dos próximos ~12 meses, pra faturas futuras
  // de compras já comprometidas (assinaturas, parcelas) aparecerem também,
  // marcadas como "prevista" em vez de "fechada".
  const previsoes = useMemo(() => {
    const anoAlvo = new Date().getFullYear() + 1;
    return projetarTodasAsRecorrencias(recorrencias, entradas, excecoesValor, anoAlvo, 12);
  }, [recorrencias, entradas, excecoesValor]);

  const todasEntradas = useMemo(() => [...entradas, ...previsoes], [entradas, previsoes]);

  return (
    <div className="page">
      <button type="button" className="botao-voltar" onClick={onVoltar}>
        <IconArrowLeft size={18} /> Voltar
      </button>
      <h1>Faturas</h1>

      {cartoes.length === 0 ? (
        <p className="vazio">Nenhuma conta marcada como cartão de crédito ainda. Configure em Perfil → Contas.</p>
      ) : (
        cartoes.map((cartao) => (
          <FaturasDoCartao
            key={cartao.id}
            cartao={cartao}
            entradas={todasEntradas}
            entradasReais={entradas}
            contasParaPagar={contasParaPagar}
          />
        ))
      )}
    </div>
  );
}

function FaturasDoCartao({ cartao, entradas, entradasReais, contasParaPagar }) {
  const faturaAtualChave = useMemo(() => {
    const { anoFatura, mesFatura } = calcularFaturaDoLancamento(hojeISO(), cartao.diaFechamento, cartao.diaVencimento);
    return `${anoFatura}-${String(mesFatura).padStart(2, '0')}`;
  }, [cartao]);

  const faturas = useMemo(() => {
    const doCartao = entradas.filter((e) => e.contaId === cartao.id && e.tipo === 'despesa');
    const grupos = {};
    for (const e of doCartao) {
      const { anoFatura, mesFatura, dataVencimento } = calcularFaturaDoLancamento(e.data, cartao.diaFechamento, cartao.diaVencimento);
      const chave = `${anoFatura}-${String(mesFatura).padStart(2, '0')}`;
      if (!grupos[chave]) grupos[chave] = { chave, anoFatura, mesFatura, dataVencimento, total: 0, temPrevisto: false, pago: 0 };
      grupos[chave].total += e.valor;
      if (e.previsto) grupos[chave].temPrevisto = true;
    }

    // Pagamentos: transferências reais marcadas como pagamento desta fatura
    // (ver `pagamentoFaturaChave`, gravado ao clicar em "Pagar" abaixo).
    const pagamentos = entradasReais.filter(
      (e) => e.tipo === 'transferencia' && e.contaDestinoId === cartao.id && e.pagamentoFaturaChave
    );
    for (const p of pagamentos) {
      const chave = p.pagamentoFaturaChave;
      if (!grupos[chave]) {
        const [anoStr, mesStr] = chave.split('-');
        grupos[chave] = { chave, anoFatura: Number(anoStr), mesFatura: Number(mesStr), dataVencimento: null, total: 0, temPrevisto: false, pago: 0 };
      }
      grupos[chave].pago += p.valor;
    }

    return Object.values(grupos).sort((a, b) => (a.chave < b.chave ? -1 : 1));
  }, [entradas, entradasReais, cartao]);

  return (
    <div className="fatura-cartao-bloco">
      <h2><IconCard size={16} /> {cartao.nome}</h2>
      {faturas.length === 0 ? (
        <p className="vazio">Nenhum gasto neste cartão ainda.</p>
      ) : (
        <div className="chart-box fatura-lista">
          {faturas.map((f) => (
            <FaturaItem
              key={f.chave}
              fatura={f}
              cartao={cartao}
              faturaAtualChave={faturaAtualChave}
              contasParaPagar={contasParaPagar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FaturaItem({ fatura: f, cartao, faturaAtualChave, contasParaPagar }) {
  const [pagando, setPagando] = useState(false);
  const [contaOrigemId, setContaOrigemId] = useState(contasParaPagar[0]?.id ?? null);
  const [valorPagamento, setValorPagamento] = useState(Math.max(0, f.total - f.pago));
  const [confirmandoRetirar, setConfirmandoRetirar] = useState(false);

  const restante = Math.max(0, f.total - f.pago);
  const estaPaga = f.total > 0 && f.pago >= f.total;

  const status = f.chave === faturaAtualChave ? 'aberta' : f.temPrevisto ? 'futura' : 'fechada';
  const rotulo = status === 'aberta' ? 'Em aberto' : status === 'futura' ? 'Prevista' : 'Fechada';

  function abrirPagamento() {
    setValorPagamento(restante);
    setContaOrigemId((id) => id ?? contasParaPagar[0]?.id ?? null);
    setPagando(true);
  }

  async function confirmarPagamento() {
    if (!contaOrigemId || valorPagamento <= 0) return;
    await db.entries.add({
      tipo: 'transferencia',
      valor: valorPagamento,
      data: hojeISO(),
      categoriaId: null,
      subcategoriaId: null,
      contaId: contaOrigemId,
      contaDestinoId: cartao.id,
      nota: `Pagamento fatura ${NOMES_MESES[f.mesFatura - 1]}/${f.anoFatura}`,
      pagamentoFaturaChave: f.chave,
      origem: 'manual',
      externalId: null,
      recorrenciaId: null,
      criadoEm: new Date().toISOString()
    });
    setPagando(false);
  }

  // Remove TODAS as transferências marcadas como pagamento desta fatura —
  // desfaz o pagamento por completo (se houve mais de um pagamento parcial,
  // os dois somem juntos; simples de propósito, dá pra pagar de novo na hora).
  // Filtra por `tipo` (indexado) e depois em JS — `contaDestinoId` e
  // `pagamentoFaturaChave` não são campos indexados no banco.
  async function retirarPagamento() {
    const alvos = await db.entries
      .where('tipo').equals('transferencia')
      .filter((e) => e.contaDestinoId === cartao.id && e.pagamentoFaturaChave === f.chave)
      .toArray();
    await db.entries.bulkDelete(alvos.map((e) => e.id));
    setConfirmandoRetirar(false);
  }

  return (
    <div className="fatura-item-bloco">
      <div className="fatura-item">
        <div>
          <div className="fatura-mes">{NOMES_MESES[f.mesFatura - 1]} {f.anoFatura}</div>
          {f.dataVencimento && <div className="fatura-vencimento">Vence {formatDateBR(f.dataVencimento)}</div>}
        </div>
        <div className="fatura-direita">
          <span className={`fatura-tag fatura-tag-${status}`}>{rotulo}</span>
          <strong>{formatCurrency(f.total)}</strong>
        </div>
      </div>

      <div className="fatura-pagamento-linha">
        {f.pago > 0 && (
          <span className={`fatura-tag ${estaPaga ? 'fatura-tag-paga' : 'fatura-tag-parcial'}`}>
            {estaPaga ? 'Paga' : `Pago ${formatCurrency(f.pago)} de ${formatCurrency(f.total)}`}
          </span>
        )}
        <div className="fatura-pagamento-botoes">
          {!estaPaga && (
            <button type="button" className="btn-confirm" onClick={abrirPagamento}>Pagar</button>
          )}
          {f.pago > 0 && (
            <button type="button" className="btn-cancel" onClick={() => setConfirmandoRetirar(true)}>
              Retirar pagamento
            </button>
          )}
        </div>
      </div>

      {pagando && (
        <div className="fatura-pagar-form">
          <div className="field">
            <label>Pagar com</label>
            <select value={contaOrigemId ?? ''} onChange={(e) => setContaOrigemId(e.target.value || null)}>
              <option value="">Selecione a conta</option>
              {contasParaPagar.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Valor</label>
            <MoneyInput value={valorPagamento} onChange={setValorPagamento} />
          </div>
          <div className="edit-actions">
            <button type="button" className="btn-cancel" onClick={() => setPagando(false)}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={confirmarPagamento}>Confirmar pagamento</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmandoRetirar}
        title="Retirar pagamento?"
        message="Isso exclui a transferência registrada como pagamento desta fatura — o saldo do cartão volta a refletir a dívida."
        onConfirm={retirarPagamento}
        onCancel={() => setConfirmandoRetirar(false)}
      />
    </div>
  );
}
