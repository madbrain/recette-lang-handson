package com.github.madbrain.recettelang.lang;

import org.eclipse.lsp4j.Diagnostic;
import org.eclipse.lsp4j.DiagnosticSeverity;
import org.eclipse.lsp4j.Position;
import org.eclipse.lsp4j.Range;

import java.util.ArrayList;
import java.util.List;

public class RecetteParser {

    private final DiagnosticReporter reporter;
    private Title title = null;
    private final List<Section> sections = new ArrayList<>();
    private Section currentSection = null;
    private int line = 0;
    private int column = 0;
    private String lineText;

    public RecetteParser(DiagnosticReporter reporter) {
        this.reporter = reporter;
    }

    private void skipWhiteSpaces() {
        while (column < lineText.length()) {
            if (!Character.isWhitespace(lineText.charAt(column))) {
                break;
            }
            column++;
        }
    }

    private void scanTitleOrSection() {
        var startPosition = column;
        while (lineText.charAt(column) == '#') {
            column++;
        }
        var sharpCount = column - startPosition;
        if (sharpCount == 1) {
            if (title == null) {
                title = new Title(new Range(new Position(line, startPosition), new Position(line, lineText.length())), lineText.substring(column).trim());
            } else {
                reporter.reportError(new Range(new Position(line, startPosition), new Position(line, lineText.length())), "title already defined");
            }
        } else {
            if (title == null) {
                reporter.reportError(new Range(new Position(line, startPosition), new Position(line, lineText.length())), "must come after title");
            }
            currentSection = new Section(new Range(new Position(line, startPosition), new Position(line, lineText.length())), lineText.substring(column).trim());
            sections.add(currentSection);
        }
    }

    private void scanStatement() {
        var words = new ArrayList<Word>();
        boolean inWord = true;
        var startOfFirstWord = column;
        while (column < lineText.length()) {
            var startOfWord = column;
            while (column < lineText.length() && !Character.isWhitespace(lineText.charAt(column))) {
                column++;
            }
            words.add(new Word(new Range(new Position(line, startOfWord), new Position(line, column)), lineText.substring(startOfWord, column)));
            skipWhiteSpaces();
        }

        if (currentSection == null) {
            reporter.reportError(new Range(new Position(line, startOfFirstWord), new Position(line, lineText.length())), "must be in a section");
        } else {
            currentSection.getStatements().add(new Statement(words));
        }
    }

    public Recette parse(String text) {
        for (var currentLine : text.split("\n")) {
            lineText = currentLine;
            column = 0;
            skipWhiteSpaces();

            if (column < lineText.length()) {
                if (lineText.charAt(column) == '#') {
                    scanTitleOrSection();
                } else {
                    scanStatement();
                }
            }
            line++;
        }
        return new Recette(title, sections);
    }
}
