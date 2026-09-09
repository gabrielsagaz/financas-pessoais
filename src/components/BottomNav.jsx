import { IconResumo, IconPlusCircle, IconList, IconTag } from './Icons';

const ABAS = [
  { id: 'resumo', label: 'Resumo', Icon: IconResumo },
  { id: 'lancar', label: 'Lançar', Icon: IconPlusCircle },
  { id: 'historico', label: 'Histórico', Icon: IconList },
  { id: 'categorias', label: 'Categorias', Icon: IconTag }
];

export default function BottomNav({ abaAtiva, onChange }) {
  return (
    <nav className="bottom-nav">
      {ABAS.map((aba) => {
        const ativo = abaAtiva === aba.id;
        return (
          <button
            key={aba.id}
            className={`nav-item ${ativo ? 'ativo' : ''}`}
            onClick={() => onChange(aba.id)}
            type="button"
          >
            <aba.Icon size={23} filled={ativo} />
            <span className="nav-label">{aba.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
