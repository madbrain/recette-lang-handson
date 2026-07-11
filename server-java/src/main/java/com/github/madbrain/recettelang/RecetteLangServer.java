package com.github.madbrain.recettelang;

import org.eclipse.lsp4j.*;
import org.eclipse.lsp4j.services.*;

import java.util.List;
import java.util.concurrent.CompletableFuture;

public class RecetteLangServer implements LanguageServer, LanguageClientAware {
    private LanguageClient client;

    private final IncrementalTextDocumentService textDocumentService = new IncrementalTextDocumentService() {
        @Override
        public void didOpen(DidOpenTextDocumentParams params) {
            super.didOpen(params);
            validate(documents.get(params.getTextDocument().getUri()));
        }

        @Override
        public void didChange(DidChangeTextDocumentParams params) {
            super.didChange(params);
            validate(documents.get(params.getTextDocument().getUri()));
        }
    };

    @Override
    public CompletableFuture<InitializeResult> initialize(InitializeParams initializeParams) {
        var capabilities = new ServerCapabilities();
        capabilities.setTextDocumentSync(TextDocumentSyncKind.Full);
        return CompletableFuture.completedFuture(new InitializeResult(capabilities));
    }

    @Override
    public CompletableFuture<Object> shutdown() {
        return CompletableFuture.completedFuture(null);
    }

    @Override
    public void exit() {
    }

    @Override
    public TextDocumentService getTextDocumentService() {
        return textDocumentService;
    }

    @Override
    public WorkspaceService getWorkspaceService() {
        return new WorkspaceService() {
            @Override
            public void didChangeConfiguration(DidChangeConfigurationParams didChangeConfigurationParams) {
            }

            @Override
            public void didChangeWatchedFiles(DidChangeWatchedFilesParams didChangeWatchedFilesParams) {
            }
        };
    }

    @Override
    public void connect(LanguageClient languageClient) {
        this.client = languageClient;
    }

    private void validate(TextDocumentItem document) {
        // Modify code Here
        var diag = new Diagnostic(new Range(new Position(0, 0), new Position(0, 10)), "Zenika rulez");
        diag.setSeverity(DiagnosticSeverity.Information);
        client.publishDiagnostics(new PublishDiagnosticsParams(document.getUri(), List.of(diag)));
    }
}
