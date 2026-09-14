// Categorias/subcategorias padrão, copiadas da aba "Cadastros" da planilha
// original do usuário. O app permite criar, renomear e excluir livremente —
// isto é só a carga inicial (roda uma única vez, na primeira abertura).
//
// `classificacao` (Fase 3 — planejamento em cascata): toda categoria de
// despesa tem uma classificação padrão (Necessidade/Desejo/Dívida) ou, no
// caso de Educação, Investimento (decisão do usuário: "invisto em mim").
// Categorias de investimento são implicitamente 'investimento' — não
// precisam do campo. Categorias de receita não usam classificação (não são
// gasto). Uma subcategoria pode ter sua própria `classificacao`, que
// SOBRESCREVE a da categoria-mãe só nela — o resto das subcategorias
// continua herdando normalmente (ver classificacaoEfetiva() em
// utils/classificacao.js).
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
    classificacao: 'necessidade',
    subcategorias: [
      'Supermercado', 'Feira / Sacolão', 'Padaria',
      { nome: 'Refeição fora de casa', classificacao: 'desejo' },
      'Outros (café, água, sorvetes, etc)'
    ]
  },
  {
    tipo: 'despesa',
    nome: 'Moradia',
    classificacao: 'necessidade',
    subcategorias: [
      'Prestação / Aluguel de imóvel', 'Condomínio', 'Consumo de água',
      'Serviço de limpeza (diarista ou mensalista)', 'Energia Elétrica', 'Gás',
      'IPTU', { nome: 'Decoração da casa', classificacao: 'desejo' },
      'Manutenção / Reforma da casa', 'Celular', 'Telefone fixo', 'Internet / TV a cabo'
    ]
  },
  {
    tipo: 'despesa',
    nome: 'Educação',
    classificacao: 'investimento', // decisão do usuário: educação é investir em si mesmo
    subcategorias: ['Matrícula Escolar / Mensalidade', 'Material Escolar', 'Outros cursos']
  },
  {
    tipo: 'despesa',
    nome: 'Pet',
    classificacao: 'necessidade',
    subcategorias: [
      'Ração', { nome: 'Banho / Tosa', classificacao: 'desejo' },
      'Veterinário / medicamento', 'Outros (acessórios, brinquedos, hotel, dog walker)'
    ]
  },
  {
    tipo: 'despesa',
    nome: 'Saúde',
    classificacao: 'necessidade',
    subcategorias: [
      'Plano de saúde', 'Medicamentos', 'Dentista', 'Terapia / Psicólogo / Acupuntura',
      'Médicos / Exames fora do plano de saúde',
      { nome: 'Academia / Tratamento Estético', classificacao: 'desejo' }
    ]
  },
  {
    tipo: 'despesa',
    nome: 'Transporte',
    classificacao: 'necessidade',
    subcategorias: [
      'Ônibus / Metrô', 'Taxi / Uber', 'Combustível', 'Estacionamento', 'Seguro Auto',
      'Manutenção / Lavagem / Troca de óleo', 'Licenciamento', 'Pedágio', 'IPVA'
    ]
  },
  {
    tipo: 'despesa',
    nome: 'Pessoais',
    classificacao: 'desejo',
    subcategorias: ['Vestuário / Calçados / Acessórios', 'Cabeleireiro / Manicure / Higiene pessoal', 'Presentes', 'Outros']
  },
  {
    tipo: 'despesa',
    nome: 'Lazer',
    classificacao: 'desejo',
    subcategorias: ['Cinema / Teatro / Shows', "Livros / Revistas / CD's", 'Clube / Parques / Casa Noturna', 'Viagens', 'Restaurantes / Bares / Festas']
  },
  {
    tipo: 'despesa',
    nome: 'Financeiros',
    classificacao: 'divida',
    // Previdência privada saiu de aqui — já existe como categoria própria
    // em Investimentos; ter as duas era uma inconsistência (mesma coisa
    // classificada em dois lugares diferentes).
    subcategorias: [
      'Empréstimos',
      { nome: 'Seguros (vida/residencial)', classificacao: 'necessidade' },
      'Juros Cheque Especial',
      { nome: 'Tarifas bancárias', classificacao: 'necessidade' },
      'Financiamento de veículo',
      'Pagamento da fatura do cartão de crédito',
      { nome: 'Imposto de Renda a Pagar', classificacao: 'necessidade' },
      { nome: 'Saque', classificacao: 'necessidade' },
      { nome: 'Boletos', classificacao: 'necessidade' }
    ]
  },

  { tipo: 'investimento', nome: 'Ações', subcategorias: [] },
  { tipo: 'investimento', nome: 'Tesouro Direto', subcategorias: [] },
  { tipo: 'investimento', nome: 'Renda Fixa', subcategorias: [] },
  { tipo: 'investimento', nome: 'Previdência Privada', subcategorias: [] },
  { tipo: 'investimento', nome: 'Poupança', subcategorias: [] }
];

export const CONTAS_PADRAO = ['Banco do Brasil', 'Itaú', 'Nubank', 'PicPay', 'Dinheiro'];

// Paleta inspirada nas cores de sistema da Apple (systemGreen/Red/Blue),
// ajustada para ter contraste suficiente como texto sobre fundo branco.
export const TIPOS = {
  receita: { label: 'Receita', cor: '#1c8a4b' },
  despesa: { label: 'Despesa', cor: '#d92d20' },
  investimento: { label: 'Investimento', cor: '#0071e3' }
};

// Transferência entre contas fica de propósito FORA de `TIPOS`: não é um
// tipo financeiro (não tem categoria, não entra nos totais de
// receita/despesa/investimento do Resumo). Só existe pra mover saldo de
// uma conta pra outra. `TIPOS_TODOS` é usado onde a interface precisa
// listar/colorir os 4 juntos (Lançar, Histórico) — Categorias continua
// usando só `TIPOS`, porque transferência não tem categoria pra gerenciar.
export const TIPO_TRANSFERENCIA = { label: 'Transferência', cor: '#8e8e93' };
export const TIPOS_TODOS = { ...TIPOS, transferencia: TIPO_TRANSFERENCIA };

export function corDoTipo(tipo) {
  return TIPOS[tipo]?.cor ?? TIPO_TRANSFERENCIA.cor;
}

export const CORES_CATEGORIAS = [
  '#0071e3', '#ff9f0a', '#1c8a4b', '#af52de', '#ff375f',
  '#32ade6', '#ffb340', '#8e8e93', '#bf5af2'
];

// Classificações da Fase 3 (planejamento em cascata). 'investimento' aqui
// é só pra despesas classificadas assim (ex: Educação) — categorias com
// tipo 'investimento' já são investimento por definição, sem precisar
// desse campo.
export const CLASSIFICACOES = {
  necessidade: { label: 'Necessidade', cor: '#0071e3' },
  desejo: { label: 'Desejo', cor: '#af52de' },
  divida: { label: 'Dívida', cor: '#d92d20' },
  investimento: { label: 'Investimento', cor: '#1c8a4b' }
};
