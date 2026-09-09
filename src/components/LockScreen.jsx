import { useState } from 'react';
import { verificarPin } from '../db/security';
import PinPad from './PinPad';
import { IconLock } from './Icons';

export default function LockScreen({ onUnlock }) {
  const [erro, setErro] = useState(false);

  async function tentar(pin) {
    const ok = await verificarPin(pin);
    if (ok) {
      onUnlock();
    } else {
      setErro(true);
      setTimeout(() => setErro(false), 400);
    }
  }

  return (
    <div className="lock-screen">
      <div className="lock-icone"><IconLock /></div>
      <h1 style={{ marginBottom: 4 }}>Finanças</h1>
      <p className="lock-subtitulo">{erro ? 'Código incorreto' : 'Digite seu código'}</p>
      <PinPad onComplete={tentar} erro={erro} />
    </div>
  );
}
