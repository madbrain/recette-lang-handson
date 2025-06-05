import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	TextDocumentSyncKind,
	InitializeResult,
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

const connection = createConnection(ProposedFeatures.all);

const documents = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
		}
	};
	return result;
});


documents.onDidChangeContent(change => {
	const diagnostics: Diagnostic[] = [
		{
			range: { start: { line: 0, character: 0}, end: { line: 0, character: 10 }},
			message: "Zenika rulez!",
			severity: DiagnosticSeverity.Information
		}
	]
	connection.sendDiagnostics({
		uri: change.document.uri,
		version: change.document.version,
		diagnostics
	}); 
});


documents.listen(connection);

connection.listen();
