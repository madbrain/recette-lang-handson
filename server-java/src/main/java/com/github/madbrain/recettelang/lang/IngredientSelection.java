package com.github.madbrain.recettelang.lang;

import org.eclipse.lsp4j.Range;

public record IngredientSelection(Ingredient ingredient, Range range) {
}
