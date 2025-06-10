import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  CompletionItemKind,
  CompletionItem,
  CodeActionKind,
} from "vscode-languageserver/node";

import {
  Position,
  Range,
  TextDocument,
  TextEdit,
} from "vscode-languageserver-textdocument";

const connection = createConnection(ProposedFeatures.all);

const documents = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {},
      renameProvider: { prepareProvider: true },
    },
  };
  return result;
});

documents.onDidChangeContent((change) => {
  const diagnostics: Diagnostic[] = [];

  const ast = parse(change.document.getText(), diagnostics);
  validate(ast, diagnostics);
  connection.sendDiagnostics({
    uri: change.document.uri,
    version: change.document.version,
    diagnostics,
  });
});

connection.onCompletion((params) => {
  const items: CompletionItem[] = [];
  const doc = documents.get(params.textDocument.uri);
  if (doc) {
    const recette = parse(doc.getText(), []);
    const info = findInRecette(recette, params.position);
    if (info) {
      if (info.section.name !== INGREDIENTS_SECTION_NAME) {
        if (info.sentence === undefined || info.index == 0) {
          items.push(
            ...[
              ...VERBS.map((name) => ({
                kind: CompletionItemKind.Function,
                label: name,
              })),
              ...ADVERBS.map((name) => ({
                kind: CompletionItemKind.Operator,
                label: name,
              })),
            ]
          );
        } else if (info.index > 0) {
          const name = info.sentence.words[0].value;
          if (VERBS.includes(name)) {
            items.push(
              ...Object.keys(recette.ingredients).map((name) => ({
                kind: CompletionItemKind.Field,
                label: name,
              }))
            );
          } else {
            items.push(
              ...TOOLS.map((name) => ({
                kind: CompletionItemKind.Class,
                label: name,
              }))
            );
          }
        }
      } else {
        items.push(
          ...Object.keys(recette.ingredients)
            .filter((name) => !recette.ingredients[name].definition)
            .map((name) => ({
              kind: CompletionItemKind.Field,
              label: name,
            }))
        );
      }
    }
  }
  return {
    isIncomplete: false,
    items,
  };
});

connection.onPrepareRename((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (doc) {
    const recette = parse(doc.getText(), []);
    const info = findInRecette(recette, params.position);
    if (info && info.sentence) {
      const name = info.sentence.words[0].value;
      if (VERBS.includes(name) && info.index > 0) {
        return info.sentence.words[info.index].range;
      }
    }
  }
  return null;
});

connection.onRenameRequest((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    return null;
  }
  const recette = parse(doc.getText(), []);
  const info = findInRecette(recette, params.position);
  if (!info || !info.sentence) {
    return null;
  }
  const edits: TextEdit[] = [];
  const ingredient = recette.ingredients[info.sentence.words[info.index].value];
  if (ingredient) {
    ingredient.usages.forEach((word) => {
      edits.push({
        range: word.range,
        newText: params.newName,
      });
    });
    if (ingredient.definition) {
      edits.push({
        range: ingredient.definition.range,
        newText: params.newName,
      });
    }
  }
  return {
    changes: {
      [params.textDocument.uri]: edits,
    },
  };
});

function findInRecette(recette: Recette, position: Position) {
  let lastSection = null;
  for (let section of recette.sections) {
    if (lastSection && position.line < section.range.start.line) {
      return { section: lastSection };
    }
    for (let sentence of section.sentences) {
      if (contains(sentence.range, position)) {
        let index = 0;
        while (index < sentence.words.length) {
          const word = sentence.words[index];
          if (contains(word.range, position)) {
            return { section, sentence, index };
          }
          ++index;
        }
        return { section, sentence, index };
      }
    }
    lastSection = section;
  }
  if (lastSection) {
    return { section: lastSection };
  }
  return null;
}

function contains(range: Range, position: Position) {
  return (
    range.start.line == position.line &&
    range.start.character <= position.character &&
    position.character <= range.end.character
  );
}

const INGREDIENTS_SECTION_NAME = "ingrédients";

const VERBS = [
  "verser",
  "touiller",
  "malaxer",
  "mélanger",
  "incorporer",
  "étaler",
  "fondre",
  "cuire",
];

const VERBS_WITH_INGREDIENTS = ["verser", "mélanger", "fondre"];

const ADVERBS = ["avec", "dans"];

const TOOLS: string[] = ["saladier", "cuillère", "plat", "mixeur", "four"];

interface Recette {
  title?: Title;
  sections: Section[];

  ingredients: { [name: string]: Ingredient };
}

interface Ingredient {
  definition?: Word;
  usages: Word[];
}

interface Title {
  range: Range;
  name: string;
}

interface Section {
  range: Range;
  name: string;
  sentences: Sentence[];
}

interface Sentence {
  range: Range;
  words: Word[];
}

interface Word {
  range: Range;
  value: string;
}

function parse(text: string, diagnostics: Diagnostic[]): Recette {
  let title: Title | undefined = undefined;
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  text.split("\n").forEach((content, line) => {
    let column = 0;

    // skip spaces
    while (column < content.length && isSpace(content[column])) {
      ++column;
    }

    let startColumn = column;
    if (content[column] == "#") {
      let sectionCount = 0;
      while (column < content.length && content[column] == "#") {
        ++sectionCount;
        ++column;
      }
      // TODO get name and trim
      if (sectionCount == 1) {
        const newTitle: Title = {
          range: {
            start: { line, character: startColumn },
            end: { line, character: content.length },
          },
          name: content.substring(column).trim(),
        };
        if (title) {
          diagnostics.push({
            range: newTitle.range,
            message: "title already defined",
            severity: DiagnosticSeverity.Error,
          });
        } else {
          title = newTitle;
        }
      } else {
        const newSection: Section = {
          range: {
            start: { line, character: startColumn },
            end: { line, character: content.length },
          },
          name: content.substring(column).trim(),
          sentences: [],
        };
        if (title == null) {
          diagnostics.push({
            range: newSection.range,
            message: "must come after title",
            severity: DiagnosticSeverity.Error,
          });
        } else {
          sections.push(newSection);
          currentSection = newSection;
        }
      }
    } else {
      const words: Word[] = [];
      while (column < content.length) {
        const startWord = column;
        while (column < content.length && !isSpace(content[column])) {
          ++column;
        }
        const range = {
          start: { line, character: startWord },
          end: { line, character: column },
        };
        words.push({
          range,
          value: content.substring(startWord, column),
        });
        while (column < content.length && isSpace(content[column])) {
          ++column;
        }
      }
      if (words.length > 0) {
        const range = {
          start: { line, character: startColumn },
          end: { line, character: content.length },
        };
        if (currentSection == null) {
          diagnostics.push({
            range: range,
            message: "must be in a section",
            severity: DiagnosticSeverity.Error,
          });
        } else {
          const currentSentence: Sentence = {
            range,
            words,
          };
          currentSection.sentences.push(currentSentence);
        }
      }
    }
  });

  return fillIngredients({
    title,
    sections,
    ingredients: {},
  });
}

function fillIngredients(recette: Recette) {
  recette.ingredients = {};
  function addIngredientRef(word: Word, isUse: Boolean) {
    const name = word.value;
    const ingredient = recette.ingredients[name] ?? { usages: [] };
    if (isUse) {
      ingredient.usages.push(word);
    } else if (!ingredient.definition) {
      ingredient.definition = word;
    }
    recette.ingredients[name] = ingredient;
  }
  recette.sections.forEach((section) => {
    if (section.name === INGREDIENTS_SECTION_NAME) {
      section.sentences.forEach((sentence) => {
        addIngredientRef(sentence.words[0], false);
      });
    } else {
      section.sentences.forEach((sentence) => {
        if (VERBS_WITH_INGREDIENTS.includes(sentence.words[0].value)) {
          for (let index = 1; index < sentence.words.length; ++index) {
            addIngredientRef(sentence.words[index], true);
          }
        }
      });
    }
  });
  return recette;
}

function validate(recette: Recette, diagnostics: Diagnostic[]) {
  recette.sections.forEach((section) => {
    if (section.name === INGREDIENTS_SECTION_NAME) {
      const ingredients: string[] = [];
      section.sentences.forEach((sentence) => {
        const name = sentence.words[0].value;
        if (ingredients.includes(name)) {
          diagnostics.push({
            range: sentence.words[0].range,
            message: "duplicated ingredient",
            severity: DiagnosticSeverity.Error,
          });
        } else {
          ingredients.push(name);
        }
      });
    } else {
      section.sentences.forEach((sentence) => {
        if (VERBS.includes(sentence.words[0].value)) {
          if (VERBS_WITH_INGREDIENTS.includes(sentence.words[0].value)) {
            if (sentence.words.length < 2) {
              diagnostics.push({
                range: sentence.words[0].range,
                message: "need ingredient(s)",
                severity: DiagnosticSeverity.Error,
              });
            } else {
              for (let index = 1; index < sentence.words.length; ++index) {
                const word = sentence.words[index];
                const ingredient = recette.ingredients[word.value];
                if (
                  ingredient === undefined ||
                  ingredient.definition === undefined
                ) {
                  diagnostics.push({
                    range: word.range,
                    message: "unknown ingredient",
                    severity: DiagnosticSeverity.Error,
                  });
                }
              }
            }
          }
        } else if (ADVERBS.includes(sentence.words[0].value)) {
          if (sentence.words.length < 2) {
            diagnostics.push({
              range: sentence.words[0].range,
              message: "missing tool",
              severity: DiagnosticSeverity.Error,
            });
          } else if (!TOOLS.includes(sentence.words[1].value)) {
            diagnostics.push({
              range: sentence.words[1].range,
              message: "unknown tool",
              severity: DiagnosticSeverity.Error,
            });
          }
        } else {
          diagnostics.push({
            range: sentence.words[0].range,
            message: "unknown verb or adverb",
            severity: DiagnosticSeverity.Error,
          });
        }
      });
    }
  });
}

documents.listen(connection);

connection.listen();

function isSpace(c: string) {
  return c == " " || c == "\t";
}
