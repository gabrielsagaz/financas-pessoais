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
  return { nome: '', emoji: '🙂', foto: null };
}

// Só roda uma vez: se ainda não existe nenhum registro de perfil (usuário
// entrando por a primeira vez, ou tinha uma conta antiga sem esse campo),
// usa nome e foto do Google como ponto de partida. Se o usuário já tem um
// perfil salvo — mesmo que tenha apagado o nome de propósito —, não
// sobrescreve nada.
export async function seedPerfilComGoogleSeVazio(usuario) {
  const jaExiste = await db.configuracoes.where('chave').equals('perfil').first();
  if (jaExiste) return;

  const primeiroNome = (usuario.displayName || '').trim().split(' ')[0] || '';
  await salvarPerfil({ ...perfilPadrao(), nome: primeiroNome, foto: usuario.photoURL || null });
}
