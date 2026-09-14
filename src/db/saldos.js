import { formaPagamentoEfetiva } from '../utils/cartao';

// Saldo controlado por conta: opcional, por conta. Uma conta sem
// `saldoInicialData` continua sendo só uma etiqueta informativa, como
// sempre foi — nada muda pra quem não ativar isso.
//
// Quando ativado, o usuário informa o saldo "de hoje" (não recalcula pra
// trás a partir do histórico antigo). A partir da data em que isso foi
// informado, o saldo corrente é: saldo informado + tudo que entrou/saiu
// da conta desde então.
export function contaTemSaldoControlado(conta) {
  return !!conta?.saldoInicialData;
}

export function calcularSaldoConta(conta, entradas) {
  if (!contaTemSaldoControlado(conta)) return null;

  let saldo = conta.saldoInicial || 0;
  for (const e of entradas) {
    // Usa o momento em que o lançamento foi CRIADO (criadoEm), não a data
    // que ele representa (e.data) — importante quando você recalibra o
    // saldo depois de já ter lançado algo no mesmo dia: aquele lançamento
    // já estava refletido no valor real que você acabou de digitar, então
    // não pode ser somado de novo por cima. Só compara por data (e.data)
    // como último recurso, pra ocorrências previstas/projetadas, que não
    // têm criadoEm por nunca terem sido de fato gravadas.
    const momento = e.criadoEm || e.data;
    if (momento < conta.saldoInicialData) continue;

    if (e.tipo === 'transferencia') {
      if (e.contaId === conta.id) saldo -= e.valor; // saiu desta conta
      if (e.contaDestinoId === conta.id) saldo += e.valor; // entrou nesta conta
      continue;
    }

    if (e.contaId !== conta.id) continue;
    if (e.tipo === 'receita') saldo += e.valor;
    else if (e.tipo === 'investimento') saldo -= e.valor;
    else if (e.tipo === 'despesa') {
      // Despesa em crédito não sai do saldo agora — só quando a fatura é
      // paga, o que já é o próprio lançamento de pagamento (uma
      // transferência) reduzindo o saldo, tratado no bloco acima.
      if (formaPagamentoEfetiva(e, conta) === 'credito') continue;
      saldo -= e.valor;
    }
  }
  return saldo;
}
