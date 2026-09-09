import { formatPercent } from '../utils/format';

// Mesma linguagem visual da barra de "Armazenamento" das configurações da
// Apple: um traço horizontal dividido em segmentos coloridos, com a legenda
// abaixo. Aqui os segmentos são % da renda gasta, % investida e o que sobra.
export default function AllocationBar({ percentGasta, percentInvestida }) {
  let despesaW = Math.max(0, percentGasta);
  let investW = Math.max(0, percentInvestida);
  const total = despesaW + investW;
  if (total > 100) {
    const fator = 100 / total;
    despesaW *= fator;
    investW *= fator;
  }
  const sobraW = Math.max(0, 100 - despesaW - investW);
  const sobraPercent = Math.max(0, 100 - percentGasta - percentInvestida);

  return (
    <div className="allocation">
      <div className="allocation-bar">
        {despesaW > 0 && <div className="allocation-segment" style={{ width: `${despesaW}%`, background: 'var(--red)' }} />}
        {investW > 0 && <div className="allocation-segment" style={{ width: `${investW}%`, background: 'var(--blue)' }} />}
        {sobraW > 0 && <div className="allocation-segment" style={{ width: `${sobraW}%`, background: '#d2d2d7' }} />}
      </div>
      <div className="allocation-legend">
        <span className="allocation-item">
          <i style={{ background: 'var(--red)' }} /> Gasto <strong>{formatPercent(percentGasta)}</strong>
        </span>
        <span className="allocation-item">
          <i style={{ background: 'var(--blue)' }} /> Investido <strong>{formatPercent(percentInvestida)}</strong>
        </span>
        <span className="allocation-item">
          <i style={{ background: '#d2d2d7' }} /> Livre <strong>{formatPercent(sobraPercent)}</strong>
        </span>
      </div>
    </div>
  );
}
