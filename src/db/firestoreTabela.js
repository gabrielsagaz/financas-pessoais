import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where as filtroFirestore,
  writeBatch
} from 'firebase/firestore';
import { firestoreDb } from '../firebase/config';
import { obterUidAtual } from './uid';

// ---------------------------------------------------------------------------
// Por que este arquivo existe
//
// Antes (Dexie): db.entries.where('tipo').equals('despesa').toArray()
// Agora (Firestore puro): teria que reescrever isso, e toda tela que usa
// useLiveQuery, em código bem diferente (query/onSnapshot).
//
// Esse arquivo cria um objeto "tabela" por coleção que entende as mesmas
// chamadas que as páginas já fazem — toArray(), add(), where().equals(),
// orderBy(), count(), delete() etc. — só que por baixo usa o Firestore.
// Assim as páginas (Resumo, Historico, Lancar, Categorias, Perfil, Faturas)
// não precisam mudar a lógica, só a origem dos dados.
//
// Cobre exatamente os métodos que o app usa hoje (mapeados com grep no
// código) — não é um clone completo da API do Dexie.
// ---------------------------------------------------------------------------

function colecao(nomeTabela) {
  const uid = obterUidAtual();
  if (!uid) {
    throw new Error(
      `Tentativa de acessar "${nomeTabela}" sem usuário autenticado. ` +
        'Toda tela que usa db.* só deve renderizar depois do login (ver AuthProvider).'
    );
  }
  return collection(firestoreDb, 'usuarios', uid, nomeTabela);
}

function comId(docSnap) {
  return { id: docSnap.id, ...docSnap.data() };
}

// O Firestore aceita no máximo 500 operações por writeBatch. Pra backups
// grandes (anos de lançamentos), dividimos em blocos de 450 pra sobrar
// margem. `aplicar(lote, item)` faz o `.set()`/`.delete()` de um item no
// lote — quem chama decide qual operação.
async function executarEmLotes(itens, aplicar) {
  const TAMANHO_BLOCO = 450;
  for (let i = 0; i < itens.length; i += TAMANHO_BLOCO) {
    const bloco = itens.slice(i, i + TAMANHO_BLOCO);
    const lote = writeBatch(firestoreDb);
    bloco.forEach((item) => aplicar(lote, item));
    await lote.commit();
  }
}

// Um "Queryable": pode ser usado com `await` (roda a query uma vez) OU pelo
// hook useLiveQuery (que reconhece `__live` e se inscreve em tempo real via
// onSnapshot). `executar` recebe um QuerySnapshot e devolve o valor final
// (array, objeto único, ou número) — a mesma função serve pros dois casos.
function criarQueryable(queryRef, executar) {
  return {
    __live: { queryRef, executar },
    then(resolve, reject) {
      getDocs(queryRef).then(executar).then(resolve, reject);
    }
  };
}

function clausulaWhere(nomeTabela, campo, valor) {
  const q = query(colecao(nomeTabela), filtroFirestore(campo, '==', valor));
  return {
    first() {
      return criarQueryable(q, (snap) => (snap.empty ? undefined : comId(snap.docs[0])));
    },
    toArray() {
      return criarQueryable(q, (snap) => snap.docs.map(comId));
    },
    sortBy(campoOrdem) {
      return criarQueryable(q, (snap) =>
        snap.docs.map(comId).sort((a, b) => (a[campoOrdem] ?? 0) - (b[campoOrdem] ?? 0))
      );
    },
    count() {
      return criarQueryable(q, (snap) => snap.size);
    },
    async delete() {
      const snap = await getDocs(q);
      await executarEmLotes(snap.docs, (lote, d) => lote.delete(d.ref));
    },
    // Filtro extra aplicado em memória (equivalente ao `.and()` do Dexie).
    // Usado só em uma consulta pontual e sempre com `await` direto, então
    // não precisa suportar useLiveQuery.
    and(filtroExtra) {
      return {
        async first() {
          const snap = await getDocs(q);
          return snap.docs.map(comId).find(filtroExtra);
        }
      };
    }
  };
}

export function criarTabela(nomeTabela) {
  return {
    toArray() {
      return criarQueryable(colecao(nomeTabela), (snap) => snap.docs.map(comId));
    },
    orderBy(campo) {
      return {
        toArray: () =>
          criarQueryable(colecao(nomeTabela), (snap) =>
            snap.docs.map(comId).sort((a, b) => (a[campo] ?? 0) - (b[campo] ?? 0))
          )
      };
    },
    where(campo) {
      return { equals: (valor) => clausulaWhere(nomeTabela, campo, valor) };
    },
    async get(id) {
      const snap = await getDoc(doc(colecao(nomeTabela), String(id)));
      return snap.exists() ? comId(snap) : undefined;
    },
    async add(objeto) {
      const ref = await addDoc(colecao(nomeTabela), objeto);
      return ref.id;
    },
    async update(id, mudancas) {
      await updateDoc(doc(colecao(nomeTabela), String(id)), mudancas);
    },
    async delete(id) {
      await deleteDoc(doc(colecao(nomeTabela), String(id)));
    },
    async bulkDelete(ids) {
      await executarEmLotes(ids, (lote, id) => lote.delete(doc(colecao(nomeTabela), String(id))));
    },
    async clear() {
      const snap = await getDocs(colecao(nomeTabela));
      await executarEmLotes(snap.docs, (lote, d) => lote.delete(d.ref));
    },
    // Usado no importarBackup: grava preservando o `id` original de cada
    // linha (importante pra não quebrar referências como categoriaId,
    // contaId, recorrenciaId entre as tabelas restauradas).
    async bulkAdd(objetos) {
      await executarEmLotes(objetos, (lote, objeto) => {
        const { id, ...resto } = objeto;
        const ref = id != null ? doc(colecao(nomeTabela), String(id)) : doc(colecao(nomeTabela));
        lote.set(ref, resto);
      });
    },
    async count() {
      return (await getDocs(colecao(nomeTabela))).size;
    },
    // Usado só pelo script de migração (precisa gravar com o MESMO id
    // numérico que o registro tinha no Dexie, pra não quebrar as
    // referências entre tabelas — ex: entries.categoriaId).
    async definirComId(id, objeto) {
      await setDoc(doc(colecao(nomeTabela), String(id)), objeto);
    }
  };
}
