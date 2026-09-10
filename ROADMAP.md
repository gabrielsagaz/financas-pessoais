# Roadmap — Fase 2

Lista de melhorias discutidas para depois da Fase 1 (MVP), com prioridade.
Mantido aqui pra não se perder entre conversas.

## Em andamento (prioridade média — iniciado em set/2026)

- [x] **Lançamentos fixos/recorrentes** — repetição mensal automática
  (`src/db/recorrencias.js`), com opção de pausar/retomar/excluir. Marcados
  no Histórico com um ícone de repetição.
- [x] **Repetição por número fixo de vezes (parcelamento)** — ao criar um
  lançamento fixo, dá pra escolher "Todo mês" (sem parar) ou "Número de
  vezes" (ex: compra em 3x no cartão). Parcelada, a recorrência conta as
  ocorrências e se marca como concluída sozinha depois da última parcela.
  Histórico mostra "Parcela 2/3", etc.
- [x] **Orçamento por categoria** — limite mensal opcional por categoria de
  despesa (configurado em Categorias → categoria expandida), com barra de
  progresso no Resumo (só quando um mês específico está selecionado).
- [x] **Trava de acesso (PIN)** — código de 4 dígitos, hash local (SHA-256),
  configurado em Categorias → Segurança. Sem biometria por enquanto (Web
  Authentication API é mais complexa e instável entre navegadores — avaliar
  se valer a pena depois).

## Pendência descoberta no uso real

- [x] **Ver lançamentos fixos futuros com antecedência** — a geração
  continua "sob demanda" (nada é gravado no banco antes da hora), mas agora
  existe uma PROJEÇÃO calculada na tela (`projetarTodasAsRecorrencias` em
  `src/db/recorrencias.js`) para qualquer mês/ano futuro selecionado.
  Integrada direto nos resultados existentes (sem lista separada):
  - **Resumo**: totais, gráfico mensal, gráfico de categorias e orçamento
    por categoria passam a incluir os lançamentos fixos futuros previstos
    quando o período selecionado inclui meses adiante do atual. Aparece um
    aviso "Inclui lançamentos fixos previstos..." quando isso acontece.
  - **Histórico**: lançamentos previstos aparecem misturados com os reais
    (ordenados por data), com opacidade reduzida e uma tag "Previsto" — não
    têm botão de excluir nem podem ser editados, porque ainda não existem
    de verdade no banco.
  - Quando o mês realmente chega e o app é aberto, o lançamento real é
    gerado normalmente e substitui a versão prevista na lista.

## Prioridade alta (ainda não iniciado)

- [ ] **Backup/exportação dos dados** — exportar/importar JSON (ou .xlsx) dos
  lançamentos. Hoje os dados só existem no IndexedDB daquele
  navegador/dispositivo — sem isso, limpar cache ou trocar de celular perde
  tudo.
- [ ] **Saldo controlado por conta** — saldo inicial por conta + saldo
  corrente calculado (o modelo de dados já foi pensado pra isso desde a
  Fase 1: `entries.valor` sempre positivo, sinal pelo `tipo`).
- [ ] **Importação automática do PicPay** — provavelmente exige um
  componente de backend/nuvem (guardar credencial de acesso à API do PicPay,
  buscar transações periodicamente) — é uma mudança de arquitetura maior,
  não só telas novas. `entries.origem` e `entries.externalId` já existem
  prontos pra isso.

## Prioridade baixa (mais pra frente)

- [ ] **Publicar na Google Play** — não precisa reescrever em React Native:
  dá pra empacotar o PWA atual como Trusted Web Activity ou via Capacitor.
- [ ] **Modo escuro** — alternador de tema, aproveitando os tokens de cor já
  centralizados no `index.css`.
- [ ] **Busca no histórico e relatórios exportáveis** — busca por texto nos
  lançamentos; exportar o resumo mensal como PDF/imagem.
