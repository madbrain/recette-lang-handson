
import asyncio
import sys
from lsprotocol import types
from pygls.lsp.client import BaseLanguageClient
import pytest
import textwrap
import re
import json
from functools import cmp_to_key

class LanguageClient(BaseLanguageClient):
    """Language client to use for testing."""

    def __init__(self, cmds):
        super().__init__("test-client", "1.0")
        self.diagnostics = {}
        self.cmds = cmds

    async def server_exit(self, server: asyncio.subprocess.Process):
        # -15: terminated (probably by the client)
        #   0: all ok
        if server.returncode not in {-15, 0}:
            if server.stderr is not None:
                err = await server.stderr.read()
                print(f"stderr: {err.decode('utf8')}", file=sys.stderr)

    async def start(self):
        await self.start_io(*self.cmds)
        initialize_result = await self.initialize_async(
                types.InitializeParams(
                    capabilities=types.ClientCapabilities(),
                    root_uri=None # uris.from_fs_path(root_dir),
                )
            )
        assert initialize_result.capabilities.completion_provider is not None

async def create_client():
    config = None
    with open("../config.json") as f:
        config = json.load(f)
    cmds = [ config["command"], *config["args"] ]
    client = LanguageClient(cmds)
    
    @client.feature(types.TEXT_DOCUMENT_PUBLISH_DIAGNOSTICS)
    def publish_diagnostics(ls, params: types.PublishDiagnosticsParams):
        ls.diagnostics[params.uri] = params.diagnostics
    
    await client.start()
    
    return client

def help_text_open(client, text):
    test_uri = "file:///test.rct"
    client.text_document_did_open(
        types.DidOpenTextDocumentParams(
            types.TextDocumentItem(
                uri=test_uri,
                language_id="recette",
                version=0,
                text=text,
            )
        )
    )
    return test_uri


async def help_test_diagnostics(client, text, expected_diagnotics):
    test_uri = help_text_open(client, text)
    await asyncio.sleep(0.05)
    assert test_uri in client.diagnostics
    assert client.diagnostics[test_uri] == expected_diagnotics


def code(text):
    text = textwrap.dedent(text)
    result = ""
    positions = {}
    ranges = {}
    start = 0
    current = types.Position(line=0, character=0)
    def update(s):
        for c in s:
            current.character += 1
            if c == '\n':
                current.line += 1
                current.character = 0
        return s
    for m in re.finditer(r"@{([0-9]+)}|@<([0-9]+)>", text):
        end, new_start = m.span()
        result += update(text[start:end])
        if m.group(1):
            positions[int(m.group(1))] = types.Position(line=current.line, character=current.character)
        else:
            index = int(m.group(2)) 
            end_pos = types.Position(line=current.line, character=current.character) 
            if index in positions:
                ranges[index] = types.Range(start=positions[index], end=end_pos)
            else:
                positions[index] = end_pos
        start = new_start
    result += text[start:]
    return (result, positions, ranges)

####################################

@pytest.mark.asyncio
async def test_parse_multiple_title():
    client = await create_client()
    text, _, ranges = code("""\
            # hello
            @<1># tutu@<1>
            """)
    expected = [
        types.Diagnostic(
            range=ranges[1],
            severity=types.DiagnosticSeverity.Error,
            message="title already defined"
        ),
    ]
    await help_test_diagnostics(client, text, expected)


@pytest.mark.asyncio
async def test_parse_dangling_section():
    client = await create_client()
    text, _, ranges = code("""\
            @<1>## hello@<1>
            """)
    expected = [
       types.Diagnostic(
            range=ranges[1],
            severity=types.DiagnosticSeverity.Error,
            message="must come after title"
        ),
    ]
    await help_test_diagnostics(client, text, expected)

@pytest.mark.asyncio
async def test_parse_dangling_statement():
    client = await create_client()
    text, _, ranges = code("""\
            @<1>hello@<1>
            # title
            """)
    expected = [
        types.Diagnostic(
            range=ranges[1],
            severity=types.DiagnosticSeverity.Error,
            message="must be in a section"
        ),
    ]
    await help_test_diagnostics(client, text, expected)

@pytest.mark.asyncio
async def test_parse_unknown_verb():
    client = await create_client()
    text, _, ranges = code("""\
            # title
            ## section
            @<1>hello@<1>
            """)
    expected = [
        types.Diagnostic(
            range=ranges[1],
            severity=types.DiagnosticSeverity.Error,
            message="unknown verb or adverb"
        ),
    ]
    await help_test_diagnostics(client, text, expected)


@pytest.mark.asyncio
async def test_complete_verb():
    client = await create_client()
    text, positions, _ = code("""\
            # title
            ## section
            ma@{1}la
            """)
    test_uri = help_text_open(client, text)
    result = await client.text_document_completion_async(types.CompletionParams(
        text_document=types.TextDocumentIdentifier(uri=test_uri),
        position=positions[1]
    ))
    expected_verbs = [ 'verser', 'touiller', 'malaxer', 'mélanger', 'incorporer', 'étaler', 'fondre', 'cuire' ]
    assert result == types.CompletionList(
        is_incomplete=False,
        items=list(map(lambda verb: types.CompletionItem(
                    kind=types.CompletionItemKind.Operator,
                    label=verb), expected_verbs))
    )

@pytest.mark.asyncio
async def test_parse_missing_tools():
    client = await create_client()
    text, _, ranges = code("""\
            # title
            ## section
            @<1>dans@<1>
            malaxer
            """)
    expected = [
        types.Diagnostic(
            range=ranges[1],
            severity=types.DiagnosticSeverity.Error,
            message="missing tool"
        ),
    ]
    await help_test_diagnostics(client, text, expected)


@pytest.mark.asyncio
async def test_parse_unknown_tools():
    client = await create_client()
    text, _, ranges = code("""\
            # title
            ## section
            dans @<1>grenier@<1>
            malaxer
            """)
    expected = [
        types.Diagnostic(
            range=ranges[1],
            severity=types.DiagnosticSeverity.Error,
            message="unknown tool"
        ),
    ]
    await help_test_diagnostics(client, text, expected)


@pytest.mark.asyncio
async def test_complete_tool():
    client = await create_client()
    text, positions, _ = code("""\
            # title
            ## section
            dans sa@{1}
            malaxer
            """)
    test_uri = help_text_open(client, text)
    result = await client.text_document_completion_async(types.CompletionParams(
        text_document=types.TextDocumentIdentifier(uri=test_uri),
        position=positions[1]
    ))
    expected_tools = [ 'saladier', 'cuillère', 'plat', 'mixeur', 'four' ]
    assert result == types.CompletionList(
        is_incomplete=False,
        items=list(map(lambda tool: types.CompletionItem(
                    kind=types.CompletionItemKind.Class,
                    label=tool), expected_tools))
    )

@pytest.mark.asyncio
async def test_parse_need_ingredient():
    client = await create_client()
    text, _, ranges = code("""\
            # title
            ## section
            dans saladier
            @<1>verser@<1>
            """)
    expected = [
        types.Diagnostic(
            range=ranges[1],
            severity=types.DiagnosticSeverity.Error,
            message="need ingredient(s)"
        ),
    ]
    await help_test_diagnostics(client, text, expected)

@pytest.mark.asyncio
async def test_parse_unknown_ingredient():
    client = await create_client()
    text, _, ranges = code("""\
            # title
            ## section
            dans saladier
            verser @<1>lait@<1>
            """)
    expected = [
        types.Diagnostic(
            range=ranges[1],
            severity=types.DiagnosticSeverity.Error,
            message="unknown ingredient"
        ),
    ]
    await help_test_diagnostics(client, text, expected)

@pytest.mark.asyncio
async def test_parse_duplicated_ingredient():
    client = await create_client()
    text, _, ranges = code("""\
            # title
            ## ingrédients
            lait
            @<1>lait@<1>
            ## section
            dans saladier
            verser lait
            """)
    expected = [
        types.Diagnostic(
            range=ranges[1],
            severity=types.DiagnosticSeverity.Error,
            message="duplicated ingredient"
        ),
    ]
    await help_test_diagnostics(client, text, expected)

@pytest.mark.asyncio
async def test_complete_ingredient():
    client = await create_client()
    text, positions, _ = code("""\
            # title
            ## ingrédients
            chocolat
            poulet
            ## section
            mélanger @{1} 
            """)
    test_uri = help_text_open(client, text)
    result = await client.text_document_completion_async(types.CompletionParams(
        text_document=types.TextDocumentIdentifier(uri=test_uri),
        position=positions[1]
    ))
    expected_ingredients = [ 'chocolat', 'poulet' ]
    assert result == types.CompletionList(
        is_incomplete=False,
        items=list(map(lambda ingredient: types.CompletionItem(
                    kind=types.CompletionItemKind.Field,
                    label=ingredient), expected_ingredients))
    )

@pytest.mark.asyncio
async def test_rename_ingredient():
    client = await create_client()
    text, positions, ranges = code("""\
            # title
            ## ingrédients
            @<3>chocolat@<3>
            poulet
            ## section
            mélanger @<2>cho@{1}colat@<2>
            touiller chocolat
            """)
    test_uri = help_text_open(client, text)
    prepare_result = await client.text_document_prepare_rename_async(types.PrepareRenameParams(
        text_document=types.TextDocumentIdentifier(uri=test_uri),
        position=positions[1]
    ))
    assert prepare_result == ranges[2]
    rename_result = await client.text_document_rename_async(types.RenameParams(
        text_document=types.TextDocumentIdentifier(uri=test_uri),
        position=positions[1],
        new_name="poireau"
    ))
    assert sorted(rename_result.changes[test_uri], key=cmp_to_key(lambda a,b: b.range.start.line - a.range.start.line)) == [
        types.TextEdit(range=ranges[2], new_text="poireau"),
        types.TextEdit(range=ranges[3], new_text="poireau"),
    ]

