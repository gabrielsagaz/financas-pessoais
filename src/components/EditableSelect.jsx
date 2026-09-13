import { useState } from 'react';

// Select genérico usado para categoria / subcategoria / conta no formulário
// de lançamento. Sempre permite criar um item novo na hora, sem sair da tela
// (pedido do usuário: "permitir criar/editar categorias e subcategorias
// livremente").
export default function EditableSelect({
  label,
  options,
  value,
  onChange,
  onCreate,
  placeholder = 'Selecione...',
  disabled = false
}) {
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState('');

  async function confirmarNovo() {
    const nome = novoNome.trim();
    if (!nome) return;
    const novoId = await onCreate(nome);
    onChange(novoId);
    setNovoNome('');
    setCriando(false);
  }

  return (
    <div className="field">
      <label>{label}</label>
      {!criando ? (
        <div className="select-row">
          <select
            disabled={disabled}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
          >
            <option value="">{placeholder}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
          {!disabled && (
            <button type="button" className="btn-add" onClick={() => setCriando(true)}>
              + Novo
            </button>
          )}
        </div>
      ) : (
        <div className="inline-add">
          <input
            autoFocus
            type="text"
            value={novoNome}
            placeholder="Nome..."
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmarNovo()}
          />
          <button type="button" className="btn-confirm" onClick={confirmarNovo}>Adicionar</button>
          <button type="button" className="btn-cancel" onClick={() => { setCriando(false); setNovoNome(''); }}>Cancelar</button>
        </div>
      )}
    </div>
  );
}
