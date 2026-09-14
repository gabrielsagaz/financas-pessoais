import { db } from './db';

// Tabelas com dados financeiros (fica de fora `configuracoes`, que guarda o
// hash do PIN — é uma config do dispositivo, não um dado que faça sentido
// migrar entre aparelhos junto com o backup).
const TABELAS_BACKUP = ['categorias', 'subcategorias', 'contas', 'entries', 'recorrencias', 'orcamentos', 'excecoesValor'];

// Monta o objeto de backup com todas as tabelas financeiras. Formato próprio
// e versionado (campo `versao`) — se o esquema do banco mudar no futuro, dá
// pra migrar backups antigos ao importar em vez de simplesmente rejeitar.
export async function exportarBackup() {
  const dados = {};
  for (const tabela of TABELAS_BACKUP) {
    dados[tabela] = await db[tabela].toArray();
  }
  return {
    app: 'financas-pessoais',
    versao: 1,
    exportadoEm: new Date().toISOString(),
    dados
  };
}

export function baixarBackupComoArquivo(backup) {
  const nomeArquivo = `financas-backup-${backup.exportadoEm.slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Restaura um backup gerado por `exportarBackup`. SUBSTITUI totalmente os
// dados atuais (não faz merge com o que já existe) — os IDs originais são
// preservados pra manter intactas as referências entre tabelas
// (categoriaId, contaId, recorrenciaId, etc.).
export async function importarBackup(objetoBackup) {
  if (!objetoBackup || typeof objetoBackup !== 'object' || !objetoBackup.dados) {
    throw new Error('Arquivo de backup inválido.');
  }
  const { dados } = objetoBackup;

  await db.transaction('rw', TABELAS_BACKUP.map((t) => db[t]), async () => {
    for (const tabela of TABELAS_BACKUP) {
      await db[tabela].clear();
      const linhas = dados[tabela];
      if (Array.isArray(linhas) && linhas.length > 0) {
        await db[tabela].bulkAdd(linhas);
      }
    }
  });
}

// Apaga só os lançamentos (entries) — mantém categorias, contas, orçamentos
// e as recorrências cadastradas. IMPORTANTE: reposiciona o controle interno
// `ultimaGeracao` de cada recorrência pro mês atual; sem isso, elas
// regenerariam do zero (a partir da data de início) os mesmos lançamentos
// que acabaram de ser apagados na próxima vez que o app for aberto.
// Apaga TODOS os lançamentos — reais e as recorrências que os geram. Sem
// apagar as recorrências, os lançamentos "previstos" (projetados na hora,
// não guardados no banco) continuariam aparecendo em Histórico/Faturas/
// Dashboard, mesmo com `entries` vazia — eles não vêm de lá, vêm de
// projetar as recorrências pra frente.
export async function apagarTodosOsLancamentos() {
  await db.transaction('rw', db.entries, db.recorrencias, db.excecoesValor, async () => {
    await db.entries.clear();
    await db.recorrencias.clear();
    await db.excecoesValor.clear();
  });
}
