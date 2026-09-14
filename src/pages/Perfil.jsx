import { useState, useRef, useMemo, useEffect } from 'react';
import { useLiveQuery } from '../db/useLiveQuery';
import { db } from '../db/db';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconTrash, IconChevron, IconCard, IconArrowLeft } from '../components/Icons';
import MoneyInput from '../components/MoneyInput';
import EditableSelect from '../components/EditableSelect';
import PinPad from '../components/PinPad';
import { definirPin, removerPin, pinEstaAtivo } from '../db/security';
import { exportarBackup, baixarBackupComoArquivo, importarBackup, apagarTodosOsLancamentos } from '../db/backup';
import { diaFechamentoEfetivo, diaVencimentoEfetivo } from '../utils/cartao';
import { contaTemSaldoControlado, calcularSaldoConta } from '../db/saldos';
import { formatCurrency, formatDateBR, hojeISO } from '../utils/format';
import { salvarPerfil, salvarTema, perfilPadrao, salvarConfig } from '../db/preferencias';
import { classificarCategoriasExistentes } from '../utils/classificacao';
import { useAuth } from '../firebase/authContext';

const EMOJIS_AVATAR = ['🙂', '😎', '🧑', '👩', '👨', '🐱', '🐶', '🦊', '🐼', '🌟', '💰', '📈'];

export default function Perfil({ onVoltar }) {
  return (
    <div className="page">
      <button type="button" className="botao-voltar" onClick={onVoltar}>
        <IconArrowLeft size={18} /> Voltar
      </button>
      <h1>Perfil</h1>

      <MeuPerfil />

      <h2 style={{ marginTop: 32 }}>Conta</h2>
      <ContaGoogle />

      <h2 style={{ marginTop: 32 }}>Preferências</h2>
      <PreferenciaTema />

      <h2 style={{ marginTop: 32 }}>Contas</h2>
      <ListaContas />

      <h2 style={{ marginTop: 32 }}>Dívidas</h2>
      <ListaDividas />

      <h2 style={{ marginTop: 32 }}>Provisões</h2>
      <ListaProvisoes />

      <h2 style={{ marginTop: 32 }}>Planejamento</h2>
      <MetasCascata />

      <h2 style={{ marginTop: 32 }}>Segurança</h2>
      <Seguranca />

      <h2 style={{ marginTop: 32 }}>Dados</h2>
      <DadosBackup />
    </div>
  );
}

// E-mail da conta Google logada (identidade de verdade, usada pra
// sincronizar entre dispositivos) + botão de sair. Nome/emoji abaixo
// continuam sendo só personalização visual, independentes disso.
function ContaGoogle() {
  const { usuario, sair } = useAuth();

  function confirmarSaida() {
    if (window.confirm('Sair da conta? Você precisa entrar de novo com o Google pra acessar seus dados neste dispositivo.')) {
      sair();
    }
  }

  return (
    <div className="seguranca-box">
      <div className="seguranca-status">
        <span>Conta Google</span>
        <strong>{usuario?.email}</strong>
      </div>
      <button type="button" className="btn-cancel" onClick={confirmarSaida}>
        Sair da conta
      </button>
    </div>
  );
}

// Perfil local — nome + emoji como avatar, independente da conta Google
// (é só personalização visual do app, não a identidade usada pro login).
function MeuPerfil() {
  const registro = useLiveQuery(() => db.configuracoes.where('chave').equals('perfil').first(), []);
  const perfil = useMemo(() => (registro ? JSON.parse(registro.valor) : perfilPadrao()), [registro]);
  const [nome, setNome] = useState(perfil.nome);
  const [escolhendoEmoji, setEscolhendoEmoji] = useState(false);

  // `perfil` só chega de verdade depois que o useLiveQuery resolve a
  // primeira leitura — sincroniza o campo quando o valor salvo carrega.
  useEffect(() => { setNome(perfil.nome); }, [perfil.nome]);

  async function salvarNome(novoNome) {
    setNome(novoNome);
    await salvarPerfil({ ...perfil, nome: novoNome });
  }

  async function escolherEmoji(emoji) {
    await salvarPerfil({ ...perfil, emoji, foto: null });
    setEscolhendoEmoji(false);
  }

  return (
    <div className="perfil-box">
      <button type="button" className="perfil-avatar" onClick={() => setEscolhendoEmoji((v) => !v)}>
        {perfil.foto ? <img src={perfil.foto} alt="" className="avatar-foto" /> : perfil.emoji}
      </button>
      <div className="field" style={{ flex: 1 }}>
        <label>Nome</label>
        <input type="text" value={nome} onChange={(e) => salvarNome(e.target.value)} placeholder="Seu nome" />
      </div>

      {escolhendoEmoji && (
        <div className="perfil-emojis">
          {perfil.foto && (
            <p className="repeticao-explicacao" style={{ width: '100%' }}>
              Escolher um emoji troca a foto da sua conta Google pelo emoji.
            </p>
          )}
          {EMOJIS_AVATAR.map((emoji) => (
            <button key={emoji} type="button" className="perfil-emoji-opcao" onClick={() => escolherEmoji(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Tema: 'auto' (segue o sistema) | 'claro' | 'escuro'. Aplicado pelo
// App.jsx via atributo data-theme na tag <html>.
function PreferenciaTema() {
  const registro = useLiveQuery(() => db.configuracoes.where('chave').equals('tema').first(), []);
  const tema = registro?.valor || 'auto';

  const OPCOES = [
    { valor: 'auto', label: 'Automático' },
    { valor: 'claro', label: 'Claro' },
    { valor: 'escuro', label: 'Escuro' }
  ];

  return (
    <div className="tipo-tabs">
      {OPCOES.map((o) => (
        <button
          key={o.valor}
          type="button"
          className={`tipo-tab ${tema === o.valor ? 'ativo' : ''}`}
          style={tema === o.valor ? { color: 'var(--blue)' } : undefined}
          onClick={() => salvarTema(o.valor)}
        >
          {o.label}
        </button>
      ))}
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
          <p className="dados-backup-descricao">Remove permanentemente todo o histórico de receitas, despesas e investimentos, incluindo lançamentos fixos/recorrentes, e reseta o saldo definido em cada conta. Exporte um backup antes, se quiser guardar esses dados.</p>
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
                <ConfigReserva conta={conta} />
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

// Dívidas (Fase 3 — planejamento em cascata): valor total devido + parcela
// mensal. Não gera lançamento nenhum sozinha — é só o registro que o
// Planejamento usa pra saber quanto reservar todo mês. Quando o valor pago
// chega ao total, a dívida fica quitada e some da cascata automaticamente
// (sem precisar excluir — o histórico continua ali se quiser conferir).
function ListaDividas() {
  const dividas = useLiveQuery(() => db.dividas.toArray(), []) || [];
  const [novoNome, setNovoNome] = useState('');
  const [expandidaId, setExpandidaId] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);

  async function adicionar() {
    const nome = novoNome.trim();
    if (!nome) return;
    await db.dividas.add({ nome, valorTotal: 0, valorPago: 0, parcelaMensal: 0, criadoEm: new Date().toISOString() });
    setNovoNome('');
  }

  async function renomear(divida, novoValor) {
    if (!novoValor.trim()) return;
    await db.dividas.update(divida.id, { nome: novoValor.trim() });
  }

  async function salvarCampo(divida, campo, valor) {
    await db.dividas.update(divida.id, { [campo]: valor });
  }

  async function marcarParcelaPaga(divida) {
    const novoPago = Math.min(divida.valorTotal, divida.valorPago + divida.parcelaMensal);
    await db.dividas.update(divida.id, { valorPago: novoPago });
  }

  async function confirmarExclusao() {
    await db.dividas.delete(excluindoId);
    setExcluindoId(null);
  }

  return (
    <div className="lista-contas">
      {dividas.map((divida) => {
        const restante = Math.max(0, divida.valorTotal - divida.valorPago);
        const quitada = divida.valorTotal > 0 && restante === 0;
        return (
          <div key={divida.id} className="categoria-card">
            <div className="categoria-header" onClick={() => setExpandidaId(expandidaId === divida.id ? null : divida.id)}>
              <input
                className="categoria-nome-input"
                value={divida.nome}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => renomear(divida, e.target.value)}
              />
              <span className="saldo-inline" style={{ color: quitada ? 'var(--green)' : 'var(--red)' }}>
                {quitada ? 'Quitada' : formatCurrency(restante)}
              </span>
              <button
                type="button"
                className="btn-excluir-mini"
                onClick={(e) => { e.stopPropagation(); setExcluindoId(divida.id); }}
              >
                <IconTrash />
              </button>
              <span className="expand-icon"><IconChevron open={expandidaId === divida.id} /></span>
            </div>
            {expandidaId === divida.id && (
              <div className="config-cartao">
                <div className="field">
                  <label>Valor total devido</label>
                  <MoneyInput value={divida.valorTotal} onChange={(v) => salvarCampo(divida, 'valorTotal', v)} />
                </div>
                <div className="field">
                  <label>Parcela mensal</label>
                  <MoneyInput value={divida.parcelaMensal} onChange={(v) => salvarCampo(divida, 'parcelaMensal', v)} />
                </div>
                <div className="field">
                  <label>Já pago</label>
                  <MoneyInput value={divida.valorPago} onChange={(v) => salvarCampo(divida, 'valorPago', v)} />
                </div>
                {!quitada && divida.parcelaMensal > 0 && (
                  <button type="button" className="btn-confirm" style={{ width: '100%' }} onClick={() => marcarParcelaPaga(divida)}>
                    Marcar parcela paga (+{formatCurrency(Math.min(divida.parcelaMensal, restante))})
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="inline-add">
        <input
          type="text"
          placeholder="Nova dívida (ex: Financiamento do carro)..."
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
        />
        <button type="button" className="btn-confirm" onClick={adicionar}>Adicionar</button>
      </div>

      <ConfirmDialog
        open={excluindoId !== null}
        title="Excluir dívida?"
        message="Remove o registro por completo — não afeta nenhum lançamento já feito."
        onConfirm={confirmarExclusao}
        onCancel={() => setExcluindoId(null)}
      />
    </div>
  );
}

// Provisões (Fase 3 — envelopes/sinking funds): um valor anual (ex: IPTU,
// seguro) dividido num aporte mensal que vai se acumulando numa conta até o
// gasto acontecer. Diferente de dívida: aqui você está GUARDANDO pra um
// gasto futuro certo, não pagando algo que já aconteceu. Ao confirmar o
// gasto, cria a despesa de verdade (na categoria e conta escolhidas) e
// zera o acumulado, reiniciando o ciclo pro próximo ano.
function ListaProvisoes() {
  const provisoes = useLiveQuery(() => db.provisoes.toArray(), []) || [];
  const categorias = useLiveQuery(() => db.categorias.where('tipo').equals('despesa').sortBy('ordem'), []) || [];
  const contas = useLiveQuery(() => db.contas.orderBy('ordem').toArray(), []) || [];
  const [novoNome, setNovoNome] = useState('');
  const [expandidaId, setExpandidaId] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);
  const [gastandoId, setGastandoId] = useState(null);

  async function adicionar() {
    const nome = novoNome.trim();
    if (!nome) return;
    await db.provisoes.add({
      nome, valorAlvo: 0, aporteMensal: 0, valorAcumulado: 0,
      contaId: null, categoriaId: null, criadoEm: new Date().toISOString()
    });
    setNovoNome('');
  }

  async function renomear(provisao, novoValor) {
    if (!novoValor.trim()) return;
    await db.provisoes.update(provisao.id, { nome: novoValor.trim() });
  }

  async function salvarCampo(provisao, campo, valor) {
    await db.provisoes.update(provisao.id, { [campo]: valor });
  }

  async function confirmarGasto(provisao) {
    if (!provisao.contaId || !provisao.categoriaId) return;
    await db.entries.add({
      tipo: 'despesa',
      valor: provisao.valorAcumulado,
      data: hojeISO(),
      categoriaId: provisao.categoriaId,
      subcategoriaId: null,
      contaId: provisao.contaId,
      formaPagamento: 'debito',
      nota: `Provisão: ${provisao.nome}`,
      origem: 'manual',
      externalId: null,
      recorrenciaId: null,
      criadoEm: new Date().toISOString()
    });
    await db.provisoes.update(provisao.id, { valorAcumulado: 0 });
    setGastandoId(null);
  }

  async function confirmarExclusao() {
    await db.provisoes.delete(excluindoId);
    setExcluindoId(null);
  }

  async function criarCategoria(nome) {
    return db.categorias.add({ tipo: 'despesa', nome, ordem: categorias.length });
  }
  async function criarConta(nome) {
    return db.contas.add({ nome, ordem: contas.length, arquivada: false, tipo: 'conta' });
  }

  return (
    <div className="lista-contas">
      {provisoes.map((provisao) => {
        const percentual = provisao.valorAlvo > 0 ? Math.min(100, (provisao.valorAcumulado / provisao.valorAlvo) * 100) : 0;
        return (
          <div key={provisao.id} className="categoria-card">
            <div className="categoria-header" onClick={() => setExpandidaId(expandidaId === provisao.id ? null : provisao.id)}>
              <input
                className="categoria-nome-input"
                value={provisao.nome}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => renomear(provisao, e.target.value)}
              />
              <span className="saldo-inline" style={{ color: 'var(--blue)' }}>
                {formatCurrency(provisao.valorAcumulado)} / {formatCurrency(provisao.valorAlvo)}
              </span>
              <button
                type="button"
                className="btn-excluir-mini"
                onClick={(e) => { e.stopPropagation(); setExcluindoId(provisao.id); }}
              >
                <IconTrash />
              </button>
              <span className="expand-icon"><IconChevron open={expandidaId === provisao.id} /></span>
            </div>
            {expandidaId === provisao.id && (
              <div className="config-cartao">
                <div className="orcamento-barra" style={{ margin: '0 12px 4px' }}>
                  <div className="orcamento-barra-fill" style={{ width: `${percentual}%`, background: 'var(--blue)' }} />
                </div>
                <div className="field">
                  <label>Valor anual necessário</label>
                  <MoneyInput value={provisao.valorAlvo} onChange={(v) => salvarCampo(provisao, 'valorAlvo', v)} />
                </div>
                <div className="field">
                  <label>Aporte mensal</label>
                  <MoneyInput value={provisao.aporteMensal} onChange={(v) => salvarCampo(provisao, 'aporteMensal', v)} />
                </div>
                <EditableSelect
                  label="Conta onde o valor se acumula"
                  options={contas}
                  value={provisao.contaId}
                  onChange={(v) => salvarCampo(provisao, 'contaId', v)}
                  onCreate={criarConta}
                  placeholder="Selecione a conta"
                />
                <EditableSelect
                  label="Categoria (usada quando o gasto acontecer)"
                  options={categorias}
                  value={provisao.categoriaId}
                  onChange={(v) => salvarCampo(provisao, 'categoriaId', v)}
                  onCreate={criarCategoria}
                  placeholder="Selecione a categoria"
                />

                {!gastandoId || gastandoId !== provisao.id ? (
                  <button
                    type="button"
                    className="btn-confirm"
                    style={{ width: '100%' }}
                    disabled={provisao.valorAcumulado <= 0}
                    onClick={() => setGastandoId(provisao.id)}
                  >
                    Confirmar gasto ({formatCurrency(provisao.valorAcumulado)})
                  </button>
                ) : (
                  <div className="edit-actions">
                    <button type="button" className="btn-cancel" onClick={() => setGastandoId(null)}>Cancelar</button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!provisao.contaId || !provisao.categoriaId}
                      onClick={() => confirmarGasto(provisao)}
                    >
                      Confirmar — cria a despesa e zera
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="inline-add">
        <input
          type="text"
          placeholder="Nova provisão (ex: IPTU, Seguro do carro)..."
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
        />
        <button type="button" className="btn-confirm" onClick={adicionar}>Adicionar</button>
      </div>

      <ConfirmDialog
        open={excluindoId !== null}
        title="Excluir provisão?"
        message="Remove o registro por completo — não afeta nenhum lançamento já feito."
        onConfirm={confirmarExclusao}
        onCancel={() => setExcluindoId(null)}
      />
    </div>
  );
}

// Metas da cascata de planejamento (Fase 3): meses de despesas pra reserva
// de emergência e % da renda pro aporte de investimento. Configuração rara
// (revisar quando mudar de renda ou de meta) — o que se repete todo mês é
// só confirmar a alocação calculada a partir dessas metas, não redefini-las.
function MetasCascata() {
  const registro = useLiveQuery(() => db.configuracoes.where('chave').equals('metasCascata').first(), []);
  const metas = registro
    ? JSON.parse(registro.valor)
    : {
        mesesReservaMinima: 3, mesesReservaCompleta: 6, despesaMensalEstimada: 0,
        percentDivisaoReservaInvestimento: 50,
        percentInvestimento: 10, valorFixoInvestimento: 0, modoInvestimento: 'percent'
      };
  const [resultadoMigracao, setResultadoMigracao] = useState(null);
  const [migrando, setMigrando] = useState(false);

  async function salvar(campo, valor) {
    const numero = Math.max(0, Number(valor) || 0);
    const mudancas = { [campo]: numero };
    // Editar um dos dois campos de investimento já marca ele como o modo
    // ativo — "o usuário escolhe na hora, editando o que quer usar".
    if (campo === 'percentInvestimento') mudancas.modoInvestimento = 'percent';
    if (campo === 'valorFixoInvestimento') mudancas.modoInvestimento = 'fixo';
    await salvarConfig('metasCascata', JSON.stringify({ ...metas, ...mudancas }));
  }

  async function aplicarClassificacaoPadrao() {
    setMigrando(true);
    try {
      const resultado = await classificarCategoriasExistentes();
      setResultadoMigracao(resultado);
    } finally {
      setMigrando(false);
    }
  }

  return (
    <div className="config-cartao">
      <div className="config-cartao-dias">
        <div className="field">
          <label>Reserva mínima (meses de despesa)</label>
          <input type="number" min="0" value={metas.mesesReservaMinima} onChange={(e) => salvar('mesesReservaMinima', e.target.value)} style={{ width: 64, textAlign: 'center' }} />
        </div>
        <div className="field">
          <label>Reserva completa (meses de despesa)</label>
          <input type="number" min="0" value={metas.mesesReservaCompleta} onChange={(e) => salvar('mesesReservaCompleta', e.target.value)} style={{ width: 64, textAlign: 'center' }} />
        </div>
        <div className="field">
          <label>Sua despesa mensal estimada (usada nas duas metas acima)</label>
          <MoneyInput value={metas.despesaMensalEstimada} onChange={(v) => salvar('despesaMensalEstimada', v)} />
        </div>
        <div className="field">
          <label>% do investimento desviado pra reserva (entre mínima e completa)</label>
          <input type="number" min="0" max="100" value={metas.percentDivisaoReservaInvestimento} onChange={(e) => salvar('percentDivisaoReservaInvestimento', e.target.value)} style={{ width: 64, textAlign: 'center' }} />
        </div>
        <p className="repeticao-explicacao">
          Abaixo da reserva mínima: prioridade total pra reserva. Entre mínima e completa: esse % do investimento é
          desviado pra reserva, o resto continua sendo investido. Ao atingir a completa: 100% volta a ser investimento.
        </p>
        <div className="field">
          <label>% da renda pro aporte de investimento{metas.modoInvestimento === 'percent' && ' (ativo)'}</label>
          <input type="number" min="0" max="100" value={metas.percentInvestimento} onChange={(e) => salvar('percentInvestimento', e.target.value)} style={{ width: 64, textAlign: 'center' }} />
        </div>
        <div className="field">
          <label>Ou valor fixo em R$ pro aporte{metas.modoInvestimento === 'fixo' && ' (ativo)'}</label>
          <MoneyInput value={metas.valorFixoInvestimento} onChange={(v) => salvar('valorFixoInvestimento', v)} />
        </div>
      </div>

      <button type="button" className="botao-link" onClick={aplicarClassificacaoPadrao} disabled={migrando}>
        {migrando ? 'Aplicando...' : 'Classificar categorias existentes automaticamente'}
      </button>
      {resultadoMigracao && (
        <p className="repeticao-explicacao">
          {resultadoMigracao.categoriasAtualizadas === 0 && resultadoMigracao.subcategoriasAtualizadas === 0
            ? 'Nada pra classificar — categorias já classificadas ou sem nome igual a nenhuma categoria padrão.'
            : `${resultadoMigracao.categoriasAtualizadas} categoria(s) e ${resultadoMigracao.subcategoriasAtualizadas} subcategoria(s) classificadas. Confira em Categorias.`}
        </p>
      )}
    </div>
  );
}

// Configuração de saldo controlado por conta: o usuário informa o saldo
// "de hoje" (não recalcula pra trás a partir do histórico antigo) e, a
// partir da data em que isso foi informado, o app soma/subtrai o que
// entrou e saiu. Se o saldo não bater com a realidade em algum momento
// (lançamento esquecido, etc), "recalibrar" reposiciona a referência pro
// saldo de hoje de novo.
// Marca esta conta como parte da reserva de emergência (Fase 3) — o saldo
// dela entra na conta da meta de reserva no Dashboard/Planejamento. Mais de
// uma conta pode ser marcada (soma-se o saldo de todas), pra quem divide a
// reserva entre duas contas, por exemplo.
function ConfigReserva({ conta }) {
  const ativo = conta.reservaEmergencia === true;

  async function alternar() {
    await db.contas.update(conta.id, { reservaEmergencia: !ativo });
  }

  return (
    <div className="config-cartao">
      <label className="switch-row">
        <span className="switch-label">Faz parte da reserva de emergência</span>
        <span className={`switch ${ativo ? 'ativo' : ''}`} onClick={alternar} />
      </label>
    </div>
  );
}

function ConfigSaldo({ conta, entradas }) {
  const ativo = contaTemSaldoControlado(conta);
  const [definindo, setDefinindo] = useState(false);
  const [valorInicial, setValorInicial] = useState(0);
  const [valorRecalibrar, setValorRecalibrar] = useState(0);

  const saldoAtual = useMemo(() => calcularSaldoConta(conta, entradas), [conta, entradas]);

  async function confirmarDefinicao() {
    await db.contas.update(conta.id, { saldoInicial: valorInicial, saldoInicialData: new Date().toISOString() });
    setDefinindo(false);
  }

  async function pararDeAcompanhar() {
    await db.contas.update(conta.id, { saldoInicialData: null });
  }

  async function categoriaDeAjuste(tipo) {
    const existente = await db.categorias
      .where('tipo').equals(tipo)
      .and((c) => c.nome === 'Recalibração de saldo')
      .first();
    if (existente) return existente.id;

    const total = await db.categorias.where('tipo').equals(tipo).count();
    return db.categorias.add({ tipo, nome: 'Recalibração de saldo', ordem: total });
  }

  async function recalibrar() {
    const diferenca = Math.round((valorRecalibrar - saldoAtual) * 100) / 100;
    if (diferenca !== 0) {
      const tipo = diferenca > 0 ? 'receita' : 'despesa';
      // Cria um lançamento de verdade com a diferença — assim ela entra
      // nos totais de Receitas/Despesas do Resumo e fica visível no
      // Histórico, já organizado numa categoria própria (em vez de "sem
      // categoria" + explicação escondida na observação).
      await db.entries.add({
        tipo,
        valor: Math.abs(diferenca),
        data: hojeISO(),
        categoriaId: await categoriaDeAjuste(tipo),
        subcategoriaId: null,
        contaId: conta.id,
        formaPagamento: diferenca > 0 ? null : 'debito',
        nota: '',
        origem: 'manual',
        externalId: null,
        recorrenciaId: null,
        criadoEm: new Date().toISOString()
      });
    }
    setValorRecalibrar(0);
  }

  if (!ativo) {
    return (
      <div className="config-cartao">
        {!definindo ? (
          <button type="button" className="botao-link" onClick={() => setDefinindo(true)}>
            Definir saldo atual
          </button>
        ) : (
          <>
            <div className="field">
              <label>Saldo de hoje</label>
              <MoneyInput value={valorInicial} onChange={setValorInicial} autoFocus />
            </div>
            <button type="button" className="btn-confirm" style={{ width: '100%' }} onClick={confirmarDefinicao}>Salvar saldo</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="config-cartao">
      <div className="saldo-atual-linha">
        <span>Saldo atual</span>
        <strong style={{ color: saldoAtual >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCurrency(saldoAtual)}</strong>
      </div>
      <p className="repeticao-explicacao">
        Calculado a partir do saldo informado em {formatDateBR(conta.saldoInicialData?.slice(0, 10))}, somando o que entrou e
        saiu depois. Se não bater com a realidade, digite o valor exato que está no banco hoje (não a diferença) —
        a diferença vira um lançamento na categoria "Recalibração de saldo", visível no Histórico e contado no Resumo:
      </p>
      <div className="field">
        <label>Novo saldo (o valor exato que está no banco hoje)</label>
        <MoneyInput value={valorRecalibrar} onChange={setValorRecalibrar} />
      </div>
      <button type="button" className="btn-cancel" style={{ width: '100%' }} onClick={recalibrar}>Recalibrar</button>
      <button type="button" className="botao-link botao-link-discreto" onClick={pararDeAcompanhar}>
        Parar de acompanhar saldo desta conta
      </button>
    </div>
  );
}

// Configuração de fatura pra uma conta: dia de fechamento (quando a fatura
// atual para de acumular) e dia de vencimento (quando essa fatura precisa
// ser paga). Toda conta já aceita débito e crédito por lançamento (ver
// Lancar.jsx) — isso aqui só existe pra personalizar os dias, com um
// padrão sensato (fecha dia 1, vence dia 10) pra quem nunca mexeu.
function ConfigCartao({ conta }) {
  const [diaFechamento, setDiaFechamento] = useState(diaFechamentoEfetivo(conta));
  const [diaVencimento, setDiaVencimento] = useState(diaVencimentoEfetivo(conta));

  async function salvarDias(campo, valor) {
    const dia = Math.min(31, Math.max(1, Number(valor) || 1));
    if (campo === 'fechamento') setDiaFechamento(dia); else setDiaVencimento(dia);
    await db.contas.update(conta.id, { [campo === 'fechamento' ? 'diaFechamento' : 'diaVencimento']: dia });
  }

  async function salvarLimite(valor) {
    await db.contas.update(conta.id, { limiteCredito: valor });
  }

  return (
    <div className="config-cartao">
      <div className="config-cartao-dias">
        <div className="field">
          <label><IconCard size={15} /> Dia de fechamento da fatura</label>
          <input type="number" min="1" max="31" value={diaFechamento} onChange={(e) => salvarDias('fechamento', e.target.value)} />
        </div>
        <div className="field">
          <label>Dia de vencimento</label>
          <input type="number" min="1" max="31" value={diaVencimento} onChange={(e) => salvarDias('vencimento', e.target.value)} />
        </div>
        <p className="repeticao-explicacao">
          Ao lançar uma despesa nesta conta, você escolhe se foi no crédito ou no débito. Compras no crédito depois
          do dia de fechamento entram na fatura seguinte — isso só organiza a visualização em Faturas/Histórico,
          não controla saldo nem gera cobrança automática.
        </p>
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>Limite de crédito (opcional)</label>
        <MoneyInput value={conta.limiteCredito || 0} onChange={salvarLimite} />
        <p className="repeticao-explicacao">
          Se preenchido, a fatura em aberto mostra um aviso ao chegar perto (80%) ou passar do limite.
        </p>
      </div>
    </div>
  );
}
