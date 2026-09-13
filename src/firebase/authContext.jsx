import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as signOutFirebase
} from 'firebase/auth';
import { auth } from './config';
import { definirUidAtual } from '../db/uid';

// ---------------------------------------------------------------------------
// Tenta signInWithPopup primeiro. Navegadores modernos (Edge/Chrome) vêm
// bloqueando cada vez mais o acesso a armazenamento entre domínios
// diferentes (seu domínio na Vercel ↔ o domínio *.firebaseapp.com do
// Firebase), o que quebra o signInWithRedirect silenciosamente — o
// navegador volta pro app sem completar o login, sem erro nenhum no
// Console. Popup evita essa dependência (a resposta volta por uma janela
// separada, não por storage entre domínios).
//
// Fallback pra signInWithRedirect só quando o popup é claramente
// impossível no ambiente atual: bloqueado pelo navegador, ou rodando
// dentro do PWA instalado em modo standalone no celular (onde não existe
// "janela popup" de verdade).
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

function rodandoComoPwaInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function AuthProvider({ children }) {
  // `undefined` = ainda não sabemos (checando sessão); `null` = deslogado.
  const [usuario, setUsuario] = useState(undefined);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    // Recupera o resultado de um signInWithRedirect anterior, se houver
    // (fallback do PWA instalado). Em fluxo de popup isso não faz nada.
    getRedirectResult(auth).catch((e) => setErro(e.message));

    const cancelarInscricao = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      definirUidAtual(user ? user.uid : null);
    });

    return cancelarInscricao;
  }, []);

  async function entrarComGoogle() {
    setErro(null);
    const provedor = new GoogleAuthProvider();

    if (rodandoComoPwaInstalado()) {
      // Sem janela de navegador de verdade aqui — só o redirect funciona.
      signInWithRedirect(auth, provedor).catch((e) => setErro(e.message));
      return;
    }

    try {
      await signInWithPopup(auth, provedor);
    } catch (e) {
      const motivosParaTentarRedirect = [
        'auth/popup-blocked',
        'auth/operation-not-supported-in-this-environment'
      ];
      if (motivosParaTentarRedirect.includes(e.code)) {
        signInWithRedirect(auth, provedor).catch((e2) => setErro(e2.message));
      } else {
        setErro(e.message);
      }
    }
  }

  function sair() {
    return signOutFirebase(auth);
  }

  const valor = {
    usuario,
    carregando: usuario === undefined,
    erro,
    entrarComGoogle,
    sair
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
