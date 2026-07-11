package com.github.madbrain.recettelang;

import org.eclipse.lsp4j.*;
import org.eclipse.lsp4j.services.TextDocumentService;

import java.util.HashMap;

/**
 * Actually not incremental only the Full mode is supported.
 *
 * Real incremental implementation is left as an exercice :-)
 */
public class IncrementalTextDocumentService implements TextDocumentService {
    protected HashMap<String, TextDocumentItem> documents = new HashMap<>();

    @Override
    public void didOpen(DidOpenTextDocumentParams params) {
        documents.put(params.getTextDocument().getUri(), params.getTextDocument());
    }

    @Override
    public void didChange(DidChangeTextDocumentParams params) {
        var uri = params.getTextDocument().getUri();
        for (var changeEvent : params.getContentChanges()) {
            // Will be full update because we specified that is all we support
            if (changeEvent.getRange() != null) {
                throw new UnsupportedOperationException("Range should be null for full document update.");
            }
            documents.get(uri).setText(changeEvent.getText());
        }
    }

    @Override
    public void didClose(DidCloseTextDocumentParams params) {
        documents.remove(params.getTextDocument().getUri());
    }

    @Override
    public void didSave(DidSaveTextDocumentParams params) {
    }
}
