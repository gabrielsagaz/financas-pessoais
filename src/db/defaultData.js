// Categorias/subcategorias padrão, copiadas da aba "Cadastros" da planilha
// original do usuário. O app permite criar, renomear e excluir livremente —
// isto é só a carga inicial (roda uma única vez, na primeira abertura).

export const CATEGORIAS_PADRAO = [
  {
    tipo: 'receita',
    nome: 'Salário',
    subcategorias: []
  },
  { tipo: 'receita', nome: 'Férias', subcategorias: [] },
  { tipo: 'receita', nome: '13º Salário', subcategorias: [] },
  { tipo: 'receita', nome: 'Aposentadoria', subcategorias: [] },
  { tipo: 'receita', nome: 'Receita extra (aluguel, restituição IR)', subcategorias: [] },
  { tipo: 'receita', nome: 'Pensão', subcategorias: [] },
  { tipo: 'receita', nome: 'Empréstimos', subcategorias: [] },
  { tipo: 'receita', nome: 'Bônus', subcategorias: [] },
  { tipo: 'receita', nome: 'Outras receitas', subcategorias: [] },

  {
    tipo: 'despesa',
    nome: 'Alimentação',
    subcategorias: ['Supermercado', 'Feira / Sacolão', 'Padaria', 'Refeição fora de casa', 'Outros (café, água, sorvetes, etc)']
  },
  {
    tipo: 'despesa',
    nome: 'Moradia',
    subcategorias: [
      'Prestação / Aluguel de imóvel', 'Condomínio', 'Consumo de água',
      'Serviço de limpeza (diarista ou mensalista)', 'Energia Elétrica', 'Gás',
      'IPTU', 'Decoração da casa', 'Manutenção / Reforma da casa', 'Celular',
      'Telefone fixo', 'Internet / TV a cabo'
    ]
  },
  {
    tipo: 'despesa',
    nome: 'Educação',
    subcategorias: ['Matrícula Escolar / Mensalidade', 'Material Escolar', 'Outros cursos']
  },
  {
    tipo: 'despesa',
    nome: 'Pet',
    subcategorias: ['Ração', 'Banho / Tosa', 'Veterinário / medicamento', 'Outros (acessórios, brinquedos, hotel, dog walker)']
  },
  {
    tipo: 'despesa',
    nome: 'Saúde',
    subcategorias: [
      'Plano de saúde', 'Medicamentos', 'Dentista', 'Terapia / Psicólogo / Acupuntura',
      'Médicos / Exames fora do plano de saúde', 'Academia / Tratamento Estético'
    ]
  },
  {
    tipo: 'despesa',
    nome: 'Transporte',
    subcategorias: [
      'Ônibus / Metrô', 'Taxi / Uber', 'Combustível', 'Estacionamento', 'Seguro Auto',
      'Manutenção / Lavagem / Troca de óleo', 'Licenciamento', 'Pedágio', 'IPVA'
    ]
  },
  {
    tipo: 'despesa',
    nome: 'Pessoais',
    subcategorias: ['Vestuário / Calçados / Acessórios', 'Cabeleireiro / Manicure / Higiene pessoal', 'Presentes', 'Outros']
  },
  {
    tipo: 'despesa',
    nome: 'Lazer',
    subcategorias: ['Cinema / Teatro / Shows', "Livros / Revistas / CD's", 'Clube / Parques / Casa Noturna', 'Viagens', 'Restaurantes / Bares / Festas']
  },
  {
    tipo: 'despesa',
    nome: 'Financeiros',
    subcategorias: [
      'Empréstimos', 'Seguros (vida/residencial)', 'Previdência privada', 'Juros Cheque Especial',
      'Tarifas bancárias', 'Financiamento de veículo', 'Pagamento da fatura do cartão de crédito',
      'Imposto de Renda a Pagar', 'Saque', 'Boletos'
    ]
  },

  { tipo: 'investimento', nome: 'Ações', subcategorias: [] },
  { tipo: 'investimento', nome: 'Tesouro Direto', subcategorias: [] },
  { tipo: 'investimento', nome: 'Renda Fixa', subcategorias: [] },
  { tipo: 'investimento', nome: 'Previdência Privada', subcategorias: [] },
  { tipo: 'investimento', nome: 'Poupança', subcategorias: [] }
];

export const CONTAS_PADRAO = ['Banco do Brasil', 'Itaú', 'Nubank', 'PicPay', 'Dinheiro'];

export const TIPOS = {
  receita: { label: 'Receita', cor: '#1b8f5a' },
  despesa: { label: 'Despesa', cor: '#d64545' },
  investimento: { label: 'Investimento', cor: '#2563eb' }
};
