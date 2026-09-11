import { db } from './db';

// Mesmo padrão chave/valor genérico usado pelo PIN (`security.js`) — cada
// preferência é uma linha em `configuracoes`. Escrita fica aqui; leitura
// reativa é feita direto por quem usa, via useLiveQuery em
// `db.configuracoes.where('chave').equals(...)`, pra atualizar a tela na
// hora quando o valor muda.
export async function salvarConfig(chave, valor) {
  const registro = await db.configuracoes.where('chave').equals(chave).first();
  if (registro) {
    await db.configuracoes.update(registro.id, { valor });
  } else {
    await db.configuracoes.add({ chave, valor });
  }
}

// Tema: 'auto' (padrão, segue o sistema) | 'claro' | 'escuro'.
export async function salvarTema(tema) {
  await salvarConfig('tema', tema);
}

// Perfil local — nome + emoji como avatar. Sem foto/upload e sem login:
// login com Google fica pra Fase 2, quando houver servidor de verdade.
export async function salvarPerfil(perfil) {
  await salvarConfig('perfil', JSON.stringify(perfil));
}

export function perfilPadrao() {
  return { nome: '', emoji: '🙂' };
}
