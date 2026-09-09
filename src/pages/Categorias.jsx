import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TIPOS } from '../db/defaultData';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconTrash, IconChevron } from '../components/Icons';
import MoneyInput from '../components/MoneyInput';
import PinPad from '../components/PinPad';
import { definirPin, removerPin, pinEstaAtivo } from '../db/security';

export default function Categorias() {
  const [tipoAtivo, setTipoAtivo] = useState('despesa');

  return (
    <div className="page">
      <h1>Categorias e contas</h1>

      <div className="tipo-tabs">
        {Object.entries(TIPOS).map(([key, info]) => (
          <button
            key={key}
            type="button"
            className={`tipo-tab ${tipoAtivo === key ? 'ativo' : ''}`}
            style={tipoAtivo === key ? { color: info.cor } : undefined}
            onClick={() => setTipoAtivo(key)}
          >
            {info.label}
          </button>
        ))}
      </div>

      <ListaCategorias tipo={tipoAtivo} />

      <h2 style={{ marginTop: 32 }}>Contas</h2>
      <ListaContas />

      <h2 style={{ marginTop: 32 }}>Segurança</h2>
      <Seguranca />
    </div>
  );
}

function ListaCategorias({ tipo }) {
  const categorias = useLiveQuery(() => db.categorias.where('tipo').equals(tipo).sortBy('ordem'), [tipo]) || [];
  const [expandidaId, setExpandidaId] = useState(null);
  const [novoNome, setNovoNome] = useState('');
  const [erro, setErro] = useState('');
  const [excluindo, setExcluindo] = useState(null); // { tipo: 'categoria'|'subcategoria', id }

  async function adicionar() {
    const nome = novoNome.trim();
    if (!nome) return;
    await db.categorias.add({ tipo, nome, ordem: categorias.length });
    setNovoNome('');
  }

  async function renomear(categoria, novoValor) {
    if (!novoValor.trim()) return;
    await db.categorias.update(categoria.id, { nome: novoValor.trim() });
  }

  async function confirmarExclusao() {
    const { tipo: alvoTipo, id } = excluindo;
    if (alvoTipo === 'categoria') {
      const usada = await db.entries.where('categoriaId').equals(id).count();
      if (usada > 0) {
        setErro(`Não é possível excluir: ${usada} lançamento(s) usam essa categoria.`);
        setExcluindo(null);
        return;
      }
      await db.subcategorias.where('categoriaId').equals(id).delete();
      await db.orcamentos.where('categoriaId').equals(id).delete();
      await db.categorias.delete(id);
    } else {
      const usada = await db.entries.where('subcategoriaId').equals(id).count();
      if (usada > 0) {
        setErro(`Não é possível excluir: ${usada} lançamento(s) usam essa subcategoria.`);
        setExcluindo(null);
        return;
      }
      await db.subcategorias.delete(id);
    }
    setErro('');
    setExcluindo(null);
  }

  return (
    <div className="lista-categorias">
      {erro && <p className="mensagem erro">{erro}</p>}

      {categorias.map((cat) => (
        <div key={cat.id} className="categoria-card">
          <div className="categoria-header" onClick={() => setExpandidaId(expandidaId === cat.id ? null : cat.id)}>
            <input
              className="categoria-nome-input"
              value={cat.nome}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => renomear(cat, e.target.value)}
            />
            <button
              type="button"
              className="btn-excluir-mini"
              onClick={(e) => { e.stopPropagation(); setExcluindo({ tipo: 'categoria', id: cat.id }); }}
            >
              <IconTrash />
            </button>
            <span className="expand-icon"><IconChevron open={expandidaId === cat.id} /></span>
          </div>

          {expandidaId === cat.id && (
            <>
              <Subcategorias categoriaId={cat.id} onExcluir={(id) => setExcluindo({ tipo: 'subcategoria', id })} />
              {tipo === 'despesa' && <OrcamentoCategoria categoriaId={cat.id} />}
            </>
          )}
        </div>
      ))}

      <div className="inline-add">
        <input
          type="text"
          placeholder={`Nova categoria de ${TIPOS[tipo].label.toLowerCase()}...`}
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
        />
        <button type="button" className="btn-confirm" onClick={adicionar}>Adicionar</button>
      </div>

      <ConfirmDialog
        open={excluindo !== null}
        title="Excluir?"
        message="Só é possível excluir se não houver lançamentos usando este item."
        onConfirm={confirmarExclusao}
        onCancel={() => setExcluindo(null)}
      />
    </div>
  );
}

function Subcategorias({ categoriaId, onExcluir }) {
  const subcategorias = useLiveQuery(
    () => db.subcategorias.where('categoriaId').equals(categoriaId).sortBy('ordem'),
    [categoriaId]
  ) || [];
  const [novoNome, setNovoNome] = useState('');

  async function adicionar() {
    const nome = novoNome.trim();
    if (!nome) return;
    await db.subcategorias.add({ categoriaId, nome, ordem: subcategorias.length });
    setNovoNome('');
  }

  async function renomear(sub, novoValor) {
    if (!novoValor.trim()) return;
    await db.subcategorias.update(sub.id, { nome: novoValor.trim() });
  }

  return (
    <div className="subcategorias-lista">
      {subcategorias.map((sub) => (
        <div key={sub.id} className="subcategoria-item">
          <input value={sub.nome} onChange={(e) => renomear(sub, e.target.value)} />
          <button type="button" className="btn-excluir-mini" onClick={() => onExcluir(sub.id)}><IconTrash /></button>
        </div>
      ))}
      <div className="inline-add">
        <input
          type="text"
          placeholder="Nova subcategoria..."
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
        />
        <button type="button" className="btn-confirm" onClick={adicionar}>+</button>
      </div>
    </div>
  );
}

function OrcamentoCategoria({ categoriaId }) {
  const orcamento = useLiveQuery(() => db.orcamentos.where('categoriaId').equals(categoriaId).first(), [categoriaId]);
  const valorAtual = orcamento?.limite ?? 0;

  async function salvar(novoValor) {
    if (novoValor <= 0) {
      if (orcamento) await db.orcamentos.delete(orcamento.id);
      return;
    }
    if (orcamento) {
      await db.orcamentos.update(orcamento.id, { limite: novoValor });
    } else {
      await db.orcamentos.add({ categoriaId, limite: novoValor });
    }
  }

  return (
    <div className="orcamento-field">
      <label>Orçamento mensal (opcional)</label>
      <MoneyInput value={valorAtual} onChange={salvar} />
    </div>
  );
}

function Seguranca() {
  const ativo = useLiveQuery(() => pinEstaAtivo(), []);
  const [configurando, setConfigurando] = useState(false);
  const [etapa, setEtapa] = useState('criar'); // 'criar' | 'confirmar'
  const [primeiroPin, setPrimeiroPin] = useState('');
  const [erro, setErro] = useState('');

  function iniciarConfiguracao() {
    setConfigurando(true);
    setEtapa('criar');
    setPrimeiroPin('');
    setErro('');
  }

  async function receberPin(pin) {
    if (etapa === 'criar') {
      setPrimeiroPin(pin);
      setEtapa('confirmar');
    } else {
      if (pin === primeiroPin) {
        await definirPin(pin);
        setConfigurando(false);
      } else {
        setErro('Os códigos não coincidem. Tente de novo.');
        setEtapa('criar');
        setPrimeiroPin('');
      }
    }
  }

  async function desativar() {
    await removerPin();
  }

  return (
    <div className="seguranca-box">
      {!configurando ? (
        <>
          <div className="seguranca-status">
            <span>PIN de acesso</span>
            <strong>{ativo ? 'Ativado' : 'Desativado'}</strong>
          </div>
          {ativo ? (
            <button type="button" className="btn-cancel" onClick={desativar}>Desativar PIN</button>
          ) : (
            <button type="button" className="btn-confirm" onClick={iniciarConfiguracao}>Configurar PIN</button>
          )}
        </>
      ) : (
        <div className="pin-setup">
          <p className="lock-subtitulo">{etapa === 'criar' ? 'Crie um código de 4 dígitos' : 'Digite de novo pra confirmar'}</p>
          {erro && <p className="mensagem erro">{erro}</p>}
          <PinPad key={etapa} onComplete={receberPin} />
          <button type="button" className="btn-cancel" onClick={() => setConfigurando(false)}>Cancelar</button>
        </div>
      )}
    </div>
  );
}

function ListaContas() {
  const contas = useLiveQuery(() => db.contas.orderBy('ordem').toArray()) || [];
  const [novoNome, setNovoNome] = useState('');
  const [erro, setErro] = useState('');
  const [excluindoId, setExcluindoId] = useState(null);

  async function adicionar() {
    const nome = novoNome.trim();
    if (!nome) return;
    await db.contas.add({ nome, ordem: contas.length, arquivada: false });
    setNovoNome('');
  }

  async function renomear(conta, novoValor) {
    if (!novoValor.trim()) return;
    await db.contas.update(conta.id, { nome: novoValor.trim() });
  }

  async function confirmarExclusao() {
    const usada = await db.entries.where('contaId').equals(excluindoId).count();
    if (usada > 0) {
      setErro(`Não é possível excluir: ${usada} lançamento(s) usam essa conta.`);
      setExcluindoId(null);
      return;
    }
    await db.contas.delete(excluindoId);
    setErro('');
    setExcluindoId(null);
  }

  return (
    <div className="lista-contas">
      {erro && <p className="mensagem erro">{erro}</p>}
      {contas.map((conta) => (
        <div key={conta.id} className="subcategoria-item">
          <input value={conta.nome} onChange={(e) => renomear(conta, e.target.value)} />
          <button type="button" className="btn-excluir-mini" onClick={() => setExcluindoId(conta.id)}><IconTrash /></button>
        </div>
      ))}
      <div className="inline-add">
        <input
          type="text"
          placeholder="Nova conta..."
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
        />
        <button type="button" className="btn-confirm" onClick={adicionar}>Adicionar</button>
      </div>

      <ConfirmDialog
        open={excluindoId !== null}
        title="Excluir conta?"
        message="Só é possível excluir se não houver lançamentos usando esta conta."
        onConfirm={confirmarExclusao}
        onCancel={() => setExcluindoId(null)}
      />
    </div>
  );
}
