package com.github.madbrain.recettelang.lang;

import org.eclipse.lsp4j.CompletionItem;
import org.eclipse.lsp4j.CompletionItemKind;
import org.eclipse.lsp4j.Position;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.stream.Stream;

import static com.github.madbrain.recettelang.PositionUtils.isInside;

public record ValidationResult(Recette recette, Map<String, Ingredient> knownIngredients,
                               List<Word> unknownIngredients) {

    public Optional<IngredientSelection> findSelection(Position position) {
        for (var ingredientDef : knownIngredients().values()) {
            if (isInside(position, ingredientDef.getDefinition().range())) {
                return Optional.of(new IngredientSelection(ingredientDef, ingredientDef.getDefinition().range()));
            } else {
                for (var usage : ingredientDef.getUsages()) {
                    if (isInside(position, usage.range())) {
                        return Optional.of(new IngredientSelection(ingredientDef, usage.range()));
                    }
                }
            }
        }
        return Optional.empty();
    }

    public void complete(Position position, BiConsumer<String, CompletionItemKind> addItem) {
        var completeTool = false;
        var completeIngredient = false;
        var completeUnknownIngredient = false;

        for (var sectionIndex = 0; sectionIndex < recette.sections().size(); ++sectionIndex) {
            var section = recette.sections().get(sectionIndex);
            if (section.isIngredients()) {
                if (position.getLine() > section.getRange().getStart().getLine()) {
                    var endPos = (sectionIndex + 1) < recette.sections().size() ? recette.sections().get(sectionIndex + 1).getRange().getStart() : null;
                    if (endPos == null || endPos.getLine() > position.getLine()) {
                        completeUnknownIngredient = true;
                    }
                }
            } else {
                for (var statement : section.getStatements()) {
                    if (!statement.words().isEmpty()) {
                        var firstWord = statement.words().getFirst();
                        if (Verb.isAdverb(firstWord.value())
                                && position.getLine() == firstWord.range().getStart().getLine()
                                && position.getCharacter() > firstWord.range().getEnd().getCharacter()) {
                            completeTool = true;
                        } else {
                            var verb = Verb.findVerb(firstWord.value()).orElse(null);
                            if (verb != null
                                    && position.getLine() == firstWord.range().getStart().getLine()
                                    && position.getCharacter() > firstWord.range().getEnd().getCharacter()) {
                                completeIngredient = verb.needIngredient();
                            }
                        }
                    }
                }
            }
        }

        if (completeTool) {
            Verb.TOOLS.forEach(v -> addItem.accept(v, CompletionItemKind.Class));
        } else if (completeIngredient) {
            knownIngredients().keySet().forEach(v -> addItem.accept(v, CompletionItemKind.Field));
        } else if (completeUnknownIngredient) {
            unknownIngredients().forEach(v -> addItem.accept(v.value(), CompletionItemKind.Field));
        } else {
            Verb.VERBS.forEach(v -> addItem.accept(v.name(), CompletionItemKind.Function));
            Verb.ADVERBS.forEach(v -> addItem.accept(v, CompletionItemKind.Operator));
        }
    }
}
