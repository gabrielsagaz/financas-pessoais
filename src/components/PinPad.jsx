import { useEffect, useState } from 'react';

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

// Teclado numérico + indicadores (bolinhas) de progresso, no estilo do
// código de acesso do iOS. `length` dígitos; chama `onComplete(pin)` quando
// o código atinge o tamanho definido. `erro` faz as bolinhas "tremerem" e
// zera o que foi digitado.
export default function PinPad({ length = 4, onComplete, erro }) {
  const [digitos, setDigitos] = useState([]);

  useEffect(() => {
    if (erro) setDigitos([]);
  }, [erro]);

  function digitar(tecla) {
    if (tecla === '') return;
    if (tecla === '⌫') {
      setDigitos((d) => d.slice(0, -1));
      return;
    }
    if (digitos.length >= length) return;

    const novos = [...digitos, tecla];
    setDigitos(novos);
    if (novos.length === length) {
      onComplete(novos.join(''));
      setDigitos([]);
    }
  }

  return (
    <div className="pinpad">
      <div className={`pinpad-dots ${erro ? 'shake' : ''}`}>
        {Array.from({ length }).map((_, i) => (
          <span key={i} className={`pinpad-dot ${i < digitos.length ? 'preenchido' : ''}`} />
        ))}
      </div>
      <div className="pinpad-grid">
        {TECLAS.map((tecla, i) => (
          <button
            key={i}
            type="button"
            className={`pinpad-tecla ${tecla === '' ? 'vazia' : ''}`}
            disabled={tecla === ''}
            onClick={() => digitar(tecla)}
          >
            {tecla}
          </button>
        ))}
      </div>
    </div>
  );
}
