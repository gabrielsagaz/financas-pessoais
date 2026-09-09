import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TIPOS } from '../db/defaultData';
import { formatCurrency, formatDateBR, NOMES_MESES, anoMesDe } from '../utils/format';
import EditableSelect from '../components/EditableSelect';
import MoneyInput from '../components/MoneyInput';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconTrash, IconRepeat } from '../components/Icons';

export default function Historico() {
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear());
  const [filtroMes, setFiltroMes] = useState(0); // 0 = todos
  const [editandoId, setEditandoId] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);

  const entradas = useLiveQuery(() => db.entries.orderBy('data').reverse().toArray(), []) || [];
  const categorias = useLiveQuery(() => db.categorias.toArray(), []) || [];
  const subcategorias = useLiveQuery(() => db.subcategorias.toArray(), []) || [];
  const contas = useLiveQuery(() => db.contas.orderBy('ordem').toArray(), []) || [];
  const recorrencias = useLiveQuery(() => db.recorrencias.toArray(), []) || [];

  const categoriaPorId = useMemo(() => Object.fromEntries(categorias.map((c) => [c.id, c])), [categorias]);
  const subcategoriaPorId = useMemo(() => Object.fromEntries(subcategorias.map((s) => [s.id, s])), [subcategorias]);
  const contaPorId = useMemo(() => Object.fromEntries(contas.map((c) => [c.id, c])), [contas]);
  const recorrenciaPorId = useMemo(() => Object.fromEntries(recorrencias.map((r) => [r.id, r])), [recorrencias]);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set(entradas.map((e) => anoMesDe(e.data).ano));
    anos.add(new Date().getFullYear());
    return Array.from(anos).sort((a, b) => b - a);
  }, [entradas]);

  const listaFiltrada = useMemo(() => {
    return entradas.filter((e) => {
      if (filtroTipo !== 'todos' && e.tipo !== filtroTipo) return false;
      const { ano, mes } = anoMesDe(e.data);
      if (ano !== filtroAno) return false;
      if (filtroMes !== 0 && mes !== filtroMes) return false;
      return true;
    });
  }, [entradas, filtroTipo, filtroAno, filtroMes]);

  async function excluir(id) {
    await db.entries.delete(id);
    setExcluindoId(null);
  }

  return (
    <div className="page">
      <h1>Histórico</h1>

      <div className="filtros">
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPOS).map(([key, info]) => (
            <option key={key} value={key}>{info.label}</option>
          ))}
        </select>

        <select value={filtroAno} onChange={(e) => setFiltroAno(Number(e.target.value))}>
          {anosDisponiveis.map((ano) => <option key={ano} value={ano}>{ano}</option>)}
        </select>

        <select value={filtroMes} onChange={(e) => setFiltroMes(Number(e.target.value))}>
          <option value={0}>Todos os meses</option>
          {NOMES_MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
        </select>
      </div>

      {listaFiltrada.length === 0 && <p className="vazio">Nenhum lançamento neste filtro.</p>}

      <ul className="lista-entries">
        {listaFiltrada.map((entry) => (
          <li key={entry.id} className="entry-item">
            {editandoId === entry.id ? (
              <EditarEntry
                entry={entry}
                onCancelar={() => setEditandoId(null)}
                onSalvo={() => setEditandoId(null)}
              />
            ) : (
              <div className="entry-linha">
                <div className="entry-clickable" onClick={() => setEditandoId(entry.id)}>
                  <span className="entry-dot" style={{ background: TIPOS[entry.tipo].cor }} />
                  <div className="entry-info">
                    <div className="entry-categoria">
                      {categoriaPorId[entry.categoriaId]?.nome || '(sem categoria)'}
                      {entry.subcategoriaId && subcategoriaPorId[entry.subcategoriaId] &&
                        ` › ${subcategoriaPorId[entry.subcategoriaId].nome}`}
                      {entry.recorrenciaId && <IconRepeat size={13} />}
                    </div>
                    <div className="entry-detalhe">
                      {formatDateBR(entry.data)}
                      {entry.contaId && contaPorId[entry.contaId] && ` · ${contaPorId[entry.contaId].nome}`}
                      {entry.nota && ` · ${entry.nota}`}
                      {entry.numeroParcela && recorrenciaPorId[entry.recorrenciaId]?.totalParcelas &&
                        ` · Parcela ${entry.numeroParcela}/${recorrenciaPorId[entry.recorrenciaId].totalParcelas}`}
                    </div>
                  </div>
                  <div className="entry-valor" style={{ color: TIPOS[entry.tipo].cor }}>
                    {formatCurrency(entry.valor)}
                  </div>
                </div>
                <button type="button" className="btn-excluir-mini" onClick={() => setExcluindoId(entry.id)}>
                  <IconTrash />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={excluindoId !== null}
        title="Excluir lançamento?"
        message="Essa ação não pode ser desfeita."
        onConfirm={() => excluir(excluindoId)}
        onCancel={() => setExcluindoId(null)}
      />
    </div>
  );
}

function EditarEntry({ entry, onCancelar, onSalvo }) {
  const [valor, setValor] = useState(entry.valor);
  const [data, setData] = useState(entry.data);
  const [categoriaId, setCategoriaId] = useState(entry.categoriaId);
  const [subcategoriaId, setSubcategoriaId] = useState(entry.subcategoriaId);
  const [contaId, setContaId] = useState(entry.contaId);
  const [nota, setNota] = useState(entry.nota || '');

  const categorias = useLiveQuery(
    () => db.categorias.where('tipo').equals(entry.tipo).sortBy('ordem'),
    [entry.tipo]
  ) || [];
  const subcategorias = useLiveQuery(
    () => (categoriaId ? db.subcategorias.where('categoriaId').equals(categoriaId).sortBy('ordem') : []),
    [categoriaId]
  ) || [];
  const contas = useLiveQuery(() => db.contas.orderBy('ordem').toArray()) || [];

  async function criarCategoria(nome) {
    return db.categorias.add({ tipo: entry.tipo, nome, ordem: categorias.length });
  }
  async function criarSubcategoria(nome) {
    return db.subcategorias.add({ categoriaId, nome, ordem: subcategorias.length });
  }
  async function criarConta(nome) {
    return db.contas.add({ nome, ordem: contas.length, arquivada: false });
  }

  async function salvar() {
    await db.entries.update(entry.id, {
      valor,
      data,
      categoriaId,
      subcategoriaId: subcategoriaId ?? null,
      contaId: contaId ?? null,
      nota: nota.trim()
    });
    onSalvo();
  }

  return (
    <div className="edit-box">
      <div className="field">
        <label>Valor</label>
        <MoneyInput value={valor} onChange={setValor} />
      </div>
      <div className="field">
        <label>Data</label>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </div>
      <EditableSelect label="Categoria" options={categorias} value={categoriaId} onChange={(id) => { setCategoriaId(id); setSubcategoriaId(null); }} onCreate={criarCategoria} />
      {subcategorias.length > 0 && (
        <EditableSelect label="Subcategoria" options={subcategorias} value={subcategoriaId} onChange={setSubcategoriaId} onCreate={criarSubcategoria} />
      )}
      <EditableSelect label="Conta" options={contas} value={contaId} onChange={setContaId} onCreate={criarConta} />
      <div className="field">
        <label>Observação</label>
        <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>
      <div className="edit-actions">
        <button type="button" className="btn-cancel" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={salvar}>Salvar</button>
      </div>
    </div>
  );
}
