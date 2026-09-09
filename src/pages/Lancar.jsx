import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TIPOS } from '../db/defaultData';
import { hojeISO, formatCurrency } from '../utils/format';
import { criarRecorrencia, alternarRecorrencia, excluirRecorrencia } from '../db/recorrencias';
import MoneyInput from '../components/MoneyInput';
import EditableSelect from '../components/EditableSelect';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconRepeat, IconTrash } from '../components/Icons';

const TIPO_INICIAL = 'despesa';

export default function Lancar() {
  const [tipo, setTipo] = useState(TIPO_INICIAL);
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(hojeISO());
  const [categoriaId, setCategoriaId] = useState(null);
  const [subcategoriaId, setSubcategoriaId] = useState(null);
  const [contaId, setContaId] = useState(null);
  const [nota, setNota] = useState('');
  const [repetir, setRepetir] = useState(false);
  const [modoRepeticao, setModoRepeticao] = useState('infinito'); // 'infinito' | 'parcelas'
  const [totalParcelas, setTotalParcelas] = useState('3');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [excluindoRecId, setExcluindoRecId] = useState(null);

  const categorias = useLiveQuery(
    () => db.categorias.where('tipo').equals(tipo).sortBy('ordem'),
    [tipo]
  ) || [];

  const subcategorias = useLiveQuery(
    () => (categoriaId ? db.subcategorias.where('categoriaId').equals(categoriaId).sortBy('ordem') : []),
    [categoriaId]
  ) || [];

  const contas = useLiveQuery(() => db.contas.orderBy('ordem').toArray()) || [];

  const recorrencias = useLiveQuery(() => db.recorrencias.where('tipo').equals(tipo).toArray(), [tipo]) || [];
  const todasCategorias = useLiveQuery(() => db.categorias.toArray()) || [];
  const todasSubcategorias = useLiveQuery(() => db.subcategorias.toArray()) || [];
  const categoriaPorId = Object.fromEntries(todasCategorias.map((c) => [c.id, c]));
  const subcategoriaPorId = Object.fromEntries(todasSubcategorias.map((s) => [s.id, s]));
  const contaPorId = Object.fromEntries(contas.map((c) => [c.id, c]));

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
    setCategoriaId(null);
    setSubcategoriaId(null);
    setRepetir(false);
    setModoRepeticao('infinito');
    setTotalParcelas('3');
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
    if (repetir && modoRepeticao === 'parcelas' && (!totalParcelas || Number(totalParcelas) < 2)) {
      setMensagem('Informe um número de vezes a partir de 2.');
      return;
    }

    setSalvando(true);
    try {
      if (repetir) {
        const parcelas = modoRepeticao === 'parcelas' ? Number(totalParcelas) : null;
        await criarRecorrencia({
          tipo,
          valor,
          categoriaId,
          subcategoriaId: subcategoriaId ?? null,
          contaId: contaId ?? null,
          nota: nota.trim(),
          dataInicio: data,
          totalParcelas: parcelas
        });
        setMensagem(parcelas ? `Lançamento parcelado criado ✓ — 1/${parcelas}` : 'Lançamento fixo criado ✓ — vai repetir todo mês');
      } else {
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
          recorrenciaId: null,
          criadoEm: new Date().toISOString()
        });
        setMensagem('Lançamento salvo ✓');
      }
      limparFormulario();
    } finally {
      setSalvando(false);
    }
  }

  function descreverRecorrencia(rec) {
    const cat = categoriaPorId[rec.categoriaId]?.nome || '(sem categoria)';
    const sub = rec.subcategoriaId && subcategoriaPorId[rec.subcategoriaId] ? ` › ${subcategoriaPorId[rec.subcategoriaId].nome}` : '';
    const conta = rec.contaId && contaPorId[rec.contaId] ? ` · ${contaPorId[rec.contaId].nome}` : '';
    return `${cat}${sub}${conta} · dia ${rec.diaDoMes}`;
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
            style={tipo === key ? { color: info.cor } : undefined}
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

        {categoriaId && (
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

        <label className="switch-row">
          <span className="switch-label"><IconRepeat size={17} /> Repetir</span>
          <span className={`switch ${repetir ? 'ativo' : ''}`} onClick={() => setRepetir((v) => !v)} />
        </label>

        {repetir && (
          <div className="repeticao-opcoes">
            <div className="tipo-tabs" style={{ marginBottom: 10 }}>
              <button
                type="button"
                className={`tipo-tab ${modoRepeticao === 'infinito' ? 'ativo' : ''}`}
                style={modoRepeticao === 'infinito' ? { color: 'var(--blue)' } : undefined}
                onClick={() => setModoRepeticao('infinito')}
              >
                Todo mês
              </button>
              <button
                type="button"
                className={`tipo-tab ${modoRepeticao === 'parcelas' ? 'ativo' : ''}`}
                style={modoRepeticao === 'parcelas' ? { color: 'var(--blue)' } : undefined}
                onClick={() => setModoRepeticao('parcelas')}
              >
                Número de vezes
              </button>
            </div>

            {modoRepeticao === 'infinito' ? (
              <p className="repeticao-explicacao">Repete todo mês, sem parar — ex: salário, aluguel, plano de saúde.</p>
            ) : (
              <div className="field">
                <label htmlFor="parcelas">Quantas vezes (ex: compra em 3x no cartão)</label>
                <input
                  id="parcelas"
                  type="number"
                  min="2"
                  inputMode="numeric"
                  value={totalParcelas}
                  onChange={(e) => setTotalParcelas(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {mensagem && <p className="mensagem">{mensagem}</p>}

        <button type="submit" className="btn-primary" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar lançamento'}
        </button>
      </form>

      {recorrencias.length > 0 && (
        <>
          <h2>Lançamentos fixos — {TIPOS[tipo].label.toLowerCase()}</h2>
          <ul className="lista-entries">
            {recorrencias.map((rec) => (
              <RecorrenciaItem
                key={rec.id}
                rec={rec}
                cor={TIPOS[tipo].cor}
                descricao={descreverRecorrencia(rec)}
                onAlternar={() => alternarRecorrencia(rec.id, !rec.ativa)}
                onExcluir={() => setExcluindoRecId(rec.id)}
              />
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={excluindoRecId !== null}
        title="Excluir lançamento fixo?"
        message="Os lançamentos já gerados continuam no histórico — só para de criar novos a partir de agora."
        onConfirm={async () => { await excluirRecorrencia(excluindoRecId); setExcluindoRecId(null); }}
        onCancel={() => setExcluindoRecId(null)}
      />
    </div>
  );
}

function RecorrenciaItem({ rec, cor, descricao, onAlternar, onExcluir }) {
  const totalGeradas = useLiveQuery(() => db.entries.where('recorrenciaId').equals(rec.id).count(), [rec.id]);
  const concluida = !rec.ativa && rec.totalParcelas && totalGeradas >= rec.totalParcelas;

  let status;
  if (rec.totalParcelas) {
    status = concluida ? `Concluído (${rec.totalParcelas}/${rec.totalParcelas})` : `Parcela ${totalGeradas ?? '…'}/${rec.totalParcelas}`;
  } else {
    status = rec.ativa ? 'Ativo · todo mês' : 'Pausado';
  }

  const corAtual = rec.ativa ? cor : '#c7c7cc';

  return (
    <li className="entry-item">
      <div className="entry-linha">
        <div className="entry-clickable" style={{ cursor: 'default' }}>
          <span className="entry-dot" style={{ background: corAtual }} />
          <div className="entry-info">
            <div className="entry-categoria">{descricao}</div>
            <div className="entry-detalhe">{status}</div>
          </div>
          <div className="entry-valor" style={{ color: corAtual }}>
            {formatCurrency(rec.valor)}
          </div>
        </div>
        {!concluida && (
          <button type="button" className="btn-excluir-mini" title={rec.ativa ? 'Pausar' : 'Retomar'} onClick={onAlternar}>
            <IconRepeat size={17} />
          </button>
        )}
        <button type="button" className="btn-excluir-mini" onClick={onExcluir}>
          <IconTrash />
        </button>
      </div>
    </li>
  );
}
