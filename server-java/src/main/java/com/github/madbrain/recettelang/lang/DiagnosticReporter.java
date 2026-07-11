package com.github.madbrain.recettelang.lang;

import org.eclipse.lsp4j.Range;

public interface DiagnosticReporter {
    DiagnosticReporter NullReporter = new DiagnosticReporter() {
        @Override
        public void reportError(Range range, String message) {
        }
    };

    void reportError(Range range, String message);
}
