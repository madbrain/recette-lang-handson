
use std::collections::{HashMap};
use itertools::{Itertools, sorted};

use dashmap::DashMap;
use tower_lsp::jsonrpc::Result;
use tower_lsp::lsp_types::*;
use tower_lsp::{Client, LanguageServer, LspService, Server};

#[derive(Debug)]
struct TextDocumentItem {
    uri: Url,
    text: String,
    version: i32,
}

struct Recette {
    title: Option<Title>,
    sections: Vec<Section>,
}

struct Title {
    range: Range,
    value: String,
}

struct Section {
    range: Range,
    value: String,
    sentences: Vec<Sentence>,
}

#[derive(Clone)]
struct Word {
    range: Range,
    value: String,
}

struct Sentence {
    words: Vec<Word>,
}

struct Ingredient {
    definition: Option<Word>,
    usages: Vec<Word>,
}

impl Ingredient {
    fn from_def(word: Word) -> Ingredient {
        return Ingredient { definition: Some(word), usages: Vec::new() }
    }

    fn from_use(word: Word) -> Ingredient {
        let mut uses = Vec::new();
        uses.push(word);
        return Ingredient { definition: None, usages: uses }
    }
}

#[derive(Debug)]
struct Backend {
    client: Client,
    // have a look to https://github.com/IWANABETHATGUY/tower-lsp-boilerplate/blob/main/src/main.rs for mutability
    documents: DashMap<Url, TextDocumentItem>,
}

const VERBS: &'static [&'static str] = &[
          "verser",
          "touiller",
          "malaxer",
          "mélanger",
          "incorporer",
          "étaler",
          "fondre",
          "cuire"
];

const VERBS_WITH_INGREDIENT: &'static [&'static str] = &[
          "verser",
          "mélanger",
          "fondre"
];

const ADVERBS: &'static [&'static str] = &[
          "avec",
          "dans"
];

const TOOLS: &'static [&'static str] = &[
    "saladier",
    "cuillère",
    "plat",
    "mixeur",
    "four"
];

fn range_contains(range: &Range, position: &Position) -> bool {
    return range.start.line == position.line
        && range.start.character <= position.character
        && position.character <= range.end.character
}

enum Candidate {
    TOOL,
    VERB_ADVERB,
    INGREDIENT,
    UNKNOWN_INGREDIENT,
}

#[tower_lsp::async_trait]
impl LanguageServer for Backend {
    async fn initialize(&self, _: InitializeParams) -> Result<InitializeResult> {
        Ok(InitializeResult {
            capabilities: ServerCapabilities {
                text_document_sync: Some(TextDocumentSyncCapability::Kind(
                    TextDocumentSyncKind::FULL,
                )),
                completion_provider: Some(CompletionOptions {
                    ..CompletionOptions::default()
                }),
                rename_provider: Some(OneOf::Right(RenameOptions {
                    prepare_provider: Some(true),
                    work_done_progress_options: WorkDoneProgressOptions { work_done_progress: None }
                })),
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

    async fn completion(&self, mut params: CompletionParams) -> Result<Option<CompletionResponse>> {
        let mut diagnostics: Vec<Diagnostic> = Vec::new();
        
        let document = self.documents.get(&params.text_document_position.text_document.uri).unwrap();
        
        let recette = self.parse(&document.text, &mut diagnostics);
        let ingredients = self.validate(&recette, &mut diagnostics);

        let target_pos = &params.text_document_position.position;
        let mut p = -1;
        let mut line = 0;
        let mut is_ing = false;
        let mut is_adv = false;
        let mut need_ing = false;
        
        for section in &recette.sections {
            line = section.range.start.line;
            if line > target_pos.line {
                break
            }
            is_ing = self.is_section_ingredients(section);
            for sentence in &section.sentences {
                p = -1;
                for word in &sentence.words {
                    line = word.range.start.line;
                    if line != target_pos.line {
                        break
                    }
                    if target_pos.character < word.range.start.character {
                        break; 
                    }
                    p += 1;
                    if range_contains(&word.range, target_pos) {
                        break;
                    }
                    p += 1;
                }
                if p > 0 {
                    is_adv = self.is_adverb(&sentence.words[0]);
                    need_ing = self.is_verb_with_ingredient(&sentence.words[0]);
                } else {
                    is_adv = false;
                    need_ing = false;
                }
                if line >= target_pos.line {
                    break
                }
            }
            if line >= target_pos.line {
                break
            }
        }

        let candidate = if is_ing {
            Candidate::UNKNOWN_INGREDIENT
        } else if p <= 0 {
            Candidate::VERB_ADVERB
        } else if p > 0 && is_adv {
            Candidate::TOOL
        } else if p > 0 && need_ing {
            Candidate::INGREDIENT
        } else {
            Candidate::VERB_ADVERB
        };

        let mut items: Vec<CompletionItem> = Vec::new();
        
        match candidate {
            Candidate::VERB_ADVERB => {
                items.append(&mut VERBS.iter().map(|verb| CompletionItem {
                        kind: Some(CompletionItemKind::FUNCTION),
                        label: verb.to_string(),
                        ..CompletionItem::default()
                    }).collect());
                items.append(&mut ADVERBS.iter().map(|adverb| CompletionItem {
                        kind: Some(CompletionItemKind::OPERATOR),
                        label: adverb.to_string(),
                        ..CompletionItem::default()
                    }).collect());
                }
            Candidate::TOOL => {
                items.append(&mut TOOLS.iter().map(|adverb| CompletionItem {
                    kind: Some(CompletionItemKind::CLASS),
                    label: adverb.to_string(),
                    ..CompletionItem::default()
                }).collect());
            }
            Candidate::INGREDIENT => {
                let defined_ingredients = ingredients.iter()
                        .filter(|(_, ing)| ing.definition.is_some())
                        .map(|(name,_)|name)
                        .sorted();
                items.append(&mut defined_ingredients.map(|name| CompletionItem {
                    kind: Some(CompletionItemKind::FIELD),
                    label: name.clone(),
                    ..CompletionItem::default()
                }).collect());
            }
            Candidate::UNKNOWN_INGREDIENT => {
                let unknown_ingredients = ingredients.iter()
                        .filter(|(_, ing)| ing.definition.is_none())
                        .map(|(name,_)|name)
                        .sorted();
                items.append(&mut unknown_ingredients.map(|name| CompletionItem {
                    kind: Some(CompletionItemKind::FIELD),
                    label: name.clone(),
                    ..CompletionItem::default()
                }).collect());
            }
        }
        Ok(Some(CompletionResponse::List(CompletionList {
            is_incomplete: false,
            items: items
        })))
    }



    async fn prepare_rename(&self, params: TextDocumentPositionParams) -> Result<Option<PrepareRenameResponse>> {
        let mut diagnostics: Vec<Diagnostic> = Vec::new();
        
        let document = self.documents.get(&params.text_document.uri).unwrap();
        
        let recette = self.parse(&document.text, &mut diagnostics);
        let ingredients = self.validate(&recette, &mut diagnostics);

        let target_pos = &params.position;

        let selected_ing = self.find_ingredient(&ingredients, target_pos);
        
        return Ok(selected_ing.map(|(_, word)| PrepareRenameResponse::Range(word.range)))
    }

    async fn rename(&self, params: RenameParams) -> Result<Option<WorkspaceEdit>> {
        let mut diagnostics: Vec<Diagnostic> = Vec::new();
        
        let document = self.documents.get(&params.text_document_position.text_document.uri).unwrap();
        
        let recette = self.parse(&document.text, &mut diagnostics);
        let ingredients = self.validate(&recette, &mut diagnostics);

        let target_pos = &params.text_document_position.position;

        let selected_ing = self.find_ingredient(&ingredients, target_pos);

        let workspace_edit = selected_ing.map(|(ingredient, _)| {
            let mut edits = Vec::new();
            if let Some(def) = &ingredient.definition {
                edits.push(TextEdit::new(def.range, params.new_name.clone()));
            }
            for usage in &ingredient.usages {
                edits.push(TextEdit::new(usage.range, params.new_name.clone()));
            }
            let mut changes = HashMap::new();
            changes.insert(params.text_document_position.text_document.uri.clone(), edits);
            WorkspaceEdit {
                changes: Some(changes),
                ..WorkspaceEdit::default()
            }
        });

        return Ok(workspace_edit)
    }

    async fn shutdown(&self) -> Result<()> {
        Ok(())
    }
}

impl Backend {

    fn new(client: Client) -> Backend {
        return Backend { client, documents: DashMap::new() }
    }

    fn parse(self: &Self, text: &String, diagnostics: &mut Vec<Diagnostic>) -> Recette {
        let mut recette = Recette { title: None, sections: Vec::new() };
        text
            .split("\n")
            .enumerate()
            .for_each(|(line, content)| {
                let mut chars = content.char_indices();
                let mut offset: usize;
                let mut char_offset: u32 = 0;
                let mut c: char;
                loop {
                    let next = chars.next();
                    if next.is_none() {
                        return
                    }
                    (offset, c) = next.unwrap();
                    if !c.is_whitespace() {
                        break
                    }
                    char_offset += 1;
                }
                let start_char_offset = char_offset;
                let start_offset = offset;
                if c == '#' {
                    let mut sharp_count = 1;
                    loop {
                        let next = chars.next();
                        if next.is_none() {
                            break
                        }
                        (offset, c) = next.unwrap();
                        if c != '#' {
                            break
                        }
                        char_offset += 1;
                        sharp_count += 1
                    }   
                    
                    if sharp_count == 1 {
                        if recette.title.is_some() {
                            diagnostics.push(Diagnostic {
                                range: Range {
                                    start: Position {
                                        line: line as u32,
                                        character: start_char_offset,
                                    },
                                    end: Position {
                                        line: line as u32,
                                        character: content.len() as u32,
                                    },
                                },
                                message: "title already defined".to_string(),
                                severity: Some(DiagnosticSeverity::ERROR),
                                ..Diagnostic::default()
                            });
                        } else {
                            recette.title = Some(Title { range: Range {
                                    start: Position {
                                        line: line as u32,
                                        character: start_char_offset,
                                    },
                                    end: Position {
                                        line: line as u32,
                                        character: content.len() as u32,
                                    },
                                }, value: content[(start_offset+1) as usize..content.len()].to_string() })
                        }
                    } else {
                        if recette.title.is_none() {
                            diagnostics.push(Diagnostic {
                                range: Range {
                                    start: Position {
                                        line: line as u32,
                                        character: start_char_offset,
                                    },
                                    end: Position {
                                        line: line as u32,
                                        character: content.len() as u32,
                                    },
                                },
                                message: "must come after title".to_string(),
                                severity: Some(DiagnosticSeverity::ERROR),
                                ..Diagnostic::default()
                            });
                        } else {
                            recette.sections.push(Section { range: Range {
                                    start: Position {
                                        line: line as u32,
                                        character: start_char_offset,
                                    },
                                    end: Position {
                                        line: line as u32,
                                        character: content.len() as u32,
                                    },
                                }, value: content[offset as usize..content.len()].trim().to_string(), sentences: Vec::new() });
                        }
                    }
                    
                } else {
                    // TODO could use last_mut as test
                    if recette.sections.is_empty() {
                        diagnostics.push(Diagnostic {
                                range: Range {
                                    start: Position {
                                        line: line as u32,
                                        character: start_char_offset as u32,
                                    },
                                    end: Position {
                                        line: line as u32,
                                        character: content.len() as u32,
                                    },
                                },
                                message: "must be in a section".to_string(),
                                severity: Some(DiagnosticSeverity::ERROR),
                                ..Diagnostic::default()
                            });
                    } else {
                        let mut words: Vec<Word> = Vec::new();
                        let mut word_char_start = char_offset;
                        let mut word_start = offset;
                        let mut is_in_word = true;
                        loop {
                            let next = chars.next();
                            if next.is_none() {
                                if is_in_word {
                                    words.push(Word {
                                        range: Range {
                                            start: Position {
                                                line: line as u32,
                                                character: word_char_start,
                                            },
                                            end: Position {
                                                line: line as u32,
                                                character: char_offset + 1,
                                            }
                                        },
                                        value: content[word_start..offset+1].to_string()
                                    });
                                }
                                break
                            }
                            char_offset += 1;
                            (offset, c) = next.unwrap();
                            if is_in_word && c.is_whitespace() {
                                words.push(Word {
                                    range: Range {
                                        start: Position {
                                            line: line as u32,
                                            character: word_char_start,
                                        },
                                        end: Position {
                                            line: line as u32,
                                            character: char_offset,
                                        }
                                    },
                                    value: content[word_start..offset].to_string()
                                });
                                is_in_word = false;
                            } else if !is_in_word && !c.is_whitespace() {
                                is_in_word = true;
                                word_start = offset;
                                word_char_start = char_offset;
                            }
                        }
                        recette.sections.last_mut().unwrap().sentences.push(Sentence { words: words });
                    }
                }
            });
        return recette
    }

    fn find_ingredient<'a>(&self, ingredients: &'a HashMap<String, Ingredient>, target_pos: &Position) -> Option<(&'a Ingredient, &'a Word)> {
        let mut selected_ing = None;
        for (_, ing) in ingredients {
            if let Some(def) = &ing.definition {
                if range_contains(&def.range, target_pos) {
                    selected_ing = Some((ing, def));
                    break;
                }
            }
            if let Some(u) = ing.usages.iter().find(|u| range_contains(&u.range, target_pos)) {
                selected_ing = Some((ing, u));
            }
        }
        return selected_ing;
    }

    fn validate_instruction_section(&self, section: &Section, ingredients: &mut HashMap<String, Ingredient>, diagnostics: &mut Vec<Diagnostic>) {
        section.sentences.iter().for_each(|sentence| {
            if sentence.words.len() > 0 {
                let first_word = &sentence.words[0];
                if self.is_adverb(&first_word) {
                    if sentence.words.len() < 2 {
                        diagnostics.push(Diagnostic {
                            range: first_word.range,
                            message: "missing tool".to_string(),
                            severity: Some(DiagnosticSeverity::ERROR),
                            ..Diagnostic::default()
                        });
                    } else {
                        let tool = &sentence.words[1];
                        if !self.is_tool(tool) {
                            diagnostics.push(Diagnostic {
                                range: tool.range,
                                message: "unknown tool".to_string(),
                                severity: Some(DiagnosticSeverity::ERROR),
                                ..Diagnostic::default()
                            });
                        }
                    }
                } else if self.is_verb(&first_word) {
                    if self.is_verb_with_ingredient(&first_word) {
                        if sentence.words.len() < 2 {
                            diagnostics.push(Diagnostic {
                                range: first_word.range,
                                message: "need ingredient(s)".to_string(),
                                severity: Some(DiagnosticSeverity::ERROR),
                                ..Diagnostic::default()
                            });
                        } else {
                            for i in 1..sentence.words.len() {
                                let ingredient_use = &sentence.words[i];
                                match ingredients.get_mut(&ingredient_use.value) {
                                    Some(ingredient) => {
                                        ingredient.usages.push(ingredient_use.clone());
                                        
                                    }
                                    None => {
                                        ingredients.insert(ingredient_use.value.clone(), Ingredient::from_use(ingredient_use.clone()));
                                        diagnostics.push(Diagnostic {
                                            range: ingredient_use.range,
                                            message: "unknown ingredient".to_string(),
                                            severity: Some(DiagnosticSeverity::ERROR),
                                            ..Diagnostic::default()
                                        });
                                    }
                                }
                            }
                        }
                    }
                } else {
                    diagnostics.push(Diagnostic {
                        range: first_word.range,
                        message: "unknown verb or adverb".to_string(),
                        severity: Some(DiagnosticSeverity::ERROR),
                        ..Diagnostic::default()
                    });
                }
            }  
        });
    }

    fn validate(&self, recette: &Recette, diagnostics: &mut Vec<Diagnostic>) -> HashMap<String, Ingredient> {
        let mut ingredients: HashMap<String, Ingredient> = HashMap::new();
        recette.sections.iter().for_each(|section| {
            if self.is_section_ingredients(section) {
                section.sentences.iter().for_each(|sentence| {
                    if sentence.words.len() > 0 {
                        let word = &sentence.words[0];
                        match ingredients.get_mut(&word.value) {
                            Some(ingredient) => {
                                if ingredient.definition.is_some() {
                                    diagnostics.push(Diagnostic {
                                        range: word.range,
                                        message: "duplicated ingredient".to_string(),
                                        severity: Some(DiagnosticSeverity::ERROR),
                                        ..Diagnostic::default()
                                    });
                                } else {
                                    ingredient.definition = Some(word.clone())
                                }
                            }
                            None => {
                                ingredients.insert(word.value.clone(), Ingredient::from_def(word.clone()));
                            }
                        }
                    }
                })
            } else {
                self.validate_instruction_section(section, &mut ingredients, diagnostics);
            }
        });
        return ingredients
    }

    async fn on_change(&self, item: TextDocumentItem) {
        let mut diagnostics: Vec<Diagnostic> = Vec::new();
        let recette = self.parse(&item.text, &mut diagnostics);

        let version = item.version;
        let uri = item.uri.clone();
        self.documents.insert(item.uri.clone(), item);

        self.validate(&recette, &mut diagnostics);
         
        self.client
            .publish_diagnostics(uri, diagnostics, Some(version))
            .await;
    }

    fn is_section_ingredients(&self, section: &Section) -> bool {
        return section.value == "ingrédients"
    }

    fn is_verb(self: &Self, word: &Word) -> bool {
        return VERBS.iter().find(|verb| word.value == verb.to_string()).is_some();
    }

    fn is_verb_with_ingredient(self: &Self, word: &Word) -> bool {
        return VERBS_WITH_INGREDIENT.iter().find(|verb| word.value == verb.to_string()).is_some();
    }

    fn is_adverb(self: &Self, word: &Word) -> bool {
        return ADVERBS.iter().find(|adverb| word.value == adverb.to_string()).is_some();
    }

     fn is_tool(self: &Self, word: &Word) -> bool {
        return TOOLS.iter().find(|tool| word.value == tool.to_string()).is_some();
    }
}

#[tokio::main]
async fn main() {
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();

    let (service, socket) = LspService::new(|client| Backend::new(client));
    Server::new(stdin, stdout, socket).serve(service).await;
}
