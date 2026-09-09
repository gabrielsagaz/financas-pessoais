import Dexie from 'dexie';
import { CATEGORIAS_PADRAO, CONTAS_PADRAO } from './defaultData';
import { RECEITAS_HISTORICO, DESPESAS_HISTORICO, INVESTIMENTOS_HISTORICO } from './seedHistorico';

// ---------------------------------------------------------------------------
// Esquema do banco local (IndexedDB via Dexie).
//
// Decisões pensando na Fase 2 (migração para app nativo com saldo controlado
// por conta e importação automática do PicPay) — registradas também na
// memória do projeto:
//   - `entries.valor` é sempre POSITIVO; o sinal é implícito pelo `tipo`
//     ('receita' | 'despesa' | 'investimento'). Isso facilita o cálculo de
//     saldo por conta na Fase 2 (soma receitas, subtrai despesas e
//     investimentos que saem da conta).
//   - `entries.origem` guarda 'manual' ou 'picpay' — hoje só existe 'manual',
//     mas o campo já existe para quando a importação automática chegar.
//   - `entries.externalId` fica pronto para guardar o ID da transação vinda
//     do PicPay (evita duplicar lançamentos importados). Hoje é sempre null.
//   - Contas (`accounts`) são só etiquetas informativas nesta fase — não têm
//     saldo. Na Fase 2, dá pra adicionar um campo `saldoInicial` sem quebrar
//     nada do que já existe.
// ---------------------------------------------------------------------------

export const db = new Dexie('financas-pessoais');

db.version(1).stores({
  categorias: '++id, tipo, ordem',
  subcategorias: '++id, categoriaId, ordem',
  contas: '++id, ordem',
  entries: '++id, tipo, data, categoriaId, subcategoriaId, contaId, [tipo+data]'
});

// -------------------------- Seed inicial (1x) -------------------------------

async function jaTemDados() {
  const totalCategorias = await db.categorias.count();
  return totalCategorias > 0;
}

async function seedCategoriasEContas() {
  const contaIdPorNome = {};
  for (let i = 0; i < CONTAS_PADRAO.length; i++) {
    const id = await db.contas.add({ nome: CONTAS_PADRAO[i], ordem: i, arquivada: false });
    contaIdPorNome[CONTAS_PADRAO[i]] = id;
  }

  const categoriaIdPorTipoNome = {};
  for (let i = 0; i < CATEGORIAS_PADRAO.length; i++) {
    const cat = CATEGORIAS_PADRAO[i];
    const categoriaId = await db.categorias.add({ tipo: cat.tipo, nome: cat.nome, ordem: i });
    categoriaIdPorTipoNome[`${cat.tipo}:${cat.nome}`] = categoriaId;

    for (let j = 0; j < cat.subcategorias.length; j++) {
      await db.subcategorias.add({
        categoriaId,
        nome: cat.subcategorias[j],
        ordem: j
      });
    }
  }

  return { contaIdPorNome, categoriaIdPorTipoNome };
}

async function buscarSubcategoriaId(categoriaId, nomeSubcategoria) {
  if (!nomeSubcategoria) return null;
  const sub = await db.subcategorias
    .where('categoriaId')
    .equals(categoriaId)
    .and((s) => s.nome === nomeSubcategoria)
    .first();
  return sub ? sub.id : null;
}

async function seedHistorico(tipo, lista, categoriaIdPorTipoNome, contaIdPorNome) {
  for (const item of lista) {
    const categoriaId = categoriaIdPorTipoNome[`${tipo}:${item.categoria}`];
    if (!categoriaId) continue; // categoria não encontrada, ignora com segurança
    const subcategoriaId = await buscarSubcategoriaId(categoriaId, item.subcategoria);
    const contaId = contaIdPorNome[item.conta] ?? null;

    await db.entries.add({
      tipo,
      valor: item.valor,
      data: item.data,
      categoriaId,
      subcategoriaId,
      contaId,
      nota: '',
      origem: 'manual',
      externalId: null,
      criadoEm: new Date().toISOString()
    });
  }
}

export async function iniciarBancoSeVazio() {
  const existeAlgo = await jaTemDados();
  if (existeAlgo) return;

  await db.transaction('rw', db.categorias, db.subcategorias, db.contas, db.entries, async () => {
    const { contaIdPorNome, categoriaIdPorTipoNome } = await seedCategoriasEContas();
    await seedHistorico('receita', RECEITAS_HISTORICO, categoriaIdPorTipoNome, contaIdPorNome);
    await seedHistorico('despesa', DESPESAS_HISTORICO, categoriaIdPorTipoNome, contaIdPorNome);
    await seedHistorico('investimento', INVESTIMENTOS_HISTORICO, categoriaIdPorTipoNome, contaIdPorNome);
  });
}
