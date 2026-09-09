import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TIPOS } from '../db/defaultData';
import { hojeISO } from '../utils/format';
import MoneyInput from '../components/MoneyInput';
import EditableSelect from '../components/EditableSelect';

const TIPO_INICIAL = 'despesa';

export default function Lancar({ irParaHistorico }) {
  const [tipo, setTipo] = useState(TIPO_INICIAL);
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(hojeISO());
  const [categoriaId, setCategoriaId] = useState(null);
  const [subcategoriaId, setSubcategoriaId] = useState(null);
  const [contaId, setContaId] = useState(null);
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const categorias = useLiveQuery(
    () => db.categorias.where('tipo').equals(tipo).sortBy('ordem'),
    [tipo]
  ) || [];

  const subcategorias = useLiveQuery(
    () => (categoriaId ? db.subcategorias.where('categoriaId').equals(categoriaId).sortBy('ordem') : []),
    [categoriaId]
  ) || [];

  const contas = useLiveQuery(() => db.contas.orderBy('ordem').toArray()) || [];

  const temSubcategorias = subcategorias.length > 0;

  function mudarTipo(novoTipo) {
    setTipo(novoTipo);
    setCategoriaId(null);
    setSubcategoriaId(null);
    setMensagem('');
  }

  function mudarCategoria(id) {
    setCategoriaId(id);
    setSubcategoriaId(null);
  }

  async function criarCategoria(nome) {
    const proximaOrdem = categorias.length;
    return db.categorias.add({ tipo, nome, ordem: proximaOrdem });
  }

  async function criarSubcategoria(nome) {
    const proximaOrdem = subcategorias.length;
    return db.subcategorias.add({ categoriaId, nome, ordem: proximaOrdem });
  }

  async function criarConta(nome) {
    const proximaOrdem = contas.length;
    return db.contas.add({ nome, ordem: proximaOrdem, arquivada: false });
  }

  function limparFormulario() {
    setValor(0);
    setNota('');
    // mantém tipo, data e conta (é comum lançar vários gastos da mesma conta/dia em sequência)
    setCategoriaId(null);
    setSubcategoriaId(null);
  }

  async function salvar(e) {
    e.preventDefault();
    if (valor <= 0) {
      setMensagem('Informe um valor maior que zero.');
      return;
    }
    if (!categoriaId) {
      setMensagem('Selecione uma categoria.');
      return;
    }

    setSalvando(true);
    try {
      await db.entries.add({
        tipo,
        valor,
        data,
        categoriaId,
        subcategoriaId: subcategoriaId ?? null,
        contaId: contaId ?? null,
        nota: nota.trim(),
        origem: 'manual',
        externalId: null,
        criadoEm: new Date().toISOString()
      });
      setMensagem('Lançamento salvo ✓');
      limparFormulario();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="page">
      <h1>Novo lançamento</h1>

      <div className="tipo-tabs">
        {Object.entries(TIPOS).map(([key, info]) => (
          <button
            key={key}
            type="button"
            className={`tipo-tab ${tipo === key ? 'ativo' : ''}`}
            style={tipo === key ? { borderColor: info.cor, color: info.cor } : undefined}
            onClick={() => mudarTipo(key)}
          >
            {info.label}
          </button>
        ))}
      </div>

      <form onSubmit={salvar} className="form">
        <div className="field">
          <label htmlFor="valor">Valor</label>
          <MoneyInput id="valor" value={valor} onChange={setValor} autoFocus />
        </div>

        <div className="field">
          <label htmlFor="data">Data</label>
          <input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>

        <EditableSelect
          label="Categoria"
          options={categorias}
          value={categoriaId}
          onChange={mudarCategoria}
          onCreate={criarCategoria}
          placeholder="Selecione a categoria"
        />

        {(temSubcategorias || subcategorias.length === 0) && categoriaId && (
          <EditableSelect
            label="Subcategoria (opcional)"
            options={subcategorias}
            value={subcategoriaId}
            onChange={setSubcategoriaId}
            onCreate={criarSubcategoria}
            placeholder="Selecione a subcategoria"
          />
        )}

        <EditableSelect
          label="Conta"
          options={contas}
          value={contaId}
          onChange={setContaId}
          onCreate={criarConta}
          placeholder="Selecione a conta"
        />

        <div className="field">
          <label htmlFor="nota">Observação (opcional)</label>
          <input
            id="nota"
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ex: jantar com amigos"
          />
        </div>

        {mensagem && <p className="mensagem">{mensagem}</p>}

        <button type="submit" className="btn-primary" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar lançamento'}
        </button>
      </form>
    </div>
  );
}
