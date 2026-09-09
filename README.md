# Finanças Pessoais — Fase 1 (MVP / PWA)

App pessoal de controle financeiro (Receitas, Despesas e Investimentos),
baseado na sua planilha. Fase 1: PWA, uso no celular, lançamentos manuais,
dados salvos só no seu dispositivo (sem servidor, sem login).

## Como rodar

Pré-requisito: Node.js 18+ instalado.

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. O terminal também mostra um endereço tipo
`http://192.168.x.x:5173` — abra esse no navegador do celular (mesma rede
Wi-Fi) pra testar no aparelho de verdade.

## Como gerar a versão para instalar (PWA)

```bash
npm run build
npm run preview
```

`npm run build` gera a pasta `dist/` — é o que você sobe num host estático
(Vercel, Netlify, GitHub Pages, etc.) pra poder "Adicionar à tela inicial"
no celular. PWA instalável precisa de HTTPS (localhost conta como exceção
pra testes).

## Estrutura

- `src/db/db.js` — esquema do banco local (Dexie/IndexedDB) e o seed inicial.
- `src/db/defaultData.js` — categorias/subcategorias/contas padrão (vieram da
  sua planilha, aba "Cadastros"). Você pode editar tudo isso dentro do app,
  em **Categorias**.
- `src/db/seedHistorico.js` — os lançamentos de jan–ago/2024 que já estavam
  na sua planilha. São importados **uma única vez**, na primeira abertura,
  pra você não perder o histórico. Depois disso pode editar/excluir cada um
  normalmente na tela de **Histórico**.
- `src/pages/` — as 4 telas: Resumo (dashboard), Lançar, Histórico, Categorias.

## Decisões que impactam a Fase 2 (app nativo + saldo controlado + PicPay)

Registradas em comentário no topo de `src/db/db.js`, resumindo aqui:

1. **`entries.valor` é sempre positivo**; o sinal é implícito pelo campo
   `tipo` (`receita`/`despesa`/`investimento`). Isso facilita calcular saldo
   por conta na Fase 2 sem precisar reprocessar os dados antigos.
2. **`entries.origem`** já existe (`'manual'` ou `'picpay'`), mesmo só
   usando `'manual'` por enquanto.
3. **`entries.externalId`** já existe (hoje sempre `null`) — é onde vai
   entrar o ID da transação do PicPay, pra evitar importar o mesmo
   lançamento duas vezes.
4. **Contas (`contas`) não têm saldo nesta fase** — são só uma etiqueta.
   Adicionar um `saldoInicial` a cada conta na Fase 2 não exige mudar nada
   do que já existe hoje.
5. Categorias/subcategorias são livres (você cria/edita/exclui à vontade);
   a planilha original só serviu de carga inicial.

## Stack

React + Vite, Dexie.js (IndexedDB), Recharts, PWA manual (manifest +
service worker simples, sem `vite-plugin-pwa` — mantido enxuto de propósito
para esta fase de MVP).
