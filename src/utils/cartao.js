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

// Toda conta aceita lançamentos em débito ou crédito — a escolha é sempre
// por LANÇAMENTO (`entry.formaPagamento: 'debito' | 'credito'`), nunca da
// conta inteira. Dia de fechamento/vencimento tem um padrão sensato pra
// quem nunca configurou nada (fecha dia 1, vence dia 10) — só importa de
// verdade se algum dia você usar crédito nessa conta.
export function diaFechamentoEfetivo(conta) {
  return conta?.diaFechamento || 1;
}
export function diaVencimentoEfetivo(conta) {
  return conta?.diaVencimento || 10;
}

// Um lançamento antigo (de antes dessa mudança) não tem `formaPagamento`
// gravado — nesse caso, deduzimos pelo tipo da conta onde ele mora: se era
// uma conta 100% cartão antiga, era crédito; senão, era débito. Lançamentos
// novos sempre gravam `formaPagamento` explicitamente.
export function formaPagamentoEfetiva(entry, conta) {
  if (entry?.formaPagamento) return entry.formaPagamento;
  return conta?.tipo === 'cartao' ? 'credito' : 'debito';
}
