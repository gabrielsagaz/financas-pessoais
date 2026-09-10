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
    if (e.data < conta.saldoInicialData) continue;

    if (e.tipo === 'transferencia') {
      if (e.contaId === conta.id) saldo -= e.valor; // saiu desta conta
      if (e.contaDestinoId === conta.id) saldo += e.valor; // entrou nesta conta
      continue;
    }

    if (e.contaId !== conta.id) continue;
    if (e.tipo === 'receita') saldo += e.valor;
    else if (e.tipo === 'despesa' || e.tipo === 'investimento') saldo -= e.valor;
  }
  return saldo;
}
