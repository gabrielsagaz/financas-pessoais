// ---------------------------------------------------------------------------
// Estado simples (não é React) com o UID do usuário logado no momento.
// Definido pelo AuthProvider (src/firebase/authContext.jsx) em cada mudança
// de sessão. A camada de dados (db.js) lê isso pra montar o caminho
// /usuarios/{uid}/<tabela> de cada coleção no Firestore.
//
// Isso simplifica bastante o resto do código: como o app é de uso pessoal
// (você loga com sua própria conta Google em todos os seus dispositivos),
// não precisamos passar o uid explicitamente em toda chamada — só garantir
// que nenhuma tela tente ler/escrever dados antes do login terminar.
// ---------------------------------------------------------------------------

let uidAtual = null;

export function definirUidAtual(uid) {
  uidAtual = uid;
}

export function obterUidAtual() {
  return uidAtual;
}
