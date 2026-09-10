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

## Concluído (set/2026)

- [x] **Ajustar valor de um lançamento fixo só naquele mês** — nos
  previstos do Histórico, clicar abre uma edição simples só do valor
  (categoria/conta/data continuam vindo da recorrência). O ajuste vale só
  pra aquele mês — os outros continuam com o valor padrão. Por baixo,
  vira uma "exceção" (`excecoesValor`, nova tabela) que é consumida
  automaticamente quando o mês chega e o lançamento real é gerado.
- [x] **Tornar recorrente ao editar** — no Histórico, ao editar um
  lançamento avulso, dá pra ativar "Tornar recorrente" (todo mês ou
  parcelado). Por baixo do capô, o lançamento solto é substituído pela
  primeira ocorrência de uma recorrência nova, já linkada.
- [x] **Duplicar lançamento** — no Histórico, cada lançamento tem um botão
  de duplicar: cria uma cópia independente (sem herdar recorrência/parcela)
  e já abre em edição pra ajustar data/valor na hora.
- [x] **Cartão de crédito (dia de fechamento/vencimento)** — em Categorias →
  Contas, qualquer conta pode ser marcada como cartão, com dia de
  fechamento e de vencimento. O Histórico mostra em qual fatura cada gasto
  cai e quando ela vence (`src/utils/cartao.js`). Só organiza a
  visualização — não controla saldo da fatura nem soma total por cartão
  ainda (ideia pra uma futura tela de "Faturas", ver abaixo).
- [x] **Backup/exportação dos dados** — em Categorias → Dados: exportar
  baixa um `.json` com categorias, subcategorias, contas, lançamentos,
  recorrências e orçamentos (fica de fora `configuracoes`, que guarda o hash
  do PIN — é config do dispositivo, não dado financeiro). Importar substitui
  totalmente os dados atuais pelos do arquivo (`src/db/backup.js`).
- [x] **Apagar todos os lançamentos** — reset do histórico (`entries`),
  mantendo categorias/contas/recorrências. Ao apagar, `ultimaGeracao` de cada
  recorrência é reposicionada pro mês atual, senão elas regenerariam do zero
  os mesmos lançamentos que acabaram de ser apagados.

## Decisão registrada — Login com Google (adiado)

- Avaliado pedir login com Google agora para ter sessão de usuário. Adiado
  a pedido do usuário: só faz sentido introduzir login/conta quando a Fase 2
  trouxer backend/servidor de verdade (multiusuário e/ou sincronização entre
  dispositivos) — hoje o app é 100% local, sem servidor, e um login sozinho
  não mudaria onde os dados ficam guardados. Retomar essa conversa junto com
  "Saldo controlado por conta" / infraestrutura de servidor da Fase 2.

## Prioridade alta (ainda não iniciado)

- [ ] **Saldo controlado por conta** — saldo inicial por conta + saldo
  corrente calculado (o modelo de dados já foi pensado pra isso desde a
  Fase 1: `entries.valor` sempre positivo, sinal pelo `tipo`).
- [ ] **Importação automática do PicPay** — provavelmente exige um
  componente de backend/nuvem (guardar credencial de acesso à API do PicPay,
  buscar transações periodicamente) — é uma mudança de arquitetura maior,
  não só telas novas. `entries.origem` e `entries.externalId` já existem
  prontos pra isso.

## Prioridade baixa (mais pra frente)

- [ ] **Tela de "Faturas"** — hoje o cartão só mostra a fatura em cada linha
  do Histórico. Uma tela dedicada agrupando por fatura (total da fatura,
  data de vencimento, marcá-la como paga) ficaria mais completa — natural
  de fazer junto com "Saldo controlado por conta" da Fase 2.
- [ ] **Publicar na Google Play** — não precisa reescrever em React Native:
  dá pra empacotar o PWA atual como Trusted Web Activity ou via Capacitor.
- [ ] **Modo escuro** — alternador de tema, aproveitando os tokens de cor já
  centralizados no `index.css`.
- [ ] **Busca no histórico e relatórios exportáveis** — busca por texto nos
  lançamentos; exportar o resumo mensal como PDF/imagem.
