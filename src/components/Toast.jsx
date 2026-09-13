import { useEffect } from 'react';
import { IconCheck } from './Icons';

// Confirmação flutuante ("toast"). Some sozinha depois de `duracaoMs` — o
// pedido era exatamente esse: o texto inline antigo passava despercebido
// porque o formulário já limpa os campos na hora de salvar, então a
// atenção do usuário já mudou de lugar antes de reparar na mensagem.
export default function Toast({ mensagem, tipo = 'sucesso', onFechar, duracaoMs = 2600 }) {
  useEffect(() => {
    if (!mensagem) return undefined;
    const id = setTimeout(onFechar, duracaoMs);
    return () => clearTimeout(id);
  }, [mensagem, duracaoMs, onFechar]);

  if (!mensagem) return null;

  return (
    <div className={`toast toast-${tipo}`} role="status">
      {tipo === 'sucesso' && <IconCheck size={18} />}
      <span>{mensagem}</span>
    </div>
  );
}
