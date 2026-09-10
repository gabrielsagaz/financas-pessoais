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
//
// v2 adiciona:
//   - `recorrencias`: definição de um lançamento fixo mensal (valor,
//     categoria, conta, dia do mês). `entries.recorrenciaId` liga cada
//     lançamento gerado de volta à recorrência que o originou — sem isso não
//     dá pra saber quais lançamentos são "fixos" nem evitar duplicá-los.
//     `totalParcelas` é opcional: null = repete pra sempre; um número (ex:
//     3) = compra parcelada, e a recorrência se desativa sozinha depois da
//     última parcela. `entries.numeroParcela` guarda a posição da parcela
//     (1, 2, 3...) só quando `totalParcelas` está definido.
//   - `orcamentos`: limite mensal opcional por categoria (hoje pensado pra
//     despesas). `&categoriaId` = índice único, então cada categoria tem no
//     máximo um orçamento.
//   - `configuracoes`: par chave/valor genérico — hoje guarda só o hash do
//     PIN de acesso, mas serve pra qualquer configuração futura sem precisar
//     de mais uma tabela.
// ---------------------------------------------------------------------------

export const db = new Dexie('financas-pessoais');

db.version(1).stores({
  categorias: '++id, tipo, ordem',
  subcategorias: '++id, categoriaId, ordem',
  contas: '++id, ordem',
  entries: '++id, tipo, data, categoriaId, subcategoriaId, contaId, [tipo+data]'
});

// v2 — Fase 2 (parte 1): lançamentos fixos/recorrentes, orçamento por
// categoria e um armazém de configurações simples (usado hoje pelo PIN de
// acesso). Só ADICIONA tabelas/índice — dados existentes não são tocados.
db.version(2).stores({
  categorias: '++id, tipo, ordem',
  subcategorias: '++id, categoriaId, ordem',
  contas: '++id, ordem',
  entries: '++id, tipo, data, categoriaId, subcategoriaId, contaId, recorrenciaId, [tipo+data]',
  recorrencias: '++id, tipo',
  orcamentos: '++id, &categoriaId',
  configuracoes: '++id, &chave'
});

// v3 — permite ajustar o valor de UMA ocorrência futura específica (ex:
// conta de luz que varia todo mês) sem mudar o valor padrão da recorrência
// nem afetar os outros meses. Cada linha é "recorrência X + mês Y = valor
// Z"; consumida (removida) quando aquele mês vira um lançamento real.
db.version(3).stores({
  categorias: '++id, tipo, ordem',
  subcategorias: '++id, categoriaId, ordem',
  contas: '++id, ordem',
  entries: '++id, tipo, data, categoriaId, subcategoriaId, contaId, recorrenciaId, [tipo+data]',
  recorrencias: '++id, tipo',
  orcamentos: '++id, &categoriaId',
  configuracoes: '++id, &chave',
  excecoesValor: '++id, recorrenciaId'
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
      recorrenciaId: null,
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
