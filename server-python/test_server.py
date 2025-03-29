
import textwrap
from server import ErrorReporter, RecetteLanguageServer
from lsprotocol import types

class MockDoc:

    def __init__(self, content: str):
        self.source = content

def test_parse_multiple_title():
    lang = RecetteLanguageServer()
    doc = MockDoc(textwrap.dedent("""\
            # hello
            # tutu
            """))
    reporter = ErrorReporter(doc)
    result = lang.parse(doc, reporter)
    assert reporter.diagnostics == [
        types.Diagnostic(
            types.Range(
                types.Position(line=1, character=0),
                types.Position(line=1, character=6)
            ),
            severity=types.DiagnosticSeverity.Error,
            message="title already defined"
        ),
    ]

def test_parse_dangling_section():
    lang = RecetteLanguageServer()
    doc = MockDoc(textwrap.dedent("""\
            ## hello
            """))
    reporter = ErrorReporter(doc)
    result = lang.parse(doc, reporter)
    assert reporter.diagnostics == [
        types.Diagnostic(
            types.Range(
                types.Position(line=0, character=0),
                types.Position(line=0, character=8)
            ),
            severity=types.DiagnosticSeverity.Error,
            message="must come after title"
        ),
    ]

def test_parse_dangling_statement():
    lang = RecetteLanguageServer()
    doc = MockDoc(textwrap.dedent("""\
            hello
            # title
            """))
    reporter = ErrorReporter(doc)
    result = lang.parse(doc, reporter)
    assert reporter.diagnostics == [
        types.Diagnostic(
            types.Range(
                types.Position(line=0, character=0),
                types.Position(line=0, character=5)
            ),
            severity=types.DiagnosticSeverity.Error,
            message="must be in a section"
        ),
    ]

def test_parse_unknown_verb():
    lang = RecetteLanguageServer()
    doc = MockDoc(textwrap.dedent("""\
            # title
            ## section
            hello
            """))
    reporter = ErrorReporter(doc)
    result = lang.parse(doc, reporter)
    assert reporter.diagnostics == [
        types.Diagnostic(
            types.Range(
                types.Position(line=2, character=0),
                types.Position(line=2, character=5)
            ),
            severity=types.DiagnosticSeverity.Error,
            message="unknown verb or adverb"
        ),
    ]

### -> complétion

def test_parse_missing_tools():
    lang = RecetteLanguageServer()
    doc = MockDoc(textwrap.dedent("""\
            # title
            ## section
            dans
            malaxer
            """))
    reporter = ErrorReporter(doc)
    result = lang.parse(doc, reporter)
    assert reporter.diagnostics == [
        types.Diagnostic(
            types.Range(
                types.Position(line=2, character=0),
                types.Position(line=2, character=4)
            ),
            severity=types.DiagnosticSeverity.Error,
            message="missing tool"
        ),
    ]

def test_parse_unknown_tools():
    lang = RecetteLanguageServer()
    doc = MockDoc(textwrap.dedent("""\
            # title
            ## section
            dans grenier
            malaxer
            """))
    reporter = ErrorReporter(doc)
    result = lang.parse(doc, reporter)
    assert reporter.diagnostics == [
        types.Diagnostic(
            types.Range(
                types.Position(line=2, character=5),
                types.Position(line=2, character=12)
            ),
            severity=types.DiagnosticSeverity.Error,
            message="unknown tool"
        ),
    ]

def test_parse_need_ingredient():
    lang = RecetteLanguageServer()
    doc = MockDoc(textwrap.dedent("""\
            # title
            ## section
            dans saladier
            verser
            """))
    reporter = ErrorReporter(doc)
    result = lang.parse(doc, reporter)
    assert reporter.diagnostics == [
        types.Diagnostic(
            types.Range(
                types.Position(line=3, character=0),
                types.Position(line=3, character=6)
            ),
            severity=types.DiagnosticSeverity.Error,
            message="need ingredient(s)"
        ),
    ]

def test_parse_unknown_ingredient():
    lang = RecetteLanguageServer()
    doc = MockDoc(textwrap.dedent("""\
            # title
            ## section
            dans saladier
            verser lait
            """))
    reporter = ErrorReporter(doc)
    result = lang.parse(doc, reporter)
    assert reporter.diagnostics == [
        types.Diagnostic(
            types.Range(
                types.Position(line=3, character=7),
                types.Position(line=3, character=11)
            ),
            severity=types.DiagnosticSeverity.Error,
            message="unknown ingredient"
        ),
    ]

def test_parse_duplicated_ingredient():
    lang = RecetteLanguageServer()
    doc = MockDoc(textwrap.dedent("""\
            # title
            ## ingrédients
            lait
            lait
            ## section
            dans saladier
            verser lait
            """))
    reporter = ErrorReporter(doc)
    result = lang.parse(doc, reporter)
    assert reporter.diagnostics == [
        types.Diagnostic(
            types.Range(
                types.Position(line=3, character=0),
                types.Position(line=3, character=4)
            ),
            severity=types.DiagnosticSeverity.Error,
            message="duplicated ingredient"
        ),
    ]