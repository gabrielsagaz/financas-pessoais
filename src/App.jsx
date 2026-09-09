import { useState, useEffect } from 'react';
import { iniciarBancoSeVazio } from './db/db';
import BottomNav from './components/BottomNav';
import Resumo from './pages/Resumo';
import Lancar from './pages/Lancar';
import Historico from './pages/Historico';
import Categorias from './pages/Categorias';

export default function App() {
  const [abaAtiva, setAbaAtiva] = useState('resumo');
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    iniciarBancoSeVazio().finally(() => setPronto(true));
  }, []);

  if (!pronto) {
    return <div className="loading-screen">Carregando...</div>;
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
