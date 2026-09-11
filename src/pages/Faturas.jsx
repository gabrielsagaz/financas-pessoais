import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatCurrency, formatDateBR, hojeISO, NOMES_MESES } from '../utils/format';
import { calcularFaturaDoLancamento, contaEhCartao } from '../utils/cartao';
import { projetarTodasAsRecorrencias } from '../db/recorrencias';
import { IconArrowLeft, IconCard } from '../components/Icons';

export default function Faturas({ onVoltar }) {
  const contas = useLiveQuery(() => db.contas.orderBy('ordem').toArray(), []) || [];
  const entradas = useLiveQuery(() => db.entries.toArray(), []) || [];
  const recorrencias = useLiveQuery(() => db.recorrencias.toArray(), []) || [];
  const excecoesValor = useLiveQuery(() => db.excecoesValor.toArray(), []) || [];

  const cartoes = useMemo(() => contas.filter(contaEhCartao), [contas]);

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
        cartoes.map((cartao) => <FaturasDoCartao key={cartao.id} cartao={cartao} entradas={todasEntradas} />)
      )}
    </div>
  );
}

function FaturasDoCartao({ cartao, entradas }) {
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
      if (!grupos[chave]) grupos[chave] = { chave, anoFatura, mesFatura, dataVencimento, total: 0, temPrevisto: false };
      grupos[chave].total += e.valor;
      if (e.previsto) grupos[chave].temPrevisto = true;
    }
    return Object.values(grupos).sort((a, b) => (a.chave < b.chave ? -1 : 1));
  }, [entradas, cartao]);

  return (
    <div className="fatura-cartao-bloco">
      <h2><IconCard size={16} /> {cartao.nome}</h2>
      {faturas.length === 0 ? (
        <p className="vazio">Nenhum gasto neste cartão ainda.</p>
      ) : (
        <div className="chart-box fatura-lista">
          {faturas.map((f) => {
            const status = f.chave === faturaAtualChave ? 'aberta' : f.temPrevisto ? 'futura' : 'fechada';
            const rotulo = status === 'aberta' ? 'Em aberto' : status === 'futura' ? 'Prevista' : 'Fechada';
            return (
              <div key={f.chave} className="fatura-item">
                <div>
                  <div className="fatura-mes">{NOMES_MESES[f.mesFatura - 1]} {f.anoFatura}</div>
                  <div className="fatura-vencimento">Vence {formatDateBR(f.dataVencimento)}</div>
                </div>
                <div className="fatura-direita">
                  <span className={`fatura-tag fatura-tag-${status}`}>{rotulo}</span>
                  <strong>{formatCurrency(f.total)}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
