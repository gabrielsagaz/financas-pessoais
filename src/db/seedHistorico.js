// Lançamentos já existentes na planilha original do usuário (jan-ago/2024).
// Importados uma única vez na primeira abertura do app, para não perder o
// histórico ao migrar da planilha pro app. O usuário pode editar/excluir
// qualquer um deles normalmente depois.
//
// categoria/subcategoria aqui são só os NOMES (string) — o db.js resolve
// para os IDs corretos ao importar, batendo com CATEGORIAS_PADRAO.

export const RECEITAS_HISTORICO = [
  { categoria: 'Salário', valor: 7200, conta: 'Banco do Brasil', data: '2024-01-01' },
  { categoria: 'Outras receitas', valor: 1200, conta: 'Banco do Brasil', data: '2024-01-01' },
  { categoria: 'Salário', valor: 7200, conta: 'Banco do Brasil', data: '2024-02-01' },
  { categoria: 'Outras receitas', valor: 1400, conta: 'Banco do Brasil', data: '2024-02-01' },
  { categoria: 'Salário', valor: 7200, conta: 'Banco do Brasil', data: '2024-03-01' },
  { categoria: 'Salário', valor: 7200, conta: 'Banco do Brasil', data: '2024-04-01' },
  { categoria: 'Salário', valor: 7200, conta: 'Banco do Brasil', data: '2024-05-01' },
  { categoria: 'Salário', valor: 7200, conta: 'Banco do Brasil', data: '2024-06-01' },
  { categoria: 'Bônus', valor: 3100, conta: 'Banco do Brasil', data: '2024-06-03' },
  { categoria: 'Salário', valor: 7200, conta: 'Banco do Brasil', data: '2024-07-01' },
  { categoria: 'Salário', valor: 7300, conta: 'Banco do Brasil', data: '2024-08-01' }
];

export const DESPESAS_HISTORICO = [
  { categoria: 'Moradia', subcategoria: 'Prestação / Aluguel de imóvel', valor: 2500, conta: 'Banco do Brasil', data: '2024-01-02' },
  { categoria: 'Alimentação', subcategoria: 'Supermercado', valor: 1150, conta: 'Banco do Brasil', data: '2024-01-02' },
  { categoria: 'Saúde', subcategoria: 'Plano de saúde', valor: 1000, conta: 'Banco do Brasil', data: '2024-01-03' },
  { categoria: 'Transporte', subcategoria: 'Ônibus / Metrô', valor: 800, conta: 'Banco do Brasil', data: '2024-01-03' },

  { categoria: 'Moradia', subcategoria: 'Prestação / Aluguel de imóvel', valor: 2500, conta: 'Banco do Brasil', data: '2024-02-02' },
  { categoria: 'Alimentação', subcategoria: 'Supermercado', valor: 1200, conta: 'Banco do Brasil', data: '2024-02-02' },
  { categoria: 'Saúde', subcategoria: 'Plano de saúde', valor: 1000, conta: 'Banco do Brasil', data: '2024-02-01' },
  { categoria: 'Transporte', subcategoria: 'Ônibus / Metrô', valor: 800, conta: 'Banco do Brasil', data: '2024-02-01' },

  { categoria: 'Moradia', subcategoria: 'Prestação / Aluguel de imóvel', valor: 2500, conta: 'Banco do Brasil', data: '2024-03-01' },
  { categoria: 'Alimentação', subcategoria: 'Supermercado', valor: 1200, conta: 'Banco do Brasil', data: '2024-03-01' },
  { categoria: 'Saúde', subcategoria: 'Plano de saúde', valor: 1000, conta: 'Banco do Brasil', data: '2024-03-01' },
  { categoria: 'Transporte', subcategoria: 'Ônibus / Metrô', valor: 800, conta: 'Banco do Brasil', data: '2024-03-01' },

  { categoria: 'Moradia', subcategoria: 'Prestação / Aluguel de imóvel', valor: 2500, conta: 'Banco do Brasil', data: '2024-04-01' },
  { categoria: 'Alimentação', subcategoria: 'Supermercado', valor: 1200, conta: 'Banco do Brasil', data: '2024-04-01' },
  { categoria: 'Saúde', subcategoria: 'Plano de saúde', valor: 1000, conta: 'Banco do Brasil', data: '2024-04-01' },
  { categoria: 'Transporte', subcategoria: 'Ônibus / Metrô', valor: 800, conta: 'Banco do Brasil', data: '2024-04-01' },

  { categoria: 'Moradia', subcategoria: 'Prestação / Aluguel de imóvel', valor: 2500, conta: 'Banco do Brasil', data: '2024-05-01' },
  { categoria: 'Alimentação', subcategoria: 'Supermercado', valor: 1200, conta: 'Banco do Brasil', data: '2024-05-01' },
  { categoria: 'Saúde', subcategoria: 'Plano de saúde', valor: 1000, conta: 'Banco do Brasil', data: '2024-05-01' },
  { categoria: 'Transporte', subcategoria: 'Ônibus / Metrô', valor: 800, conta: 'Banco do Brasil', data: '2024-05-01' },

  { categoria: 'Moradia', subcategoria: 'Prestação / Aluguel de imóvel', valor: 2900, conta: 'Banco do Brasil', data: '2024-06-01' },
  { categoria: 'Alimentação', subcategoria: 'Supermercado', valor: 1200, conta: 'Banco do Brasil', data: '2024-06-01' },
  { categoria: 'Saúde', subcategoria: 'Plano de saúde', valor: 1000, conta: 'Banco do Brasil', data: '2024-06-01' },
  { categoria: 'Transporte', subcategoria: 'Ônibus / Metrô', valor: 800, conta: 'Banco do Brasil', data: '2024-06-01' }
];

export const INVESTIMENTOS_HISTORICO = [
  { categoria: 'Previdência Privada', valor: 430, conta: 'Banco do Brasil', data: '2024-02-17' },
  { categoria: 'Poupança', valor: 4000, conta: 'Banco do Brasil', data: '2024-04-27' }
];
