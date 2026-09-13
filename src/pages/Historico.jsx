import { useState, useMemo } from 'react';
import { useLiveQuery } from '../db/useLiveQuery';
import { db } from '../db/db';
import { TIPOS, TIPOS_TODOS, corDoTipo } from '../db/defaultData';
import { formatCurrency, formatDateBR, NOMES_MESES, anoMesDe } from '../utils/format';
import { projetarTodasAsRecorrencias, criarRecorrencia, definirValorExcecao, removerValorExcecao } from '../db/recorrencias';
import { calcularFaturaDoLancamento, contaEhCartao } from '../utils/cartao';
import EditableSelect from '../components/EditableSelect';
import MoneyInput from '../components/MoneyInput';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconTrash, IconRepeat, IconCopy } from '../components/Icons';

export default function Historico() {
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear());
  const [filtroMes, setFiltroMes] = useState(0); // 0 = todos
  const [editandoId, setEditandoId] = useState(null);
  const [editandoPrevistoChave, setEditandoPrevistoChave] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);
  const [mensagem, setMensagem] = useState('');

  const entradasReais = useLiveQuery(() => db.entries.orderBy('data').reverse().toArray(), []) || [];
  const categorias = useLiveQuery(() => db.categorias.toArray(), []) || [];
  const subcategorias = useLiveQuery(() => db.subcategorias.toArray(), []) || [];
  const contas = useLiveQuery(() => db.contas.orderBy('ordem').toArray(), []) || [];
  const recorrencias = useLiveQuery(() => db.recorrencias.toArray(), []) || [];
  const excecoesValor = useLiveQuery(() => db.excecoesValor.toArray(), []) || [];

  // Previsão dos lançamentos fixos futuros pro ano/mês filtrado — mesma
  // lógica do Resumo (não grava nada no banco, só dá visibilidade).
  const previsoes = useMemo(
    () => projetarTodasAsRecorrencias(recorrencias, entradasReais, excecoesValor, filtroAno, filtroMes === 0 ? 12 : filtroMes),
    [recorrencias, entradasReais, excecoesValor, filtroAno, filtroMes]
  );

  const entradas = useMemo(
    () => [...entradasReais, ...previsoes].sort((a, b) => (a.data < b.data ? 1 : -1)),
    [entradasReais, previsoes]
  );

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

  // Cria uma cópia independente do lançamento (não herda recorrência,
  // parcela nem, se for transferência, muda as contas) e abre em edição na
  // hora, pra ajustar data/valor rapidamente se for o caso.
  async function duplicar(entry) {
    const novoId = await db.entries.add({
      tipo: entry.tipo,
      valor: entry.valor,
      data: entry.data,
      categoriaId: entry.categoriaId,
      subcategoriaId: entry.subcategoriaId ?? null,
      contaId: entry.contaId ?? null,
      contaDestinoId: entry.contaDestinoId ?? null,
      nota: entry.nota || '',
      origem: 'manual',
      externalId: null,
      recorrenciaId: null,
      numeroParcela: null,
      criadoEm: new Date().toISOString()
    });
    setMensagem('Lançamento duplicado ✓ — ajuste o que precisar.');
    setEditandoId(novoId);
  }

  function descreverFatura(entry) {
    if (entry.tipo === 'transferencia') return null;
    const conta = contaPorId[entry.contaId];
    if (!conta || !contaEhCartao(conta)) return null;
    const { mesFatura, dataVencimento } = calcularFaturaDoLancamento(entry.data, conta.diaFechamento, conta.diaVencimento);
    return `Fatura de ${NOMES_MESES[mesFatura - 1]} · vence ${formatDateBR(dataVencimento)}`;
  }

  return (
    <div className="page">
      <h1>Histórico</h1>

      <div className="filtros">
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPOS_TODOS).map(([key, info]) => (
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

      {mensagem && <p className="mensagem">{mensagem}</p>}

      {listaFiltrada.length === 0 && <p className="vazio">Nenhum lançamento neste filtro.</p>}

      <ul className="lista-entries">
        {listaFiltrada.map((entry) => {
          const chave = entry.previsto ? `previsto-${entry.recorrenciaId}-${entry.data}` : entry.id;
          const fatura = !entry.previsto ? descreverFatura(entry) : null;
          return (
          <li key={chave} className={`entry-item${entry.previsto ? ' previsto' : ''}`}>
            {editandoId === entry.id && !entry.previsto ? (
              <EditarEntry
                entry={entry}
                onCancelar={() => setEditandoId(null)}
                onSalvo={() => setEditandoId(null)}
              />
            ) : entry.previsto && editandoPrevistoChave === chave ? (
              <EditarValorPrevisto
                entry={entry}
                onCancelar={() => setEditandoPrevistoChave(null)}
                onSalvo={() => setEditandoPrevistoChave(null)}
              />
            ) : (
              <div className="entry-linha">
                <div
                  className="entry-clickable"
                  onClick={() => (entry.previsto ? setEditandoPrevistoChave(chave) : setEditandoId(entry.id))}
                >
                  <span className="entry-dot" style={{ background: corDoTipo(entry.tipo) }} />
                  <div className="entry-info">
                    {entry.tipo === 'transferencia' ? (
                      <>
                        <div className="entry-categoria">
                          Transferência
                          {entry.previsto && <span className="tag-previsto">Previsto</span>}
                        </div>
                        <div className="entry-detalhe">
                          {formatDateBR(entry.data)} · {contaPorId[entry.contaId]?.nome || '?'} → {contaPorId[entry.contaDestinoId]?.nome || '?'}
                          {entry.nota && ` · ${entry.nota}`}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="entry-categoria">
                          {categoriaPorId[entry.categoriaId]?.nome || '(sem categoria)'}
                          {entry.subcategoriaId && subcategoriaPorId[entry.subcategoriaId] &&
                            ` › ${subcategoriaPorId[entry.subcategoriaId].nome}`}
                          {entry.recorrenciaId && <IconRepeat size={13} />}
                          {entry.previsto && <span className="tag-previsto">Previsto</span>}
                          {entry.valorAjustado && <span className="tag-previsto tag-ajustado">Valor ajustado</span>}
                        </div>
                        <div className="entry-detalhe">
                          {formatDateBR(entry.data)}
                          {entry.contaId && contaPorId[entry.contaId] && ` · ${contaPorId[entry.contaId].nome}`}
                          {entry.nota && ` · ${entry.nota}`}
                          {entry.numeroParcela && recorrenciaPorId[entry.recorrenciaId]?.totalParcelas &&
                            ` · Parcela ${entry.numeroParcela}/${recorrenciaPorId[entry.recorrenciaId].totalParcelas}`}
                        </div>
                      </>
                    )}
                    {fatura && <div className="entry-detalhe entry-fatura">{fatura}</div>}
                  </div>
                  <div className="entry-valor" style={{ color: corDoTipo(entry.tipo) }}>
                    {formatCurrency(entry.valor)}
                  </div>
                </div>
                {!entry.previsto && (
                  <>
                    <button type="button" className="btn-excluir-mini" title="Duplicar" onClick={() => duplicar(entry)}>
                      <IconCopy />
                    </button>
                    <button type="button" className="btn-excluir-mini" title="Excluir" onClick={() => setExcluindoId(entry.id)}>
                      <IconTrash />
                    </button>
                  </>
                )}
              </div>
            )}
          </li>
          );
        })}
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
  const [contaDestinoId, setContaDestinoId] = useState(entry.contaDestinoId ?? null);
  const [nota, setNota] = useState(entry.nota || '');
  const [repetir, setRepetir] = useState(false);
  const [modoRepeticao, setModoRepeticao] = useState('infinito'); // 'infinito' | 'parcelas'
  const [totalParcelas, setTotalParcelas] = useState('3');
  const [salvando, setSalvando] = useState(false);

  const ehTransferencia = entry.tipo === 'transferencia';
  const jaEhRecorrente = !!entry.recorrenciaId;

  const categorias = useLiveQuery(
    () => (ehTransferencia ? [] : db.categorias.where('tipo').equals(entry.tipo).sortBy('ordem')),
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
    return db.contas.add({ nome, ordem: contas.length, arquivada: false, tipo: 'conta' });
  }

  async function salvar() {
    setSalvando(true);
    try {
      if (ehTransferencia) {
        await db.entries.update(entry.id, { valor, data, contaId, contaDestinoId, nota: nota.trim() });
      } else if (repetir && !jaEhRecorrente) {
        // Transforma este lançamento avulso num lançamento fixo: remove a
        // entrada solta e deixa a recorrência gerar a ocorrência do mesmo
        // mês em seu lugar, já linkada (`recorrenciaId`).
        const parcelas = modoRepeticao === 'parcelas' ? Number(totalParcelas) : null;
        await db.entries.delete(entry.id);
        await criarRecorrencia({
          tipo: entry.tipo,
          valor,
          categoriaId,
          subcategoriaId: subcategoriaId ?? null,
          contaId: contaId ?? null,
          nota: nota.trim(),
          dataInicio: data,
          totalParcelas: parcelas
        });
      } else {
        await db.entries.update(entry.id, {
          valor,
          data,
          categoriaId,
          subcategoriaId: subcategoriaId ?? null,
          contaId: contaId ?? null,
          nota: nota.trim()
        });
      }
      onSalvo();
    } finally {
      setSalvando(false);
    }
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

      {ehTransferencia ? (
        <>
          <EditableSelect label="De (saiu de)" options={contas} value={contaId} onChange={setContaId} onCreate={criarConta} />
          <EditableSelect label="Para (entrou em)" options={contas.filter((c) => c.id !== contaId)} value={contaDestinoId} onChange={setContaDestinoId} onCreate={criarConta} />
        </>
      ) : (
        <>
          <EditableSelect label="Categoria" options={categorias} value={categoriaId} onChange={(id) => { setCategoriaId(id); setSubcategoriaId(null); }} onCreate={criarCategoria} />
          {subcategorias.length > 0 && (
            <EditableSelect label="Subcategoria" options={subcategorias} value={subcategoriaId} onChange={setSubcategoriaId} onCreate={criarSubcategoria} />
          )}
          <EditableSelect label="Conta" options={contas} value={contaId} onChange={setContaId} onCreate={criarConta} />
        </>
      )}

      <div className="field">
        <label>Observação</label>
        <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>

      {!ehTransferencia && (
        jaEhRecorrente ? (
          <p className="repeticao-explicacao"><IconRepeat size={13} /> Esta é uma ocorrência de um lançamento fixo — pausar ou excluir a recorrência é feito em "Lançar".</p>
        ) : (
          <>
            <label className="switch-row">
              <span className="switch-label"><IconRepeat size={17} /> Tornar recorrente</span>
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
                  <p className="repeticao-explicacao">A partir deste lançamento, vai repetir todo mês, sem parar.</p>
                ) : (
                  <div className="field">
                    <label htmlFor="parcelas-edit">Quantas vezes, contando esta (ex: 3 = essa + mais 2)</label>
                    <input
                      id="parcelas-edit"
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
          </>
        )
      )}

      <div className="edit-actions">
        <button type="button" className="btn-cancel" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="btn-primary" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </div>
  );
}

// Edição bem mais simples que EditarEntry: um "previsto" não existe de
// verdade no banco ainda, então só faz sentido ajustar o valor DAQUELE mês
// específico (ex: conta de luz mais cara em janeiro) — categoria, conta e
// data continuam vindo da recorrência normalmente. O ajuste vira uma
// exceção (`excecoesValor`) e é consumido automaticamente quando o mês
// chegar e o lançamento real for gerado.
function EditarValorPrevisto({ entry, onCancelar, onSalvo }) {
  const [valor, setValor] = useState(entry.valor);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await definirValorExcecao(entry.recorrenciaId, entry.anoMes, valor);
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  async function usarValorPadrao() {
    setSalvando(true);
    try {
      await removerValorExcecao(entry.recorrenciaId, entry.anoMes);
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="edit-box">
      <p className="repeticao-explicacao">
        Esse ajuste vale só para {formatDateBR(entry.data)} — os outros meses deste lançamento fixo continuam com o valor padrão.
      </p>
      <div className="field">
        <label>Valor deste mês</label>
        <MoneyInput value={valor} onChange={setValor} autoFocus />
      </div>
      <div className="edit-actions">
        <button type="button" className="btn-cancel" onClick={onCancelar}>Cancelar</button>
        {entry.valorAjustado && (
          <button type="button" className="btn-cancel" disabled={salvando} onClick={usarValorPadrao}>Usar valor padrão</button>
        )}
        <button type="button" className="btn-primary" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </div>
  );
}
