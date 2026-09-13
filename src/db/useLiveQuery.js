import { useEffect, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Substituto do `useLiveQuery` do dexie-react-hooks. Mesma assinatura:
//   useLiveQuery(() => db.entries.toArray(), [dependencias])
//
// A função passada pode devolver:
//   1. Um "Queryable" (objeto com `__live`, criado em firestoreTabela.js) —
//      o hook se inscreve com onSnapshot e atualiza a cada mudança nos
//      dados, em qualquer dispositivo.
//   2. Um valor síncrono direto (ex: `condicao ? [] : db.x.toArray()`) —
//      usado como está, sem assinatura (é o mesmo comportamento que as
//      páginas já esperavam do Dexie nesse caso).
// ---------------------------------------------------------------------------
export function useLiveQuery(querier, deps = []) {
  const [valor, setValor] = useState(undefined);
  const querierRef = useRef(querier);
  querierRef.current = querier;

  useEffect(() => {
    let cancelado = false;
    const resultado = querierRef.current();

    if (!resultado || typeof resultado !== 'object' || typeof resultado.then !== 'function') {
      // Valor síncrono (ex: array vazio) — sem assinatura viva.
      setValor(resultado);
      return undefined;
    }

    if (!resultado.__live) {
      // Promise comum, sem suporte a live-update — resolve uma vez.
      resultado.then((r) => {
        if (!cancelado) setValor(r);
      });
      return () => {
        cancelado = true;
      };
    }

    const { queryRef, executar } = resultado.__live;
    const cancelarInscricao = onSnapshot(
      queryRef,
      (snap) => {
        if (!cancelado) setValor(executar(snap));
      },
      (erro) => {
        // Não derruba a tela por um erro de rede/permissão pontual — só
        // loga. As telas já tratam `undefined`/array vazio normalmente.
        console.error(`useLiveQuery: erro na inscrição Firestore`, erro);
      }
    );

    return () => {
      cancelado = true;
      cancelarInscricao();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return valor;
}
