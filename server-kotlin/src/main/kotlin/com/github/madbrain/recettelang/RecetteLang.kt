package com.github.madbrain.recettelang

import org.eclipse.lsp4j.*

enum class LineState {
    START,
    HEADER,
    ON_WORD,
    OFF_WORD,
}

class Recette {
    var title: Title? = null
    var section = mutableListOf<Section>()
}

class Title(val span: Range, val text: String)
class Section(val span: Range, val text: String) {
    val instructions = mutableListOf<Instruction>()
}

data class Instruction(val range: Range, val words: List<Word>)

data class Word(val range: Range, val value: String)

val VERBS = setOf("verser", "touiller", "malaxer", "mélanger", "incorporer", "étaler", "fondre", "cuire")
val ADVERBS = setOf("avec", "dans")

fun validateRecette(document: TextDocumentItem): MutableList<Diagnostic> {
    val recette = Recette()
    var currentSection: Section? = null

    val diagnostics = mutableListOf<Diagnostic>()
    document.text.split("\n").forEachIndexed { line, lineContent ->
        var column = 0
        var lineState = LineState.START
        var sectionDepth = 0
        var start = 0
        var end = 0
        val words = mutableListOf<Word>()
        while (column < lineContent.length) {
            val c = lineContent[column]
            when (lineState) {
                LineState.START -> {
                    when (c) {
                        ' ' -> { /* ignore */
                        }
                        '#' -> {
                            lineState = LineState.HEADER
                            start = column
                        }
                        else -> {
                            lineState = LineState.ON_WORD
                            start = column
                        }
                    }
                }
                LineState.HEADER -> {
                    when (c) {
                        '#' -> {
                            ++sectionDepth
                        }
                    }
                }
                LineState.ON_WORD -> {
                    when (c) {
                        ' ' -> {
                            end = column
                            if (start != end) {
                                words.add(Word(Range(Position(line, start), Position(line, end)), lineContent.substring(start, end)))
                            }
                            lineState = LineState.OFF_WORD
                        }
                    }
                }
                LineState.OFF_WORD -> {
                    when(c) {
                        ' ' -> { /* ignore*/ }
                        else -> {
                            start = column
                            lineState = LineState.ON_WORD
                        }
                    }
                }
            }
            ++column
        }
        end = column

        when (lineState) {
            LineState.HEADER -> {
                val range = Range(Position(line, start), Position(line, end))
                if (sectionDepth == 0) {
                    if (recette.title != null) {
                        val diag = Diagnostic(range, "title already defined")
                        diag.severity = DiagnosticSeverity.Error
                        diagnostics.add(diag)
                    } else {
                        recette.title = Title(range, lineContent.substring(start+1).trim())
                    }
                } else {
                    if (recette.title == null) {
                        val diag = Diagnostic(range, "must come after title")
                        diag.severity = DiagnosticSeverity.Error
                        diagnostics.add(diag)
                    } else {
                        currentSection = Section(range, lineContent.substring(start + 2).trim())
                        recette.section.add(currentSection!!)
                    }
                }
            }
            LineState.ON_WORD,
            LineState.OFF_WORD -> {
                if (lineState == LineState.ON_WORD && start != end) {
                    words.add(Word(Range(Position(line, start), Position(line, end)), lineContent.substring(start, end)))
                }
                if (currentSection == null) {
                    val diag = Diagnostic(Range(Position(line, start), Position(line, end)), "must be in a section")
                    diag.severity = DiagnosticSeverity.Error
                    diagnostics.add(diag)
                } else {
                    val instruction = Instruction(mergeRanges(words.map { it.range }), words)
                    currentSection?.instructions?.add(instruction)
                    if (!isVerbOrAdverb(words[0])) {
                        val diag = Diagnostic(words[0].range, "unknown verb or adverb")
                        diag.severity = DiagnosticSeverity.Error
                        diagnostics.add(diag)
                    }
                }
            }
            else -> {
                // ignore empty lines
            }
        }
    }

    return diagnostics
}

private fun isVerbOrAdverb(word: Word): Boolean {
    return word.value in VERBS || word.value in ADVERBS
}
