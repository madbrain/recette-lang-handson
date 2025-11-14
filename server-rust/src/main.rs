use tower_lsp::jsonrpc::Result;
use tower_lsp::lsp_types::*;
use tower_lsp::{Client, LanguageServer, LspService, Server};

struct TextDocumentItem {
    uri: Url,
    text: String,
    version: i32,
}

#[derive(Debug)]
struct Backend {
    client: Client,
}

#[tower_lsp::async_trait]
impl LanguageServer for Backend {
    async fn initialize(&self, _: InitializeParams) -> Result<InitializeResult> {
        Ok(InitializeResult {
            capabilities: ServerCapabilities {
                text_document_sync: Some(TextDocumentSyncCapability::Kind(
                    TextDocumentSyncKind::FULL,
                )),
                ..ServerCapabilities::default()
            },
            ..InitializeResult::default()
        })
    }

    async fn initialized(&self, _: InitializedParams) {
        self.client
            .log_message(MessageType::INFO, "server initialized!")
            .await;
    }

    async fn did_open(&self, params: DidOpenTextDocumentParams) {
        self.on_change(TextDocumentItem {
            uri: params.text_document.uri,
            text: params.text_document.text,
            version: params.text_document.version,
        })
        .await
    }

    async fn did_change(&self, mut params: DidChangeTextDocumentParams) {
        self.on_change(TextDocumentItem {
            uri: params.text_document.uri,
            text: std::mem::take(&mut params.content_changes[0].text),
            version: params.text_document.version,
        })
        .await
    }

    async fn shutdown(&self) -> Result<()> {
        Ok(())
    }
}

struct Title {
    range: Range,
    value: String,
}

impl Backend {
    async fn on_change(self: &Self, item: TextDocumentItem) {
        let mut diagnostics: Vec<Diagnostic> = Vec::new();

        let mut title: Option<Title> = None;
        item.text
            .split("\n")
            .enumerate()
            .for_each(|(line, content)| {
                let mut chars = content.char_indices();
                let next = chars.next();
                if next.is_none() {
                    return
                }
                let (offset, c) = next.unwrap();
                // TODO skip spaces
                if c == '#' {
                    // TODO count sharps to check if title or section
                    if title.is_some() {
                        diagnostics.push(Diagnostic {
                            range: Range {
                                start: Position {
                                    line: line as u32,
                                    character: offset as u32,
                                },
                                end: Position {
                                    line: line as u32,
                                    character: offset as u32+1,
                                },
                            },
                            message: "title already defined".to_string(),
                            severity: Some(DiagnosticSeverity::ERROR),
                            ..Diagnostic::default()
                        });
                    } else {
                        title = Some(Title { range: Range {
                                start: Position {
                                    line: line as u32,
                                    character: offset as u32,
                                },
                                end: Position {
                                    line: line as u32,
                                    character: offset as u32+1,
                                },
                            }, value: content[(offset+1) as usize..content.len()].to_string() }) // TODO should consider chars and not bytes
                    }
                } else {
                }
            });

        // TODO
        diagnostics.push(Diagnostic {
            range: Range {
                start: Position {
                    line: 0,
                    character: 0,
                },
                end: Position {
                    line: 0,
                    character: 10,
                },
            },
            message: "Zenika rulez!".to_string(),
            severity: Some(DiagnosticSeverity::INFORMATION),
            ..Diagnostic::default()
        });
        self.client
            .publish_diagnostics(item.uri.clone(), diagnostics, Some(item.version))
            .await;
    }
}

#[tokio::main]
async fn main() {
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();

    let (service, socket) = LspService::new(|client| Backend { client });
    Server::new(stdin, stdout, socket).serve(service).await;
}
