import { formatCurrency } from '../utils/format';

// Guarda o valor em CENTAVOS (inteiro) internamente e formata como R$ na tela
// — evita os problemas clássicos de digitar vírgula/ponto em input numérico.
// `value` e `onChange` trabalham sempre em REAIS (número decimal), pra quem
// usa o componente não precisar pensar em centavos.
export default function MoneyInput({ value, onChange, autoFocus, id }) {
  const centavos = Math.round((Number(value) || 0) * 100);

  function handleKeyInput(e) {
    const somenteDigitos = e.target.value.replace(/\D/g, '');
    const novosCentavos = somenteDigitos === '' ? 0 : parseInt(somenteDigitos, 10);
    onChange(novosCentavos / 100);
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
      className="money-input"
      value={centavos === 0 ? '' : formatCurrency(centavos / 100)}
      onChange={handleKeyInput}
      placeholder={formatCurrency(0)}
    />
  );
}
