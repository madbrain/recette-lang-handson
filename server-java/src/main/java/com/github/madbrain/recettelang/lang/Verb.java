package com.github.madbrain.recettelang.lang;

import java.util.List;
import java.util.Optional;

public record Verb(String name, boolean needIngredient) {

    public final static List<Verb> VERBS = List.of(
            new Verb("verser", true),
            new Verb("touiller", false),
            new Verb("malaxer", false),
            new Verb("mélanger", true),
            new Verb("incorporer", false),
            new Verb("étaler", false),
            new Verb("fondre", true),
            new Verb("cuire", false)
    );

    public final static List<String> ADVERBS = List.of("avec", "dans");

    public final static List<String> TOOLS = List.of(
            "saladier",
            "cuillère",
            "plat",
            "mixeur",
            "four"
    );

    public static boolean isAdverb(String value) {
        return ADVERBS.contains(value);
    }

    public static Optional<Verb> findVerb(String name) {
        return VERBS.stream().filter(v -> v.name().equals(name)).findFirst();
    }
}
