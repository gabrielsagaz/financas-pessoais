const ABAS = [
  { id: 'resumo', label: 'Resumo', icon: '📊' },
  { id: 'lancar', label: 'Lançar', icon: '➕' },
  { id: 'historico', label: 'Histórico', icon: '📋' },
  { id: 'categorias', label: 'Categorias', icon: '🏷️' }
];

export default function BottomNav({ abaAtiva, onChange }) {
  return (
    <nav className="bottom-nav">
      {ABAS.map((aba) => (
        <button
          key={aba.id}
          className={`nav-item ${abaAtiva === aba.id ? 'ativo' : ''}`}
          onClick={() => onChange(aba.id)}
          type="button"
        >
          <span className="nav-icon">{aba.icon}</span>
          <span className="nav-label">{aba.label}</span>
        </button>
      ))}
    </nav>
  );
}
