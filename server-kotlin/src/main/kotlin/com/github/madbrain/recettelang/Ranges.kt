package com.github.madbrain.recettelang

import org.eclipse.lsp4j.Position
import org.eclipse.lsp4j.Range

fun mergeRanges(ranges: List<Range>): Range {
    if (ranges.isEmpty()) {
        return Range(Position(0, 0), Position(0, 0))
    }
    return ranges.reduce { a, b -> unionRange(a, b) }
}

fun unionRange(a: Range, b: Range): Range {
    return Range(minPosition(a.start, b.start), maxPosition(a.end, b.end))
}

fun minPosition(a: Position, b: Position): Position {
    if (a.line < b.line) {
        return a
    }
    if (a.line > b.line) {
        return b
    }
    return Position(a.line, Math.min(a.character, b.character))
}

fun maxPosition(a: Position, b: Position): Position {
    if (a.line > b.line) {
        return a
    }
    if (a.line < b.line) {
        return b
    }
    return Position(a.line, Math.max(a.character, b.character))
}
