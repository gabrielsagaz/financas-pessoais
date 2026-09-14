import { db } from '../db/db';
import { CATEGORIAS_PADRAO } from '../db/defaultData';

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

// Classifica retroativamente categorias/subcategorias que já existiam
// antes do campo `classificacao` ser introduzido — combina por NOME exato
// com o que está em CATEGORIAS_PADRAO (a mesma tabela usada no seed de
// conta nova). Categorias que você criou por conta própria (nome não bate
// com nenhuma padrão) ficam de fora — continuam sem classificação até você
// definir manualmente em Categorias.
//
// Só escreve onde `classificacao` ainda está vazio — nunca sobrescreve uma
// escolha que você já tenha feito manualmente na tela de Categorias.
export async function classificarCategoriasExistentes() {
  const mapaCategoria = {}; // 'despesa:Nome' -> classificacao
  const mapaSubcategoria = {}; // 'despesa:Nome::SubNome' -> classificacao
  for (const cat of CATEGORIAS_PADRAO) {
    if (cat.tipo !== 'despesa') continue;
    if (cat.classificacao) mapaCategoria[`${cat.tipo}:${cat.nome}`] = cat.classificacao;
    for (const sub of cat.subcategorias) {
      if (typeof sub !== 'string' && sub.classificacao) {
        mapaSubcategoria[`${cat.tipo}:${cat.nome}::${sub.nome}`] = sub.classificacao;
      }
    }
  }

  const categorias = await db.categorias.toArray();
  let categoriasAtualizadas = 0;
  const categoriaNomePorId = {};
  for (const categoria of categorias) {
    categoriaNomePorId[categoria.id] = categoria.nome;
    if (categoria.classificacao) continue; // já classificada — não sobrescreve
    const classificacao = mapaCategoria[`${categoria.tipo}:${categoria.nome}`];
    if (classificacao) {
      await db.categorias.update(categoria.id, { classificacao });
      categoriasAtualizadas++;
    }
  }

  const subcategorias = await db.subcategorias.toArray();
  let subcategoriasAtualizadas = 0;
  for (const sub of subcategorias) {
    if (sub.classificacao) continue; // já tem override manual — não sobrescreve
    const nomeCategoria = categoriaNomePorId[sub.categoriaId];
    if (!nomeCategoria) continue;
    const classificacao = mapaSubcategoria[`despesa:${nomeCategoria}::${sub.nome}`];
    if (classificacao) {
      await db.subcategorias.update(sub.id, { classificacao });
      subcategoriasAtualizadas++;
    }
  }

  return { categoriasAtualizadas, subcategoriasAtualizadas };
}
