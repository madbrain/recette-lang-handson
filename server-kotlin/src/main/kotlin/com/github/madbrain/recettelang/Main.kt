package com.github.madbrain.recettelang

import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.jsonrpc.Launcher
import org.eclipse.lsp4j.services.*
import java.util.concurrent.CompletableFuture


open class IncrementalTextDocumentService: TextDocumentService {

    protected var documents = mutableMapOf<String, TextDocumentItem>()

    override fun didOpen(params: DidOpenTextDocumentParams) {
        documents[params.textDocument.uri] = params.textDocument;
    }

    override fun didChange(params: DidChangeTextDocumentParams) {
        val uri = params.textDocument.uri
        for (changeEvent in params.contentChanges) {
            // Will be full update because we specified that is all we support
            if (changeEvent.range != null) {
                throw UnsupportedOperationException("Range should be null for full document update.")
            }
            if (changeEvent.rangeLength != null) {
                throw UnsupportedOperationException("RangeLength should be null for full document update.")
            }
            documents[uri]?.text = changeEvent.text
        }
    }

    override fun didClose(params: DidCloseTextDocumentParams) {
        documents.remove(params.textDocument.uri)
    }

    override fun didSave(params: DidSaveTextDocumentParams?) {
    }

}

class RecetteLangServer : LanguageServer, LanguageClientAware {
    private lateinit var client: LanguageClient
    private var textDocumentService = object : IncrementalTextDocumentService() {
        override fun didOpen(params: DidOpenTextDocumentParams) {
            super.didOpen(params)
            documents[params.textDocument.uri]?.let { validate(it) }
        }

        override fun didChange(params: DidChangeTextDocumentParams) {
            super.didChange(params)
            documents[params.textDocument.uri]?.let { validate(it) }
        }
    }

    override fun initialize(params: InitializeParams?): CompletableFuture<InitializeResult> {
        val capabilities = ServerCapabilities()
        capabilities.setTextDocumentSync(TextDocumentSyncKind.Full)
        return CompletableFuture.completedFuture(InitializeResult(capabilities));
    }

    override fun shutdown(): CompletableFuture<Any> {
        return CompletableFuture.completedFuture(null);
    }

    override fun exit() {
    }

    override fun getTextDocumentService(): TextDocumentService {
        return textDocumentService
    }

    override fun getWorkspaceService(): WorkspaceService {
        return object : WorkspaceService {
            override fun didChangeConfiguration(params: DidChangeConfigurationParams) {
            }

            override fun didChangeWatchedFiles(params: DidChangeWatchedFilesParams) {
            }
        }
    }

    override fun connect(client: LanguageClient) {
        this.client = client
    }

    private fun validate(document: TextDocumentItem) {
        val diag = Diagnostic(Range(Position(0, 0), Position(0, 10)), "Zenika rulez")
        diag.severity = DiagnosticSeverity.Information
        client.publishDiagnostics(PublishDiagnosticsParams(document.uri, listOf(diag)))
    }

}

fun main() {
    // TODO add TCP protocol
    //  https://github.com/adamvoss/vscode-languageserver-java-example/blob/master/server/src/main/java/App.java
    val server = RecetteLangServer()
    val launcher = Launcher.createLauncher(server, LanguageClient::class.java, System.`in`, System.out)
    server.connect(launcher.remoteProxy)
    launcher.startListening()
}