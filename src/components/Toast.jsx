import { useEffect, useState } from 'react';
import { IconCheck } from './Icons';

const DURACAO_SAIDA_MS = 320; // precisa bater com a animação .toast-saindo no CSS

// Confirmação flutuante ("toast"). Some sozinha depois de `duracaoMs`, com
// uma pequena animação de saída (dissolve/desfoca) em vez de sumir seco.
export default function Toast({ mensagem, tipo = 'sucesso', onFechar, duracaoMs = 2600 }) {
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    if (!mensagem) return undefined;
    setSaindo(false);
    const idEsconder = setTimeout(() => setSaindo(true), duracaoMs);
    return () => clearTimeout(idEsconder);
  }, [mensagem, duracaoMs]);

  useEffect(() => {
    if (!saindo) return undefined;
    const idFechar = setTimeout(onFechar, DURACAO_SAIDA_MS);
    return () => clearTimeout(idFechar);
  }, [saindo, onFechar]);

  if (!mensagem) return null;

  return (
    <div className={`toast toast-${tipo} ${saindo ? 'toast-saindo' : ''}`} role="status">
      {tipo === 'sucesso' && <IconCheck size={18} />}
      <span>{mensagem}</span>
    </div>
  );
}
