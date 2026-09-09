import { db } from './db';

// PIN de acesso simples, guardado como hash (SHA-256) na tabela
// `configuracoes` — nunca em texto puro. Não existe servidor nesta fase,
// então o "ataque" que isso evita é alguém pegar o celular destrancado e
// abrir o app direto; não protege contra quem tem acesso ao arquivo do
// IndexedDB. Proporcional ao risco real de um app pessoal no celular.

async function sha256(texto) {
  const bytes = new TextEncoder().encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function lerConfig(chave) {
  const registro = await db.configuracoes.where('chave').equals(chave).first();
  return registro ? registro.valor : null;
}

async function salvarConfig(chave, valor) {
  const registro = await db.configuracoes.where('chave').equals(chave).first();
  if (registro) {
    await db.configuracoes.update(registro.id, { valor });
  } else {
    await db.configuracoes.add({ chave, valor });
  }
}

export async function pinEstaAtivo() {
  const hash = await lerConfig('pinHash');
  return !!hash;
}

export async function definirPin(novoPin) {
  const hash = await sha256(novoPin);
  await salvarConfig('pinHash', hash);
}

export async function removerPin() {
  const registro = await db.configuracoes.where('chave').equals('pinHash').first();
  if (registro) await db.configuracoes.delete(registro.id);
}

export async function verificarPin(tentativa) {
  const hashSalvo = await lerConfig('pinHash');
  if (!hashSalvo) return true; // sem PIN configurado, sempre libera
  const hashTentativa = await sha256(tentativa);
  return hashTentativa === hashSalvo;
}
