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
// Tenta signInWithPopup SEMPRE primeiro, inclusive dentro do PWA instalado
// em modo standalone — no Android com Chrome isso funciona (abre como uma
// aba/janela do sistema por cima do app). Só cai pro signInWithRedirect
// quando o popup falha de fato (bloqueado, ou o ambiente realmente não
// suporta popup — ex: alguns navegadores de iOS).
//
// Redirect puro foi tentado antes e ficava em loop (o navegador volta pro
// app sem completar o login, sem erro nenhum): ele depende de acesso a
// armazenamento entre domínios diferentes (o domínio do app ↔ o
// *.firebaseapp.com do Firebase), e isso vem sendo bloqueado cada vez mais
// por padrão — tanto em navegador quanto, aparentemente, dentro do
// WebAPK/PWA instalado no Android.
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

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
