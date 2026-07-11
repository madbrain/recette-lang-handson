package com.github.madbrain.recettelang.lang;

import org.eclipse.lsp4j.Range;

import java.util.ArrayList;
import java.util.List;

public class Section {
    private final Range range;
    private final String name;
    private final List<Statement> statements = new ArrayList<>();

    public Section(Range range, String name) {
        this.range = range;
        this.name = name;
    }

    public Range getRange() {
        return range;
    }

    public String getName() {
        return name;
    }

    public List<Statement> getStatements() {
        return statements;
    }

    public boolean isIngredients() {
        return name.equals("ingrédients");
    }
}
