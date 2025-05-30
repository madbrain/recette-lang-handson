
import logging
from pygls.cli import start_server
from pygls.lsp.server import LanguageServer
from pygls.workspace import TextDocument
from lsprotocol import types
from dataclasses import dataclass, field
from collections import defaultdict

class RecetteLanguageServer(LanguageServer):

    def __init__(self):
        super().__init__("recette-lang-server", "v0.1")

    def validate(self, doc: TextDocument):
        return (None, [
            types.Diagnostic(
                range=types.Range(start=types.Position(line=0, character=0), end=types.Position(line=0, character=10)),
                message="Zenika rulez!"
            )
        ])


server = RecetteLanguageServer()


@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: RecetteLanguageServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is opened"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ast, diagnostics = ls.validate(doc)
    ls.text_document_publish_diagnostics(
        types.PublishDiagnosticsParams(
            uri=doc.uri,
            version=doc.version,
            diagnostics=diagnostics,
        )
    )


@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: RecetteLanguageServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is changed"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ast, diagnostics = ls.validate(doc)
    ls.text_document_publish_diagnostics(
        types.PublishDiagnosticsParams(
            uri=doc.uri,
            version=doc.version,
            diagnostics=diagnostics,
        )
    )

#logging.basicConfig(filename='pygls.log', filemode='w', level=logging.INFO)

if __name__ == "__main__":
    start_server(server)
