import { useState, useEffect } from 'react';
import { iniciarBancoSeVazio } from './db/db';
import { gerarLancamentosPendentes } from './db/recorrencias';
import { pinEstaAtivo } from './db/security';
import BottomNav from './components/BottomNav';
import LockScreen from './components/LockScreen';
import Resumo from './pages/Resumo';
import Lancar from './pages/Lancar';
import Historico from './pages/Historico';
import Categorias from './pages/Categorias';

export default function App() {
  const [abaAtiva, setAbaAtiva] = useState('resumo');
  const [pronto, setPronto] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    async function iniciar() {
      await iniciarBancoSeVazio();
      await gerarLancamentosPendentes();
      setBloqueado(await pinEstaAtivo());
      setPronto(true);
    }
    iniciar();
  }, []);

  if (!pronto) {
    return <div className="loading-screen">Carregando...</div>;
  }

  if (bloqueado) {
    return <LockScreen onUnlock={() => setBloqueado(false)} />;
  }

  return (
    <div className="app">
      <main className="app-content">
        {abaAtiva === 'resumo' && <Resumo />}
        {abaAtiva === 'lancar' && <Lancar />}
        {abaAtiva === 'historico' && <Historico />}
        {abaAtiva === 'categorias' && <Categorias />}
      </main>
      <BottomNav abaAtiva={abaAtiva} onChange={setAbaAtiva} />
    </div>
  );
}
