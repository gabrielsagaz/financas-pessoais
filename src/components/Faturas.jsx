import { useState, useMemo } from 'react';
import { db } from '../db/db';
import { formatCurrency, formatDateBR, hojeISO, NOMES_MESES } from '../utils/format';
import { calcularFaturaDoLancamento, formaPagamentoEfetiva, diaFechamentoEfetivo, diaVencimentoEfetivo } from '../utils/cartao';
import { projetarTodasAsRecorrencias } from '../db/recorrencias';
import { IconCard } from './Icons';
import MoneyInput from './MoneyInput';
import ConfirmDialog from './ConfirmDialog';

const DIAS_ANTECEDENCIA_AVISO = 5;

// 'YYYY-MM-DD' → dias entre duas datas (positivo = b é depois de a). Evita
// `new Date('YYYY-MM-DD')`, que pode sofrer deslocamento de fuso horário —
// usa Date.UTC com os componentes já separados, sem depender do fuso local.
function diasEntre(dataA, dataB) {
  const [a1, a2, a3] = dataA.split('-').map(Number);
  const [b1, b2, b3] = dataB.split('-').map(Number);
  const ta = Date.UTC(a1, a2 - 1, a3);
  const tb = Date.UTC(b1, b2 - 1, b3);
  return Math.round((tb - ta) / 86400000);
}

// Agrupa as despesas em crédito de UM cartão em faturas (por mês de
// fechamento), soma os pagamentos já registrados pra cada uma. Extraído do
// componente pra poder ser chamado tanto pela lista normal de faturas
// quanto pelo aviso de vencimento no topo (que precisa olhar todos os
// cartões de uma vez, antes de saber qual vai renderizar o quê).
function calcularFaturasDoCartao(cartao, entradas, entradasReais) {
  const doCartao = entradas.filter(
    (e) => e.contaId === cartao.id && e.tipo === 'despesa' && formaPagamentoEfetiva(e, cartao) === 'credito'
  );
  const grupos = {};
  for (const e of doCartao) {
    const { anoFatura, mesFatura, dataVencimento } = calcularFaturaDoLancamento(e.data, diaFechamentoEfetivo(cartao), diaVencimentoEfetivo(cartao));
    const chave = `${anoFatura}-${String(mesFatura).padStart(2, '0')}`;
    if (!grupos[chave]) grupos[chave] = { chave, anoFatura, mesFatura, dataVencimento, total: 0, temPrevisto: false, pago: 0 };
    grupos[chave].total += e.valor;
    if (e.previsto) grupos[chave].temPrevisto = true;
  }

  // Pagamentos: transferências (sem conta de destino — o "destino" é só
  // abater a fatura, não outra conta de verdade) marcadas com o cartão e
  // a fatura a que se referem (ver `pagamentoFaturaChave`, gravado ao
  // clicar em "Pagar" abaixo).
  const pagamentos = entradasReais.filter(
    (e) => e.tipo === 'transferencia' && e.cartaoId === cartao.id && e.pagamentoFaturaChave
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
}

// Embutido na tela de Resumo, abaixo do saldo por conta — não é mais uma
// tela própria (por isso não busca os próprios dados: recebe tudo já
// carregado do Resumo, que já precisa dessas mesmas listas).
export default function Faturas({ contas, entradas, recorrencias, excecoesValor }) {
  // Pagar a fatura pode ser de qualquer conta, inclusive a mesma que gerou
  // o crédito (ex: pagar a fatura do Nubank com o saldo em débito do Nubank).
  const contasParaPagar = contas;

  // Projeta os lançamentos fixos dos próximos ~12 meses, pra faturas futuras
  // de compras já comprometidas (assinaturas, parcelas) aparecerem também,
  // marcadas como "prevista" em vez de "fechada".
  const previsoes = useMemo(() => {
    const anoAlvo = new Date().getFullYear() + 1;
    return projetarTodasAsRecorrencias(recorrencias, entradas, excecoesValor, anoAlvo, 12);
  }, [recorrencias, entradas, excecoesValor]);

  const todasEntradas = useMemo(() => [...entradas, ...previsoes], [entradas, previsoes]);

  // "Cartão" deixou de ser uma marcação na conta — é qualquer conta que já
  // teve (ou tem prevista) pelo menos uma despesa lançada em crédito.
  const cartoes = useMemo(() => {
    const idsComCredito = new Set(
      todasEntradas
        .filter((e) => e.tipo === 'despesa' && formaPagamentoEfetiva(e, contas.find((c) => c.id === e.contaId)) === 'credito')
        .map((e) => e.contaId)
    );
    return contas.filter((c) => idsComCredito.has(c.id));
  }, [contas, todasEntradas]);

  // Faturas não pagas, reais (não previstas), vencendo em até
  // DIAS_ANTECEDENCIA_AVISO dias — ou já vencidas. Olha todos os cartões de
  // uma vez, pra virar um aviso único no topo (não um por cartão).
  const faturasProximasOuAtrasadas = useMemo(() => {
    const hoje = hojeISO();
    const avisos = [];
    for (const cartao of cartoes) {
      const faturas = calcularFaturasDoCartao(cartao, todasEntradas, entradas);
      for (const f of faturas) {
        if (f.temPrevisto || !f.dataVencimento) continue;
        const restante = f.total - f.pago;
        if (restante <= 0) continue;
        const dias = diasEntre(hoje, f.dataVencimento);
        if (dias <= DIAS_ANTECEDENCIA_AVISO) avisos.push({ cartao, fatura: f, dias, restante });
      }
    }
    return avisos.sort((a, b) => a.dias - b.dias);
  }, [cartoes, todasEntradas, entradas]);

  // Nada lançado em crédito ainda — não mostra a seção (mantém o Resumo
  // limpo em vez de exibir um "vazio" permanente pra quem nunca usa isso).
  if (cartoes.length === 0) return null;

  return (
    <>
      {faturasProximasOuAtrasadas.length > 0 && (
        <div className="chart-box aviso-fatura-box">
          {faturasProximasOuAtrasadas.map(({ cartao, fatura: f, dias, restante }) => (
            <p key={`${cartao.id}-${f.chave}`} className={`aviso-fatura ${dias < 0 ? 'aviso-fatura-atrasada' : ''}`}>
              <strong>{cartao.nome}</strong> — {formatCurrency(restante)}{' '}
              {dias < 0
                ? `venceu há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'} (${formatDateBR(f.dataVencimento)})`
                : dias === 0
                  ? 'vence hoje'
                  : `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'} (${formatDateBR(f.dataVencimento)})`}
            </p>
          ))}
        </div>
      )}

      <h2>Faturas</h2>
      {cartoes.map((cartao) => (
        <FaturasDoCartao
          key={cartao.id}
          cartao={cartao}
          entradas={todasEntradas}
          entradasReais={entradas}
          contasParaPagar={contasParaPagar}
        />
      ))}
    </>
  );
}

function FaturasDoCartao({ cartao, entradas, entradasReais, contasParaPagar }) {
  const faturaAtualChave = useMemo(() => {
    const { anoFatura, mesFatura } = calcularFaturaDoLancamento(hojeISO(), diaFechamentoEfetivo(cartao), diaVencimentoEfetivo(cartao));
    return `${anoFatura}-${String(mesFatura).padStart(2, '0')}`;
  }, [cartao]);

  const faturas = useMemo(
    () => calcularFaturasDoCartao(cartao, entradas, entradasReais),
    [entradas, entradasReais, cartao]
  );

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
      contaDestinoId: null, // não existe mais uma "conta cartão" separada pra receber
      cartaoId: cartao.id,
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
  // Filtra por `tipo` (indexado) e depois em JS — `cartaoId` e
  // `pagamentoFaturaChave` não são campos indexados no banco.
  async function retirarPagamento() {
    const alvos = await db.entries
      .where('tipo').equals('transferencia')
      .filter((e) => e.cartaoId === cartao.id && e.pagamentoFaturaChave === f.chave)
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
