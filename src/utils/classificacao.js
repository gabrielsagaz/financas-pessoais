// Fase 3 (planejamento em cascata): resolve a classificação efetiva de um
// lançamento — a subcategoria pode sobrescrever a classificação da
// categoria-mãe (ex: "Decoração da casa" é Desejo mesmo dentro de
// Moradia, que é Necessidade); sem override, herda da categoria.
//
// Categorias com tipo 'investimento' são sempre 'investimento', mesmo sem
// o campo `classificacao` setado (é implícito pelo tipo). Categorias de
// receita não têm classificação — não são gasto.
export function classificacaoEfetiva(categoria, subcategoria) {
  if (!categoria) return null;
  if (categoria.tipo === 'investimento') return 'investimento';
  if (categoria.tipo === 'receita') return null;
  return subcategoria?.classificacao || categoria.classificacao || null;
}
