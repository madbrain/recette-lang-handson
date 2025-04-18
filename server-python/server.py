
import logging
import re
from pygls.cli import start_server
from pygls.lsp.server import LanguageServer
from pygls.workspace import TextDocument
from lsprotocol import types
from dataclasses import dataclass, field
from collections import defaultdict

@dataclass
class Span:
    start: int
    end: int

    def __contains__(self, offset: int):
        return self.start <= offset and offset < self.end


def mergeRange(ranges):
    start = min(map(lambda x: x.start, ranges))
    end = max(map(lambda x: x.end, ranges))
    return Span(start, end)

class ErrorReporter:
    def __init__(self, doc: TextDocument):
        self.diagnostics = []
        self.line_offsets = [ 0 ]
        for i, c in enumerate(doc.source):
            if c == '\n':
                self.line_offsets.append(i+1)

    def to_position(self, offset: int):
        line = 0
        character = offset
        for i in range(len(self.line_offsets)):
            if i+1 == len(self.line_offsets) or offset < self.line_offsets[i+1]:
                character -= self.line_offsets[line]
                break
            line += 1
        return types.Position(line=line, character=character)
    
    def to_offset(self, position: types.Position):
        if position.line >= len(self.line_offsets):
            return 0
        return self.line_offsets[position.line] + position.character
    
    def addError(self, range: Span, message: str):
         self.diagnostics.append(
                types.Diagnostic(
                    message=message,
                    severity=types.DiagnosticSeverity.Error,
                    range=types.Range(
                        start=self.to_position(range.start),
                        end=self.to_position(range.end),
                    ),
                )
         )

##################

@dataclass    
class Word:
    range: Span
    value: str

@dataclass    
class Sentence:
    range: Span
    words: list[Word]

@dataclass    
class Title:
    range: Span

@dataclass    
class SectionHead:
    range: Span
    value: str
    statements: list[Sentence] = field(default_factory=lambda: [])

@dataclass
class Recette:
    title: Title
    sections: list[SectionHead]


class RecetteParser:
    def __init__(self, reporter: ErrorReporter, doc: str):
        self.reporter = reporter
        self.index = 0
        self.content = doc

    def parseLine(self):
        words = []
        while self.index < len(self.content):
            start = self.index
            c = self.content[self.index]
            self.index += 1
            if self.is_space(c):
                continue
            if c == '\n':
                break
            if c == '#':
                is_section = self.content[self.index] == '#'
                self.skip_to_eol()
                if is_section:
                    return SectionHead(Span(start, self.index), self.content[start+2:self.index].strip())
                return Title(Span(start, self.index))
            word = c
            while self.index < len(self.content):
                c = self.content[self.index]
                if self.is_space(c) or c == '\n':
                    break
                self.index += 1
                word += c
            words.append(Word(Span(start, self.index), word))
        if len(words) > 0:
            return Sentence(mergeRange(list(map(lambda w: w.range, words))), words)
        return None
    
    def skip_to_eol(self):
        while self.index < len(self.content):
            if self.content[self.index] == '\n':
                return
            self.index += 1

    def is_space(self, c):
        return c in [ ' ', '\t' ]

    def parse(self):
        title = None
        sections = []
        currentSection = None
        while self.index < len(self.content):
            statement = self.parseLine()
            if isinstance(statement, Title):
                if title:
                    self.reporter.addError(statement.range, "title already defined")
                else:
                    title = statement
            elif isinstance(statement, SectionHead):
                if title is None:
                    self.reporter.addError(statement.range, "must come after title")
                currentSection = statement
                sections.append(currentSection)
            elif statement:
                if currentSection:
                    currentSection.statements.append(statement)
                else:
                    self.reporter.addError(statement.range, "must be in a section")
        return Recette(title, sections)

ADVERB = [
    'dans',
    'avec',
]

TOOLS = [
    'saladier',
    'cuillère',
    'plat',
    'mixeur',
    'four',
]

VERBS = {
    'verser': True,
    'touiller': False,
    'malaxer': False,
    'mélanger': True,
    'incorporer': False,
    'étaler': False,
    'fondre': True,
    'cuire': False
}

IN_VERB = 1
IN_ARG = 2

class RecetteLanguageServer(LanguageServer):

    def __init__(self):
        super().__init__("recette-lang-server", "v0.1")

    def parse(self, doc: TextDocument, reporter: ErrorReporter) -> Recette:
        recette = RecetteParser(reporter, doc.source).parse()
        self.validate(recette, reporter)
        return recette
    
    def locate_cursor(self, recette: Recette, offset: int, reporter: ErrorReporter):
        for section in recette.sections:
            for sentence in section.statements:
                if offset in sentence.words[0].range:
                    return (IN_VERB, sentence) 
                if offset in sentence.range or reporter.to_position(offset).line == reporter.to_position(sentence.range.end).line:
                    return (IN_ARG, sentence)
        return (IN_VERB, None)
    
    def complete(self, doc: TextDocument, position: types.Position):
        reporter = ErrorReporter(doc)
        recette = RecetteParser(reporter, doc.source).parse()
        offset = reporter.to_offset(position)
        mode, sentence = self.locate_cursor(recette, offset, reporter)
        if mode == IN_VERB:
            return list(map(lambda verb: types.CompletionItem(kind=types.CompletionItemKind.Operator, label=verb), VERBS.keys()))
        if mode == IN_ARG:
            verb = sentence.words[0].value
            if verb in ADVERB:
                return list(map(lambda tool: types.CompletionItem(kind=types.CompletionItemKind.Class, label=tool), TOOLS))
            if verb in VERBS.keys() and VERBS[verb]:
                ing_section = next(section for section in recette.sections if section.value == "ingrédients")
                if ing_section:
                    return list(map(lambda ingredient: types.CompletionItem(kind=types.CompletionItemKind.Field, label=ingredient.words[0].value), ing_section.statements))
        return []
    
    def validate(self, recette: Recette, reporter: ErrorReporter):
        ingredients = {
            'appareil': True
        }
        for section in recette.sections:
            if section.value == "ingrédients":
                for sentence in section.statements:
                    name = sentence.words[0].value.lower()
                    if name in ingredients.keys():
                        reporter.addError(sentence.words[0].range, "duplicated ingredient")
                    else:
                        ingredients[name] = sentence
            else:
                for sentence in section.statements:
                    word = sentence.words[0].value.lower();
                    if word in ADVERB:
                        if len(sentence.words) < 2:
                            reporter.addError(sentence.words[0].range, "missing tool")
                        elif sentence.words[1].value.lower() not in TOOLS:
                            reporter.addError(sentence.words[1].range, "unknown tool")
                    elif word in VERBS.keys():
                        if VERBS[word]:
                            if len(sentence.words) < 2:
                                reporter.addError(sentence.words[0].range, "need ingredient(s)")
                            else:
                                for ingredient in sentence.words[1:]:
                                    if ingredient.value not in ingredients.keys():
                                        reporter.addError(ingredient.range, "unknown ingredient")
                    else:
                        reporter.addError(sentence.words[0].range, "unknown verb or adverb")

    def prepare_rename(self, doc: TextDocument, position: types.Position) -> types.Range | None:
        reporter = ErrorReporter(doc)
        recette = RecetteParser(reporter, doc.source).parse()
        ingredients = self.make_ingredients(recette)
        offset = reporter.to_offset(position)
        word = self.locate_ingredient(ingredients, offset)
        if word:
            r = types.Range(start=reporter.to_position(word.range.start), end=reporter.to_position(word.range.end))
            logging.info(str(r))
            return r
        return None
    
    def rename(self, doc: TextDocument, position: types.Position, new_text: str) -> types.WorkspaceEdit | None:
        reporter = ErrorReporter(doc)
        recette = RecetteParser(reporter, doc.source).parse()
        ingredients = self.make_ingredients(recette)
        target = doc.word_at_position(position)
        if target in ingredients:
            edits = [ types.TextEdit(types.Range(start=reporter.to_position(word.range.start), end=reporter.to_position(word.range.end)), new_text) for word in ingredients[target] ]
            return types.WorkspaceEdit({
                doc.uri: edits
            })
        return None
    
    # TODO merge with validate
    def make_ingredients(self, recette: Recette):
        ingredients = defaultdict(lambda: [])
        for section in recette.sections:
            if section.value == "ingrédients":
                for sentence in section.statements:
                    ing = sentence.words[0]
                    ingredients[ing.value].append(ing) # TODO dissociate definition from uses
            else:
                for sentence in section.statements:        
                    name = sentence.words[0].value 
                    if name in VERBS.keys() and VERBS[name]:
                        for ing in sentence.words[1:]:
                            ingredients[ing.value].append(ing)
        return ingredients
    
    def locate_ingredient(self, ingredients, offset):
        for k, words in ingredients.items():
            for word in words:
                if offset in word.range:
                    return word
        return None


server = RecetteLanguageServer()


@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: RecetteLanguageServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is opened"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    reporter = ErrorReporter(doc)
    ast = ls.parse(doc, reporter)
    ls.text_document_publish_diagnostics(
        types.PublishDiagnosticsParams(
            uri=doc.uri,
            version=doc.version,
            diagnostics=reporter.diagnostics,
        )
    )


@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: RecetteLanguageServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is changed"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    reporter = ErrorReporter(doc)
    ast = ls.parse(doc, reporter)
    ls.text_document_publish_diagnostics(
        types.PublishDiagnosticsParams(
            uri=doc.uri,
            version=doc.version,
            diagnostics=reporter.diagnostics,
        )
    )

@server.feature(types.TEXT_DOCUMENT_COMPLETION)
def do_completion(ls: RecetteLanguageServer, params: types.CompletionParams | None = None) -> types.CompletionList:
    doc = ls.workspace.get_text_document(params.text_document.uri)
    items = ls.complete(doc, params.position)
    return types.CompletionList(is_incomplete=False, items=items)

@server.feature(types.TEXT_DOCUMENT_PREPARE_RENAME)
def do_completion(ls: RecetteLanguageServer, params: types.PrepareRenameParams) -> types.Range | None:
    doc = ls.workspace.get_text_document(params.text_document.uri)
    return ls.prepare_rename(doc, params.position)

@server.feature(types.TEXT_DOCUMENT_RENAME)
def do_completion(ls: RecetteLanguageServer, params: types.RenameParams) -> types.WorkspaceEdit | None:
    doc = ls.workspace.get_text_document(params.text_document.uri)
    return ls.rename(doc, params.position, params.new_name)

logging.basicConfig(filename='pygls.log', filemode='w', level=logging.INFO)

if __name__ == "__main__":
    start_server(server)
