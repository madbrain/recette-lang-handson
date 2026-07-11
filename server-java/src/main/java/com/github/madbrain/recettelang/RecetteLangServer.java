package com.github.madbrain.recettelang;

import com.github.madbrain.recettelang.lang.*;
import org.eclipse.lsp4j.*;
import org.eclipse.lsp4j.jsonrpc.messages.Either;
import org.eclipse.lsp4j.jsonrpc.messages.Either3;
import org.eclipse.lsp4j.services.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.stream.Stream;


public class RecetteLangServer implements LanguageServer, LanguageClientAware {
    private LanguageClient client;

    private final IncrementalTextDocumentService textDocumentService = new IncrementalTextDocumentService() {
        @Override
        public void didOpen(DidOpenTextDocumentParams params) {
            super.didOpen(params);
            validate(new TextDocumentIdentifier(params.getTextDocument().getUri()));
        }

        @Override
        public void didChange(DidChangeTextDocumentParams params) {
            super.didChange(params);
            validate(params.getTextDocument());
        }

        // TODO could debounce validation for performances
        private void validate(TextDocumentIdentifier document) {

            var diagnostics = new ArrayList<Diagnostic>();
            var reporter = new DiagnosticReporter() {

                @Override
                public void reportError(Range range, String message) {
                    var diag = new Diagnostic(range, message);
                    diag.setSeverity(DiagnosticSeverity.Error);
                    diagnostics.add(diag);
                }
            };

            getValidationResult(document, reporter);

            client.publishDiagnostics(new PublishDiagnosticsParams(document.getUri(), diagnostics));
        }

        // TODO should cache
        private ValidationResult getValidationResult(TextDocumentIdentifier textDocument, DiagnosticReporter reporter) {
            var text = documents.get(textDocument.getUri()).getText();
            var recette = new RecetteParser(reporter).parse(text);
            return new RecetteValidator(reporter).validate(recette);
        }

        private ValidationResult getValidationResult(TextDocumentIdentifier textDocument) {
            return getValidationResult(textDocument, DiagnosticReporter.NullReporter);
        }

        @Override
        public CompletableFuture<Either3<Range, PrepareRenameResult, PrepareRenameDefaultBehavior>> prepareRename(PrepareRenameParams params) {
            var validationResult = getValidationResult(params.getTextDocument());
            var selection = validationResult.findSelection(params.getPosition());

            return CompletableFuture.completedFuture(Either3.forFirst(selection.map(IngredientSelection::range).orElse(null)));
        }

        @Override
        public CompletableFuture<WorkspaceEdit> rename(RenameParams params) {
            var validationResult = getValidationResult(params.getTextDocument());

            Function<Range, TextEdit> newTextEdit = (Range range) -> new TextEdit(range, params.getNewName());
            var edit = validationResult.findSelection(params.getPosition()).map(selection -> {
                var textEdits = Stream.concat(
                        selection.ingredient().getUsages().stream().map(usage -> newTextEdit.apply(usage.range())),
                        Stream.of(newTextEdit.apply(selection.ingredient().getDefinition().range()))).toList();
                return new WorkspaceEdit(Map.of(params.getTextDocument().getUri(), textEdits));
            }).orElse(null);
            return CompletableFuture.completedFuture(edit);
        }

        @Override
        public CompletableFuture<Either<List<CompletionItem>, CompletionList>> completion(CompletionParams params) {
            var validationResult = getValidationResult(params.getTextDocument());

            final List<CompletionItem> items = new ArrayList<>();
            BiConsumer<String, CompletionItemKind> addItem = (String label, CompletionItemKind kind) -> {
                var item = new CompletionItem(label);
                item.setKind(kind);
                items.add(item);
            };

            validationResult.complete(params.getPosition(), addItem);
            return CompletableFuture.completedFuture(Either.forRight(new CompletionList(false, items)));
        }
    };

    @Override
    public CompletableFuture<InitializeResult> initialize(InitializeParams initializeParams) {
        var capabilities = new ServerCapabilities();
        capabilities.setTextDocumentSync(TextDocumentSyncKind.Full);
        capabilities.setCompletionProvider(new CompletionOptions());
        capabilities.setRenameProvider(new RenameOptions(true));
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

}
