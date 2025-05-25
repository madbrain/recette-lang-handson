package main

import (
	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
	"github.com/tliron/glsp/server"
)

const lsName = "recette language server"

var (
	handler protocol.Handler
	version string = "0.0.1"
)

func main() {

	handler = protocol.Handler{
		Initialize:            initialize,
		Initialized:           initialized,
		TextDocumentDidOpen:   text_document_did_open,
		TextDocumentDidChange: text_document_did_change,
		Shutdown:              shutdown,
	}

	server := server.NewServer(&handler, lsName, false)

	server.RunStdio()
}

func initialize(context *glsp.Context, params *protocol.InitializeParams) (any, error) {
	capabilities := handler.CreateServerCapabilities()
	capabilities.TextDocumentSync = protocol.TextDocumentSyncKindFull

	return protocol.InitializeResult{
		Capabilities: capabilities,
		ServerInfo: &protocol.InitializeResultServerInfo{
			Name:    lsName,
			Version: &version,
		},
	}, nil
}

func initialized(context *glsp.Context, params *protocol.InitializedParams) error {
	return nil
}

func shutdown(context *glsp.Context) error {
	protocol.SetTraceValue(protocol.TraceValueOff)
	return nil
}

func text_document_did_open(context *glsp.Context, params *protocol.DidOpenTextDocumentParams) error {
	diagnostics := validate_document(params.TextDocument.Text)
	go context.Notify(protocol.ServerTextDocumentPublishDiagnostics, protocol.PublishDiagnosticsParams{
		URI:         params.TextDocument.URI,
		Diagnostics: diagnostics,
	})
	return nil
}

func text_document_did_change(context *glsp.Context, params *protocol.DidChangeTextDocumentParams) error {
	diagnostics := validate_document(params.ContentChanges[0].(protocol.TextDocumentContentChangeEventWhole).Text)
	go context.Notify(protocol.ServerTextDocumentPublishDiagnostics, protocol.PublishDiagnosticsParams{
		URI:         params.TextDocument.URI,
		Diagnostics: diagnostics,
	})
	return nil
}

func validate_document(text string) []protocol.Diagnostic {
	diagnostics := []protocol.Diagnostic{}

	// TODO analyze document
	severity := protocol.DiagnosticSeverityInformation
	diagnostics = append(diagnostics, protocol.Diagnostic{
		Range:    protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 10}},
		Severity: &severity,
		Message:  "Zenika rulez!",
	})

	return diagnostics
}
