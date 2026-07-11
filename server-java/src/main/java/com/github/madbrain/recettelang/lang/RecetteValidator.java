package com.github.madbrain.recettelang.lang;

import org.eclipse.lsp4j.Diagnostic;
import org.eclipse.lsp4j.DiagnosticSeverity;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class RecetteValidator {

    private final DiagnosticReporter reporter;

    public RecetteValidator(DiagnosticReporter reporter) {
        this.reporter = reporter;
    }

    public ValidationResult validate(Recette recette) {
        var knownIngredients = new HashMap<String, Ingredient>();
        var unknownIngredients = new ArrayList<Word>();

        recette.sections().forEach(section -> {
            if (section.isIngredients()) {
                section.getStatements().forEach(statement -> {
                    var word = statement.words().getFirst();
                    if (knownIngredients.containsKey(word.value())) {
                        reporter.reportError(word.range(), "duplicated ingredient");
                    } else {
                        knownIngredients.put(word.value(), new Ingredient(word));
                    }
                });
            }
        });

        for (var section : recette.sections()) {
            if (section.isIngredients()) {
                continue;
            }
            section.getStatements().forEach(statement -> {
                var firstWord = statement.words().getFirst();
                var verb = Verb.findVerb(firstWord.value()).orElse(null);
                if (verb != null) {
                    if (verb.needIngredient()) {
                        if (statement.words().size() < 2) {
                            reporter.reportError(firstWord.range(), "need ingredient(s)");
                        } else {
                            for (Word complement : statement.words().subList(1, statement.words().size())) {
                                var ingredient = knownIngredients.get(complement.value());
                                if (ingredient == null) {
                                    unknownIngredients.add(complement);
                                    reporter.reportError(complement.range(), "unknown ingredient");
                                } else {
                                    ingredient.getUsages().add(complement);
                                }
                            }
                        }
                    }
                } else if (Verb.isAdverb(firstWord.value())) {
                    if (statement.words().size() < 2) {
                        reporter.reportError(firstWord.range(), "missing tool");
                    } else {
                        var tool = statement.words().get(1);
                        if (!Verb.TOOLS.contains(tool.value())) {
                            reporter.reportError(tool.range(), "unknown tool");
                        }
                    }
                } else {
                    reporter.reportError(firstWord.range(), "unknown verb or adverb");
                }
            });
        }
        return new ValidationResult(recette, knownIngredients, unknownIngredients);
    }
}
