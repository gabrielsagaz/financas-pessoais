// Formatação centralizada em pt-BR / R$ — usada em todo o app.

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

export function formatCurrency(value) {
  const num = Number(value) || 0;
  return currencyFormatter.format(num);
}

// Recebe uma string "YYYY-MM-DD" (formato do <input type="date">) e devolve
// no padrão brasileiro DD/MM/AAAA, sem depender de fuso horário.
export function formatDateBR(isoDate) {
  if (!isoDate) return '';
  const [ano, mes, dia] = isoDate.split('-');
  return `${dia}/${mes}/${ano}`;
}

export const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Extrai {ano, mes} (mes 1-12) de uma data "YYYY-MM-DD" sem usar Date()
// (Date() com string "YYYY-MM-DD" pode sofrer deslocamento de fuso).
export function anoMesDe(isoDate) {
  const [ano, mes] = isoDate.split('-').map(Number);
  return { ano, mes };
}

export function hojeISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function formatPercent(value) {
  const num = Number(value) || 0;
  return `${num.toFixed(1).replace('.', ',')}%`;
}
