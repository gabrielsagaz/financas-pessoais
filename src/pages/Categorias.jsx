import { useState, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TIPOS } from '../db/defaultData';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconTrash, IconChevron, IconCard } from '../components/Icons';
import MoneyInput from '../components/MoneyInput';
import PinPad from '../components/PinPad';
import { definirPin, removerPin, pinEstaAtivo } from '../db/security';
import { exportarBackup, baixarBackupComoArquivo, importarBackup, apagarTodosOsLancamentos } from '../db/backup';
import { contaEhCartao } from '../utils/cartao';
import { contaTemSaldoControlado, calcularSaldoConta } from '../db/saldos';
import { formatCurrency, formatDateBR, hojeISO } from '../utils/format';

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

      <h2 style={{ marginTop: 32 }}>Dados</h2>
      <DadosBackup />
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

function DadosBackup() {
  const inputRef = useRef(null);
  const [mensagem, setMensagem] = useState(null); // { tipo: 'ok'|'erro', texto }
  const [confirmandoReset, setConfirmandoReset] = useState(false);
  const [confirmandoImport, setConfirmandoImport] = useState(null); // arquivo pendente

  async function exportar() {
    const backup = await exportarBackup();
    baixarBackupComoArquivo(backup);
    setMensagem({ tipo: 'ok', texto: 'Backup baixado com sucesso.' });
  }

  function escolherArquivo() {
    inputRef.current?.click();
  }

  function arquivoSelecionado(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = ''; // permite selecionar o mesmo arquivo de novo depois
    if (arquivo) setConfirmandoImport(arquivo);
  }

  async function confirmarImportacao() {
    const arquivo = confirmandoImport;
    setConfirmandoImport(null);
    try {
      const texto = await arquivo.text();
      const objeto = JSON.parse(texto);
      await importarBackup(objeto);
      setMensagem({ tipo: 'ok', texto: 'Backup restaurado com sucesso. Os dados anteriores foram substituídos.' });
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: `Não foi possível importar: ${err.message}` });
    }
  }

  async function confirmarReset() {
    await apagarTodosOsLancamentos();
    setConfirmandoReset(false);
    setMensagem({ tipo: 'ok', texto: 'Todos os lançamentos foram apagados. Categorias, contas e lançamentos fixos continuam configurados.' });
  }

  return (
    <div className="dados-backup-box">
      {mensagem && <p className={`mensagem${mensagem.tipo === 'erro' ? ' erro' : ''}`}>{mensagem.texto}</p>}

      <div className="dados-backup-linha">
        <div>
          <strong>Exportar backup</strong>
          <p className="dados-backup-descricao">Baixa um arquivo .json com todos os seus dados (lançamentos, categorias, contas, lançamentos fixos e orçamentos).</p>
        </div>
        <button type="button" className="btn-confirm" onClick={exportar}>Exportar</button>
      </div>

      <div className="dados-backup-linha">
        <div>
          <strong>Importar backup</strong>
          <p className="dados-backup-descricao">Restaura a partir de um arquivo .json exportado anteriormente. Substitui os dados atuais.</p>
        </div>
        <button type="button" className="btn-cancel" onClick={escolherArquivo}>Importar</button>
        <input ref={inputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={arquivoSelecionado} />
      </div>

      <div className="dados-backup-linha">
        <div>
          <strong>Apagar todos os lançamentos</strong>
          <p className="dados-backup-descricao">Remove permanentemente todo o histórico de receitas, despesas e investimentos. Exporte um backup antes, se quiser guardar esses dados.</p>
        </div>
        <button type="button" className="btn-danger" onClick={() => setConfirmandoReset(true)}>Apagar tudo</button>
      </div>

      <ConfirmDialog
        open={confirmandoReset}
        title="Apagar todos os lançamentos?"
        message="Essa ação não pode ser desfeita. Se você não exportou um backup ainda, cancele e exporte antes de continuar."
        onConfirm={confirmarReset}
        onCancel={() => setConfirmandoReset(false)}
      />

      <ConfirmDialog
        open={confirmandoImport !== null}
        title="Importar backup?"
        message="Isso vai SUBSTITUIR todos os dados atuais pelos dados do arquivo selecionado. Essa ação não pode ser desfeita."
        onConfirm={confirmarImportacao}
        onCancel={() => setConfirmandoImport(null)}
      />
    </div>
  );
}

function ListaContas() {
  const contas = useLiveQuery(() => db.contas.orderBy('ordem').toArray()) || [];
  const entradas = useLiveQuery(() => db.entries.toArray()) || [];
  const [novoNome, setNovoNome] = useState('');
  const [erro, setErro] = useState('');
  const [excluindoId, setExcluindoId] = useState(null);
  const [expandidaId, setExpandidaId] = useState(null);

  async function adicionar() {
    const nome = novoNome.trim();
    if (!nome) return;
    await db.contas.add({ nome, ordem: contas.length, arquivada: false, tipo: 'conta' });
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
      {contas.map((conta) => {
        const saldoAtual = contaTemSaldoControlado(conta) ? calcularSaldoConta(conta, entradas) : null;
        return (
          <div key={conta.id} className="categoria-card">
            <div className="categoria-header" onClick={() => setExpandidaId(expandidaId === conta.id ? null : conta.id)}>
              {contaEhCartao(conta) && <IconCard size={16} />}
              <input
                className="categoria-nome-input"
                value={conta.nome}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => renomear(conta, e.target.value)}
              />
              {saldoAtual !== null && (
                <span className="saldo-inline" style={{ color: saldoAtual >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {formatCurrency(saldoAtual)}
                </span>
              )}
              <button
                type="button"
                className="btn-excluir-mini"
                onClick={(e) => { e.stopPropagation(); setExcluindoId(conta.id); }}
              >
                <IconTrash />
              </button>
              <span className="expand-icon"><IconChevron open={expandidaId === conta.id} /></span>
            </div>
            {expandidaId === conta.id && (
              <>
                <ConfigCartao conta={conta} />
                <ConfigSaldo conta={conta} entradas={entradas} />
              </>
            )}
          </div>
        );
      })}
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

// Configuração de saldo controlado por conta: o usuário informa o saldo
// "de hoje" (não recalcula pra trás a partir do histórico antigo) e, a
// partir da data em que isso foi informado, o app soma/subtrai o que
// entrou e saiu. Se o saldo não bater com a realidade em algum momento
// (lançamento esquecido, etc), "recalibrar" reposiciona a referência pro
// saldo de hoje de novo.
function ConfigSaldo({ conta, entradas }) {
  const ativo = contaTemSaldoControlado(conta);
  const [configurando, setConfigurando] = useState(false);
  const [valorInicial, setValorInicial] = useState(0);
  const [valorRecalibrar, setValorRecalibrar] = useState(0);

  const saldoAtual = useMemo(() => calcularSaldoConta(conta, entradas), [conta, entradas]);

  async function confirmarAtivacao() {
    await db.contas.update(conta.id, { saldoInicial: valorInicial, saldoInicialData: hojeISO() });
    setConfigurando(false);
  }

  async function desativar() {
    await db.contas.update(conta.id, { saldoInicialData: null });
  }

  async function recalibrar() {
    await db.contas.update(conta.id, { saldoInicial: valorRecalibrar, saldoInicialData: hojeISO() });
    setValorRecalibrar(0);
  }

  return (
    <div className="config-cartao">
      <label className="switch-row">
        <span className="switch-label">Controlar saldo desta conta</span>
        <span
          className={`switch ${ativo ? 'ativo' : ''}`}
          onClick={() => (ativo ? desativar() : setConfigurando((v) => !v))}
        />
      </label>

      {!ativo && configurando && (
        <div className="config-cartao-dias">
          <div className="field">
            <label>Saldo de hoje</label>
            <MoneyInput value={valorInicial} onChange={setValorInicial} autoFocus />
          </div>
          <button type="button" className="btn-confirm" onClick={confirmarAtivacao}>Ativar controle de saldo</button>
        </div>
      )}

      {ativo && (
        <>
          <div className="saldo-atual-linha">
            <span>Saldo atual</span>
            <strong style={{ color: saldoAtual >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCurrency(saldoAtual)}</strong>
          </div>
          <p className="repeticao-explicacao">
            Calculado a partir do saldo informado em {formatDateBR(conta.saldoInicialData)}, somando o que entrou e
            saiu depois. Se não bater com a realidade, recalibre com o saldo de hoje:
          </p>
          <div className="config-cartao-dias">
            <div className="field">
              <label>Recalibrar saldo (usa a data de hoje)</label>
              <MoneyInput value={valorRecalibrar} onChange={setValorRecalibrar} />
            </div>
            <button type="button" className="btn-cancel" onClick={recalibrar}>Recalibrar</button>
          </div>
        </>
      )}
    </div>
  );
}

// Configuração de "cartão de crédito" pra uma conta: dia de fechamento
// (quando a fatura atual para de acumular) e dia de vencimento (quando essa
// fatura precisa ser paga). Guardado direto na própria conta — não precisa
// de tabela nova, só de mais alguns campos.
function ConfigCartao({ conta }) {
  const ehCartao = contaEhCartao(conta);
  const [diaFechamento, setDiaFechamento] = useState(conta.diaFechamento || 1);
  const [diaVencimento, setDiaVencimento] = useState(conta.diaVencimento || 10);

  async function alternarCartao() {
    if (ehCartao) {
      await db.contas.update(conta.id, { tipo: 'conta' });
    } else {
      await db.contas.update(conta.id, { tipo: 'cartao', diaFechamento, diaVencimento });
    }
  }

  async function salvarDias(campo, valor) {
    const dia = Math.min(31, Math.max(1, Number(valor) || 1));
    if (campo === 'fechamento') setDiaFechamento(dia); else setDiaVencimento(dia);
    await db.contas.update(conta.id, { [campo === 'fechamento' ? 'diaFechamento' : 'diaVencimento']: dia });
  }

  return (
    <div className="config-cartao">
      <label className="switch-row">
        <span className="switch-label"><IconCard size={17} /> É cartão de crédito</span>
        <span className={`switch ${ehCartao ? 'ativo' : ''}`} onClick={alternarCartao} />
      </label>

      {ehCartao && (
        <div className="config-cartao-dias">
          <div className="field">
            <label>Dia de fechamento da fatura</label>
            <input type="number" min="1" max="31" value={diaFechamento} onChange={(e) => salvarDias('fechamento', e.target.value)} />
          </div>
          <div className="field">
            <label>Dia de vencimento</label>
            <input type="number" min="1" max="31" value={diaVencimento} onChange={(e) => salvarDias('vencimento', e.target.value)} />
          </div>
          <p className="repeticao-explicacao">
            Compras depois do dia de fechamento entram na fatura seguinte. Isso só organiza a visualização no Histórico — não controla saldo nem gera cobrança automática.
          </p>
        </div>
      )}
    </div>
  );
}
