import { useState, useEffect } from 'react';
import { useLiveQuery } from './db/useLiveQuery';
import { iniciarBancoSeVazio, db } from './db/db';
import { gerarLancamentosPendentes } from './db/recorrencias';
import { pinEstaAtivo } from './db/security';
import { seedPerfilComGoogleSeVazio } from './db/preferencias';
import { useAuth } from './firebase/authContext';
import BottomNav from './components/BottomNav';
import LockScreen from './components/LockScreen';
import Login from './pages/Login';
import Resumo from './pages/Resumo';
import Dashboard from './pages/Dashboard';
import Lancar from './pages/Lancar';
import Historico from './pages/Historico';
import Categorias from './pages/Categorias';
import Perfil from './pages/Perfil';
import { IconUser } from './components/Icons';

const ABAS_VALIDAS = ['resumo', 'dashboard', 'lancar', 'historico', 'categorias'];
const CHAVE_ABA_ATIVA = 'financas:abaAtiva';

function lerAbaSalva() {
  const salva = localStorage.getItem(CHAVE_ABA_ATIVA);
  return ABAS_VALIDAS.includes(salva) ? salva : 'resumo';
}

export default function App() {
  const { usuario, carregando } = useAuth();
  const [abaAtiva, setAbaAtivaState] = useState(lerAbaSalva);
  const [mostrandoPerfil, setMostrandoPerfil] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);

  // Persiste no localStorage pra sobreviver a um F5/recarregamento — sem
  // isso, a aba sempre voltava pra "Resumo" (o valor inicial do useState)
  // porque um reload apaga qualquer estado só-em-memória do React.
  function setAbaAtiva(aba) {
    setAbaAtivaState(aba);
    localStorage.setItem(CHAVE_ABA_ATIVA, aba);
  }

  // Só busca dados depois que sabemos que existe um usuário logado — antes
  // disso, db.* nem sabe em qual /usuarios/{uid}/... ler (ver src/db/uid.js).
  const registroTema = useLiveQuery(
    () => (usuario ? db.configuracoes.where('chave').equals('tema').first() : undefined),
    [usuario]
  );
  const registroPerfil = useLiveQuery(
    () => (usuario ? db.configuracoes.where('chave').equals('perfil').first() : undefined),
    [usuario]
  );
  const perfilAtual = registroPerfil ? JSON.parse(registroPerfil.valor) : null;

  useEffect(() => {
    if (!usuario) return;
    setPronto(false);
    async function iniciar() {
      await seedPerfilComGoogleSeVazio(usuario);
      await iniciarBancoSeVazio();
      await gerarLancamentosPendentes();
      setBloqueado(await pinEstaAtivo());
      setPronto(true);
    }
    iniciar();
  }, [usuario]);

  // Aplica o tema escolhido (auto/claro/escuro) na tag <html> — o CSS
  // reage a esse atributo (ver :root[data-theme] em index.css). 'auto' não
  // seta o atributo, deixando a preferência do sistema (prefers-color-scheme)
  // decidir sozinha.
  useEffect(() => {
    const tema = registroTema?.valor || 'auto';
    if (tema === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', tema === 'escuro' ? 'dark' : 'light');
    }
  }, [registroTema]);

  if (carregando) {
    return <div className="loading-screen">Carregando...</div>;
  }

  if (!usuario) {
    return <Login />;
  }

  if (!pronto) {
    return <div className="loading-screen">Carregando...</div>;
  }

  if (bloqueado) {
    return <LockScreen onUnlock={() => setBloqueado(false)} />;
  }

  if (mostrandoPerfil) {
    return (
      <div className="app">
        <main className="app-content">
          <Perfil onVoltar={() => setMostrandoPerfil(false)} />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <button type="button" className="botao-perfil" onClick={() => setMostrandoPerfil(true)}>
          {perfilAtual?.foto ? (
            <img src={perfilAtual.foto} alt="" className="avatar-foto" />
          ) : (
            perfilAtual?.emoji || <IconUser size={19} />
          )}
        </button>
      </header>
      <main className="app-content">
        {abaAtiva === 'resumo' && <Resumo />}
        {abaAtiva === 'dashboard' && <Dashboard />}
        {abaAtiva === 'lancar' && <Lancar />}
        {abaAtiva === 'historico' && <Historico />}
        {abaAtiva === 'categorias' && <Categorias />}
      </main>
      <BottomNav abaAtiva={abaAtiva} onChange={setAbaAtiva} />
    </div>
  );
}
