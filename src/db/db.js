import { criarTabela } from './firestoreTabela';
import { CATEGORIAS_PADRAO, CONTAS_PADRAO } from './defaultData';
import { RECEITAS_HISTORICO, DESPESAS_HISTORICO, INVESTIMENTOS_HISTORICO } from './seedHistorico';

// ---------------------------------------------------------------------------
// Camada de dados — agora sobre Firestore (era Dexie/IndexedDB).
//
// Cada usuário tem seus próprios dados em /usuarios/{uid}/<tabela>/<id> (o
// uid vem do login com Google — ver src/firebase/authContext.jsx e
// src/db/uid.js). `db.<tabela>` continua com a mesma "forma" de antes
// (toArray, add, where().equals(), etc.) através do shim em
// firestoreTabela.js, então as páginas não precisaram ser reescritas.
//
// Decisões de modelagem mantidas da Fase 1/2 (ainda válidas):
//   - `entries.valor` é sempre POSITIVO; o sinal é implícito pelo `tipo`
//     ('receita' | 'despesa' | 'investimento' | 'transferencia').
//   - `entries.origem` guarda 'manual' ou 'picpay' — hoje só existe 'manual',
//     mas o campo já existe para quando a importação automática chegar (via
//     Cloud Function, escrevendo direto nessas mesmas coleções).
//   - `entries.externalId` fica pronto pra guardar o ID da transação vinda
//     do PicPay (evita duplicar lançamentos importados). Hoje é sempre null.
//   - Contas (`contas`) só têm saldo controlado se isso for explicitamente
//     ativado por conta (`saldoInicial`/`saldoInicialData`) — sem isso,
//     continuam sendo só etiquetas informativas.
//   - `recorrencias`, `orcamentos`, `configuracoes` e `excecoesValor` têm o
//     mesmo papel de antes — só mudou onde os dados moram.
//
// O que MUDA de propósito em relação ao Dexie:
//   - Os `id` agora são o ID do documento no Firestore (string), não mais um
//     auto-incremento numérico. Nada no código fazia conta com esses ids
//     (só comparação de igualdade), então isso não quebra nada — mas é
//     importante saber ao ler/depurar dados direto no console do Firebase.
//   - `db.transaction(...)` continua existindo pra não obrigar a reescrever
//     backup.js, mas NÃO é mais atômico de verdade (ver função abaixo) —
//     limitação aceita conscientemente pro tamanho deste projeto pessoal.
// ---------------------------------------------------------------------------

export const db = {
  categorias: criarTabela('categorias'),
  subcategorias: criarTabela('subcategorias'),
  contas: criarTabela('contas'),
  entries: criarTabela('entries'),
  recorrencias: criarTabela('recorrencias'),
  orcamentos: criarTabela('orcamentos'),
  configuracoes: criarTabela('configuracoes'),
  excecoesValor: criarTabela('excecoesValor'),

  // Best-effort, NÃO atômico: o Dexie garantia que, se algo no meio falhasse,
  // nada era salvo. O Firestore não oferece isso pra sequências arbitrárias
  // de escritas como estas (só pra grupos pequenos e bem definidos via
  // runTransaction/writeBatch). Pra uso pessoal, o risco real é baixo — na
  // pior hipótese (queda de conexão no meio de um restore de backup, por
  // exemplo), o processo pode ficar parcialmente aplicado, e repetir a ação
  // resolve. Se algum dia isso importar mais (multiusuário, por exemplo),
  // vale revisitar com runTransaction em operações menores.
  async transaction(_modo, ...args) {
    const callback = args[args.length - 1];
    return callback();
  }
};

// -------------------------- Seed inicial (1x por usuário) ------------------

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
  const registro = await db.subcategorias
    .where('categoriaId')
    .equals(categoriaId)
    .and((s) => s.nome === nomeSubcategoria)
    .first();
  return registro ? registro.id : null;
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

// Só semeia categorias/contas/histórico de exemplo se a conta do Firestore
// estiver mesmo vazia (usuário novo, primeiro login). Se você já migrou seus
// dados reais do Dexie antigo (ver src/db/migrarDexieParaFirestore.js), essa
// função não faz nada — `jaTemDados()` já vai encontrar suas categorias.
export async function iniciarBancoSeVazio() {
  const existeAlgo = await jaTemDados();
  if (existeAlgo) return;

  const { contaIdPorNome, categoriaIdPorTipoNome } = await seedCategoriasEContas();
  await seedHistorico('receita', RECEITAS_HISTORICO, categoriaIdPorTipoNome, contaIdPorNome);
  await seedHistorico('despesa', DESPESAS_HISTORICO, categoriaIdPorTipoNome, contaIdPorNome);
  await seedHistorico('investimento', INVESTIMENTOS_HISTORICO, categoriaIdPorTipoNome, contaIdPorNome);
}
