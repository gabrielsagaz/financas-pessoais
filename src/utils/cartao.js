import { montarDataISO } from './format';

// Lógica de fatura de cartão de crédito, a partir de dois dados que o
// usuário cadastra na conta: `diaFechamento` (dia em que a fatura fecha e
// começa a acumular a próxima) e `diaVencimento` (dia em que a fatura
// fechada precisa ser paga).
//
// Regra: um lançamento feito ATÉ o dia de fechamento entra na fatura que já
// está acumulando; depois do fechamento, entra na fatura seguinte. O
// vencimento dessa fatura pode cair no mesmo mês do fechamento ou no mês
// seguinte, dependendo de `diaVencimento` ser depois ou antes de
// `diaFechamento` no calendário.
function proximoMes(ano, mes) {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

export function calcularFaturaDoLancamento(dataISO, diaFechamento, diaVencimento) {
  const [anoStr, mesStr, diaStr] = dataISO.split('-');
  let ano = Number(anoStr);
  let mes = Number(mesStr);
  const dia = Number(diaStr);

  // Depois do fechamento deste mês? Entra na fatura que fecha no mês seguinte.
  if (dia > diaFechamento) {
    ({ ano, mes } = proximoMes(ano, mes));
  }

  // O vencimento cai no mês seguinte ao fechamento quando o dia de
  // vencimento é "menor" no calendário do que o dia de fechamento (ex:
  // fecha dia 25, vence dia 5 → vencimento é no mês seguinte ao fechamento).
  let anoVencimento = ano;
  let mesVencimento = mes;
  if (diaVencimento <= diaFechamento) {
    ({ ano: anoVencimento, mes: mesVencimento } = proximoMes(ano, mes));
  }

  return {
    anoFatura: ano,
    mesFatura: mes,
    dataVencimento: montarDataISO(anoVencimento, mesVencimento, diaVencimento)
  };
}

export function contaEhCartao(conta) {
  return conta?.tipo === 'cartao';
}
