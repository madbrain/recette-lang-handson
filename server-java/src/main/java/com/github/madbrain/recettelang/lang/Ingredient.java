package com.github.madbrain.recettelang.lang;

import java.util.ArrayList;
import java.util.List;

public class Ingredient {
    private final Word definition;
    private final List<Word> usages = new ArrayList<>();

    public Ingredient(Word definition) {
        this.definition = definition;
    }

    public Word getDefinition() {
        return definition;
    }

    public List<Word> getUsages() {
        return usages;
    }
}
