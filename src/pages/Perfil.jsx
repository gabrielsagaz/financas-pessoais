import { useState, useRef, useMemo, useEffect } from 'react';
import { useLiveQuery } from '../db/useLiveQuery';
import { db } from '../db/db';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconTrash, IconChevron, IconCard, IconArrowLeft } from '../components/Icons';
import MoneyInput from '../components/MoneyInput';
import PinPad from '../components/PinPad';
import { definirPin, removerPin, pinEstaAtivo } from '../db/security';
import { exportarBackup, baixarBackupComoArquivo, importarBackup, apagarTodosOsLancamentos } from '../db/backup';
import { contaEhCartao } from '../utils/cartao';
import { contaTemSaldoControlado, calcularSaldoConta } from '../db/saldos';
import { formatCurrency, formatDateBR, hojeISO } from '../utils/format';
import { salvarPerfil, salvarTema, perfilPadrao } from '../db/preferencias';
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
    await salvarPerfil({ ...perfil, emoji });
    setEscolhendoEmoji(false);
  }

  return (
    <div className="perfil-box">
      <button type="button" className="perfil-avatar" onClick={() => setEscolhendoEmoji((v) => !v)}>
        {perfil.emoji}
      </button>
      <div className="field" style={{ flex: 1 }}>
        <label>Nome</label>
        <input type="text" value={nome} onChange={(e) => salvarNome(e.target.value)} placeholder="Seu nome" />
      </div>

      {escolhendoEmoji && (
        <div className="perfil-emojis">
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
