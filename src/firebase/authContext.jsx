import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut as signOutFirebase
} from 'firebase/auth';
import { auth } from './config';
import { definirUidAtual } from '../db/uid';

// ---------------------------------------------------------------------------
// Usa signInWithRedirect (não signInWithPopup): dentro de um PWA instalado
// no celular não existe "janela popup" de verdade, e alguns navegadores
// bloqueiam popup nesse contexto. Redirect funciona igual em desktop e no
// PWA instalado — o app é recarregado após o login, e `getRedirectResult`
// recupera o resultado nesse recarregamento.
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // `undefined` = ainda não sabemos (checando sessão); `null` = deslogado.
  const [usuario, setUsuario] = useState(undefined);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    getRedirectResult(auth).catch((e) => setErro(e.message));

    const cancelarInscricao = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      definirUidAtual(user ? user.uid : null);
    });

    return cancelarInscricao;
  }, []);

  function entrarComGoogle() {
    setErro(null);
    signInWithRedirect(auth, new GoogleAuthProvider()).catch((e) => setErro(e.message));
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
