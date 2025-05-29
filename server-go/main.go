package main

import (
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
	"github.com/tliron/glsp/server"
)

const lsName = "recette language server"

var (
	handler   protocol.Handler
	documents map[string]string = make(map[string]string)
	version   string            = "0.0.1"
)

func main() {

	handler = protocol.Handler{
		Initialize:                initialize,
		Initialized:               initialized,
		TextDocumentDidOpen:       text_document_did_open,
		TextDocumentDidClose:      text_document_did_close,
		TextDocumentDidChange:     text_document_did_change,
		TextDocumentCompletion:    text_document_complete,
		TextDocumentPrepareRename: text_document_prepare_rename,
		TextDocumentRename:        text_document_rename,
		Shutdown:                  shutdown,
	}

	server := server.NewServer(&handler, lsName, false)

	server.RunStdio()
}

func initialize(context *glsp.Context, params *protocol.InitializeParams) (any, error) {
	var trueValue = true
	capabilities := handler.CreateServerCapabilities()
	capabilities.TextDocumentSync = protocol.TextDocumentSyncKindFull
	capabilities.CompletionProvider = &protocol.CompletionOptions{}
	capabilities.RenameProvider = &protocol.RenameOptions{
		PrepareProvider: &trueValue,
	}

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
	documents[params.TextDocument.URI] = params.TextDocument.Text

	go validate_and_notify(context, params.TextDocument.URI, params.TextDocument.Text)
	return nil
}

func text_document_did_change(context *glsp.Context, params *protocol.DidChangeTextDocumentParams) error {
	var text = params.ContentChanges[0].(protocol.TextDocumentContentChangeEventWhole).Text
	documents[params.TextDocument.URI] = text

	go validate_and_notify(context, params.TextDocument.URI, text)
	return nil
}

func text_document_did_close(context *glsp.Context, params *protocol.DidCloseTextDocumentParams) error {
	delete(documents, params.TextDocument.URI)
	return nil
}

func validate_and_notify(context *glsp.Context, uri protocol.URI, text string) {
	diagnostics := validate_document(text)
	context.Notify(protocol.ServerTextDocumentPublishDiagnostics, protocol.PublishDiagnosticsParams{
		URI:         uri,
		Diagnostics: diagnostics,
	})
}

func text_document_complete(context *glsp.Context, params *protocol.CompletionParams) (any, error) {
	var verbKind = protocol.CompletionItemKindFunction
	var adverbKind = protocol.CompletionItemKindOperator
	var toolKind = protocol.CompletionItemKindClass
	var ingredientKind = protocol.CompletionItemKindField
	var completions []protocol.CompletionItem

	if doc, ok := documents[params.TextDocumentPositionParams.TextDocument.URI]; ok {
		recette, _ := parse_recette(doc)

		var sentence, word_pos = find_position_in_recette(recette, params.TextDocumentPositionParams.Position)

		if word_pos == 0 {
			for i := range VERBS {
				completions = append(completions, protocol.CompletionItem{Label: VERBS[i], Kind: &verbKind})
			}
			for i := range ADVERBS {
				completions = append(completions, protocol.CompletionItem{Label: ADVERBS[i], Kind: &adverbKind})
			}
		} else if sentence != nil {
			if find_word(sentence, 0, ADVERBS) != nil {
				for i := range TOOLS {
					completions = append(completions, protocol.CompletionItem{Label: TOOLS[i], Kind: &toolKind})
				}
			} else if find_word(sentence, 0, VERBS_WITH_INGREDIENT) != nil {
				var ingredients []string
				for ingredient := range recette.Ingredients {
					ingredients = append(ingredients, ingredient)
				}
				slices.Sort(ingredients)
				for _, ingredient := range ingredients {
					completions = append(completions, protocol.CompletionItem{Label: ingredient, Kind: &ingredientKind})
				}
			}
		}
	}

	return protocol.CompletionList{
		IsIncomplete: false,
		Items:        completions,
	}, nil
}

func text_document_prepare_rename(context *glsp.Context, params *protocol.PrepareRenameParams) (any, error) {
	if doc, ok := documents[params.TextDocumentPositionParams.TextDocument.URI]; ok {
		recette, _ := parse_recette(doc)
		var sentence, word_pos = find_position_in_recette(recette, params.TextDocumentPositionParams.Position)
		if sentence != nil && word_pos%2 == 0 {
			renameWord := sentence.Words[word_pos/2]
			if ingredient, ok := recette.Ingredients[renameWord.Content]; ok {
				for _, word := range ingredient.Words {
					if word == renameWord {
						return renameWord.Range, nil
					}
				}
			}
		}
	}
	return nil, nil
}

func text_document_rename(context *glsp.Context, params *protocol.RenameParams) (*protocol.WorkspaceEdit, error) {
	if doc, ok := documents[params.TextDocumentPositionParams.TextDocument.URI]; ok {
		recette, _ := parse_recette(doc)
		var sentence, word_pos = find_position_in_recette(recette, params.TextDocumentPositionParams.Position)
		if sentence != nil && word_pos%2 == 0 {
			renameWord := sentence.Words[word_pos/2]
			if ingredient, ok := recette.Ingredients[renameWord.Content]; ok {
				var textEdits = make(map[protocol.URI][]protocol.TextEdit)
				for _, word := range ingredient.Words {
					textEdits[params.TextDocument.URI] = append(textEdits[params.TextDocument.URI], protocol.TextEdit{
						Range:   word.Range,
						NewText: params.NewName,
					})
				}
				return &protocol.WorkspaceEdit{
					Changes: textEdits,
				}, nil
			}
		}
	}
	return nil, nil
}

func find_position_in_recette(recette Recette, position protocol.Position) (*Sentence, int) {
	for i := range recette.Sections {
		for j := range recette.Sections[i].Sentences {
			var s = &recette.Sections[i].Sentences[j]
			if s.Range.Start.Line == position.Line {
				for k := range len(s.Words) {
					if position.Character < s.Words[k].Range.Start.Character {
						return s, k*2 - 1
					}
					if s.Words[k].Range.Start.Character <= position.Character && position.Character <= s.Words[k].Range.End.Character {
						return s, k * 2
					}
				}
				return s, len(s.Words)*2 - 1
			}
		}
	}
	return nil, -1
}

var VERBS = []string{
	"verser",
	"touiller",
	"malaxer",
	"mélanger",
	"incorporer",
	"étaler",
	"fondre",
	"cuire",
}

var VERBS_WITH_INGREDIENT = []string{
	"verser",
	"mélanger",
	"fondre",
}

var ADVERBS = []string{
	"avec",
	"dans",
}

var TOOLS = []string{
	"saladier",
	"cuillère",
	"plat",
	"mixeur",
	"four",
}

const INGREDIENTS_SECTION_NAME = "ingrédients"

type Ingredient struct {
	Defined bool
	Words   []Word
}

type Recette struct {
	Title       *Title
	Sections    []Section
	Ingredients map[string]*Ingredient
}

type Title struct {
	Range   protocol.Range
	Content string
}

type Section struct {
	Range     protocol.Range
	Content   string
	Sentences []Sentence
}

type Sentence struct {
	Range protocol.Range
	Words []Word
}

type Word struct {
	Range   protocol.Range
	Content string
}

func validate_document(text string) []protocol.Diagnostic {

	var recette, diagnostics = parse_recette(text)
	var ingredients []string
	for i := range recette.Sections {
		var is_ingredients = recette.Sections[i].Content == INGREDIENTS_SECTION_NAME
		for j := range recette.Sections[i].Sentences {
			var sentence = &recette.Sections[i].Sentences[j]
			if is_ingredients {
				ingredients, diagnostics = validate_ingredient(sentence, ingredients, diagnostics)
			} else {
				if find_word(sentence, 0, VERBS) != nil {
					diagnostics = validate_verb(&recette, sentence, diagnostics)
				} else if find_word(sentence, 0, ADVERBS) != nil {
					diagnostics = validate_adverb(sentence, diagnostics)
				} else {
					diagnostics = append(diagnostics, build_error(sentence.Words[0].Range, "unknown verb or adverb"))
				}
			}
		}
	}

	return diagnostics
}

func validate_ingredient(sentence *Sentence, ingredients []string, diagnostics []protocol.Diagnostic) ([]string, []protocol.Diagnostic) {
	for i := range ingredients {
		if sentence.Words[0].Content == ingredients[i] {
			diagnostics = append(diagnostics, build_error(sentence.Words[0].Range, "duplicated ingredient"))
			return ingredients, diagnostics
		}
	}
	ingredients = append(ingredients, sentence.Words[0].Content)
	return ingredients, diagnostics
}

func find_word(sentence *Sentence, index int, words []string) *string {
	for _, word := range words {
		if sentence.Words[index].Content == word {
			return &word
		}
	}
	return nil
}

func validate_verb(recette *Recette, sentence *Sentence, diagnostics []protocol.Diagnostic) []protocol.Diagnostic {
	if find_word(sentence, 0, VERBS_WITH_INGREDIENT) != nil {
		if len(sentence.Words) < 2 {
			diagnostics = append(diagnostics, build_error(sentence.Range, "need ingredient(s)"))
		} else {
			for i := 1; i < len(sentence.Words); i++ {
				if ingredient, ok := recette.Ingredients[sentence.Words[i].Content]; !ok || !ingredient.Defined {
					diagnostics = append(diagnostics, build_error(sentence.Words[i].Range, "unknown ingredient"))
				}
			}
		}
	}
	return diagnostics
}

func validate_adverb(sentence *Sentence, diagnostics []protocol.Diagnostic) []protocol.Diagnostic {
	if len(sentence.Words) < 2 {
		diagnostics = append(diagnostics, build_error(sentence.Range, "missing tool"))
	} else if find_word(sentence, 1, TOOLS) == nil {
		diagnostics = append(diagnostics, build_error(sentence.Words[1].Range, "unknown tool"))
	}
	return diagnostics
}

func parse_recette(text string) (Recette, []protocol.Diagnostic) {
	diagnostics := []protocol.Diagnostic{}

	var recette = Recette{
		Ingredients: make(map[string]*Ingredient),
	}

	for line, content := range strings.Split(text, "\n") {
		var offset = 0
		for offset < len(content) && is_space(content[offset]) {
			offset += 1
		}
		var position = protocol.Position{Line: protocol.UInteger(line), Character: protocol.UInteger(offset)}

		if offset < len(content) && content[offset] == '#' {
			var start = position
			var start_offset = offset
			for offset < len(content) && content[offset] == '#' {
				offset += 1
			}
			var count = offset - start_offset

			for offset < len(content) && is_space(content[offset]) {
				offset += 1
			}
			var start_name_offset = offset

			for offset < len(content) && content[offset] != '\n' {
				offset += 1
			}
			position.Character = protocol.UInteger(utf8.RuneCountInString(content))
			var span = protocol.Range{Start: start, End: position}
			if count == 1 {
				if recette.Title == nil {
					recette.Title = &Title{
						Range:   span,
						Content: content[start_name_offset:offset],
					}
				} else {
					diagnostics = append(diagnostics, build_error(span, "title already defined"))
				}
			} else {
				if recette.Title == nil {
					diagnostics = append(diagnostics, build_error(span, "must come after title"))
				}
				recette.Sections = append(recette.Sections, Section{
					Range:   span,
					Content: content[start_name_offset:offset],
				})
			}
		} else if offset < len(content) {
			var words []Word
			var start_of_sentence = position
			var count = offset
			for offset < len(content) {
				var start_of_word = position
				var start_of_word_offset = offset
				for offset < len(content) && !is_space(content[offset]) {
					_, l := utf8.DecodeRuneInString(content[offset:])
					offset += l
					count += 1
				}
				position.Character = protocol.UInteger(count)
				words = append(words, Word{
					Range:   protocol.Range{Start: start_of_word, End: position},
					Content: content[start_of_word_offset:offset],
				})

				for offset < len(content) && is_space(content[offset]) {
					offset += 1
					count += 1
				}
				position.Character = protocol.UInteger(count)
			}
			var span = protocol.Range{Start: start_of_sentence, End: position}

			if len(recette.Sections) == 0 {
				diagnostics = append(diagnostics, build_error(span, "must be in a section"))
			} else {
				var current_section = &recette.Sections[len(recette.Sections)-1]
				current_section.Sentences = append(current_section.Sentences, Sentence{
					Range: span,
					Words: words,
				})
			}
		}
	}

	populate_ingredients(&recette)

	return recette, diagnostics
}

func populate_ingredients(recette *Recette) {
	for i := range recette.Sections {
		is_in_ingredients := recette.Sections[i].Content == INGREDIENTS_SECTION_NAME
		for j := range recette.Sections[i].Sentences {
			var sentence = &recette.Sections[i].Sentences[j]
			if is_in_ingredients {
				var name = sentence.Words[0].Content
				ingredient, ok := recette.Ingredients[name]
				if !ok {
					ingredient = &Ingredient{}
					recette.Ingredients[name] = ingredient
				}
				ingredient.Defined = true
				ingredient.Words = append(ingredient.Words, sentence.Words[0])
			} else {
				if find_word(sentence, 0, VERBS_WITH_INGREDIENT) != nil {
					for k := 1; k < len(sentence.Words); k++ {
						var name = sentence.Words[k].Content
						ingredient, ok := recette.Ingredients[name]
						if !ok {
							ingredient = &Ingredient{Defined: false}
							recette.Ingredients[name] = ingredient
						}
						ingredient.Words = append(ingredient.Words, sentence.Words[k])
					}
				}
			}
		}
	}
}

func is_space(c byte) bool {
	return c == ' ' || c == '\t'
}

func build_error(span protocol.Range, message string) protocol.Diagnostic {
	severity := protocol.DiagnosticSeverityError
	return protocol.Diagnostic{
		Range:    span,
		Severity: &severity,
		Message:  message,
	}
}
