import { expect } from "earl";
import { wrap } from "./lsp/expect";
import { code, TestClientHelper } from "./lsp/helper";
import {
  CompletionItem,
  CompletionItemKind,
  Diagnostic,
  DiagnosticSeverity,
  Range,
} from "./lsp/models";

export interface TestDescription {
  name: string;
  doc: string;
  run: (helper: TestClientHelper) => Promise<void>;
}

export const tests: TestDescription[] = [
  {
    name: "Title already defined",
    doc: `# Title already defined
A recipe must have a title. As in [Markdown](https://fr.wikipedia.org/wiki/Markdown)
it starts on a new line with a single \`#\`. Only one title can be defined, the message
\`title already defined\` must be reported on other titles than the first one.
`,
    run: async (helper) => {
      const { text, ranges } = code(`\
            # hello
            @<1># tutu@<1>
            `);
      const expected = [
        {
          range: ranges[1],
          severity: DiagnosticSeverity.Error,
          message: "title already defined",
        },
      ] as Diagnostic[];

      await helper.testDiagnostics(text, expected);
    },
  },

  {
    name: "Title already defined with spaces",
    doc: `# Title already defined with spaces
Title and section headers don't have to start of on first character, they can be precedeed by optional spaces.
Empty lines are ignored.
`,
    run: async (helper) => {
      const { text, ranges } = code(`\
            # hello
            
               @<1># tutu@<1>
            `);
      const expected = [
        {
          range: ranges[1],
          severity: DiagnosticSeverity.Error,
          message: "title already defined",
        },
      ] as Diagnostic[];

      await helper.testDiagnostics(text, expected);
    },
  },

  {
    name: "Test dandling section",
    doc: `# Test dandling section
A section which starts with \`##\` must be defined after the title.`,
    run: async (helper) => {
      const { text, ranges } = code(`\
            @<1>## hello@<1>
            `);
      const expected = [
        {
          range: ranges[1],
          severity: DiagnosticSeverity.Error,
          message: "must come after title",
        },
      ] as Diagnostic[];

      await helper.testDiagnostics(text, expected);
    },
  },

  {
    name: "Test dandling statement",
    doc: `# Test dandling statement
Each instruction line (sequence of words for now) must be contained in a section.`,
    run: async (helper) => {
      const { text, ranges } = code(`\
            @<1>hello@<1>
            # title
            `);
      const expected = [
        {
          range: ranges[1],
          severity: DiagnosticSeverity.Error,
          message: "must be in a section",
        },
      ] as Diagnostic[];
      await helper.testDiagnostics(text, expected);
    },
  },

  {
    name: "Test parse unknown verb",
    doc: `# Test parse unknown verb
Each instruction in a section is a series of words separated by spaces. First word must be a either a verb or an adverb.`,
    run: async (helper) => {
      const { text, ranges } = code(`\
        # title
        ## section
        @<1>hello@<1> world
        `);
      const expected = [
        {
          range: ranges[1],
          severity: DiagnosticSeverity.Error,
          message: "unknown verb or adverb",
        },
      ];
      await helper.testDiagnostics(text, expected);
    },
  },

  {
    name: "Test can complete",
    doc: `# Test can complete
In order to do completion, the server must declare the \`completionProvider\` capability and implement the \`textDocument/completion\` operation`,
    run: async (helper) => {
      helper.context = undefined;
      wrap("Server must have completion capabilities", () => {
        expect(
          helper.client.severCapabilities.completionProvider
        ).not.toBeNullish();
      });
    },
  },

  {
    name: "Test complete verb",
    doc: `# Test complete verb
When a completion is started on the first word, the list of verbs must be proposed.
    
No need to filter on the word prefix, most client (VSCode does) will only display matching words.`,
    run: async (helper) => {
      const { text, positions } = code(`\
        # title
        ## section
        ma@{1}la
        `);
      helper.setCompletionContext(text, positions[1]);
      const testUri = await helper.openTextDocument(text);
      const result = await helper.client.textDocumentCompletion({
        textDocument: { uri: testUri },
        position: positions[1],
      });
      const expectedVerbs: CompletionItem[] = [
        { label: "verser", kind: CompletionItemKind.Function },
        { label: "touiller", kind: CompletionItemKind.Function },
        { label: "malaxer", kind: CompletionItemKind.Function },
        { label: "mélanger", kind: CompletionItemKind.Function },
        { label: "incorporer", kind: CompletionItemKind.Function },
        { label: "étaler", kind: CompletionItemKind.Function },
        { label: "fondre", kind: CompletionItemKind.Function },
        { label: "cuire", kind: CompletionItemKind.Function },
        { label: "avec", kind: CompletionItemKind.Operator },
        { label: "dans", kind: CompletionItemKind.Operator },
      ];
      wrap("Completion items must be correct", () =>
        expect(result).toEqual({
          isIncomplete: false,
          items: expectedVerbs,
        })
      );
    },
  },

  {
    name: "Test complete verb on empty line",
    doc: `# Test complete verb on empty line
When a completion is started on an empty line, the list of verbs must be proposed.`,
    run: async (helper) => {
      const { text, positions } = code(`\
        # title
        ## section
        @{1}
        `);
      helper.setCompletionContext(text, positions[1]);
      const testUri = await helper.openTextDocument(text);
      const result = await helper.client.textDocumentCompletion({
        textDocument: { uri: testUri },
        position: positions[1],
      });
      const expectedVerbs: CompletionItem[] = [
        { label: "verser", kind: CompletionItemKind.Function },
        { label: "touiller", kind: CompletionItemKind.Function },
        { label: "malaxer", kind: CompletionItemKind.Function },
        { label: "mélanger", kind: CompletionItemKind.Function },
        { label: "incorporer", kind: CompletionItemKind.Function },
        { label: "étaler", kind: CompletionItemKind.Function },
        { label: "fondre", kind: CompletionItemKind.Function },
        { label: "cuire", kind: CompletionItemKind.Function },
        { label: "avec", kind: CompletionItemKind.Operator },
        { label: "dans", kind: CompletionItemKind.Operator },
      ];
      wrap("Completion items must be correct", () =>
        expect(result).toEqual({
          isIncomplete: false,
          items: expectedVerbs,
        })
      );
    },
  },

  {
    name: "Test parse missing tools",
    doc: `# Test parse missing tools
Adverbs must be followed by a second word known as tool.`,
    run: async (helper) => {
      const { text, ranges } = code(`\
        # title
        ## section
        @<1>dans@<1>
        malaxer
        `);
      const expected = [
        {
          range: ranges[1],
          severity: DiagnosticSeverity.Error,
          message: "missing tool",
        },
      ];
      await helper.testDiagnostics(text, expected);
    },
  },

  {
    name: "Test report unknown tools",
    doc: `# Test report unknown tools
Here are words recognized as tools :
* saladier
* cuillère
* plat
* mixeur
* four`,
    run: async (helper) => {
      const { text, ranges } = code(`\
        # title
        ## section
        dans @<1>grenier@<1>
        malaxer
        `);
      const expected = [
        {
          range: ranges[1],
          severity: DiagnosticSeverity.Error,
          message: "unknown tool",
        },
      ];
      await helper.testDiagnostics(text, expected);
    },
  },

  {
    name: "Test complete tool",
    doc: `# Test complete tool
When the instruction expect a tool (in second word), the tool can be completed from a defined list.`,
    run: async (helper) => {
      const { text, positions } = code(`\
        # title
        ## section
        dans sa@{1}
        malaxer
        `);
      helper.setCompletionContext(text, positions[1]);
      const testUri = await helper.openTextDocument(text);
      const result = await helper.client.textDocumentCompletion({
        textDocument: { uri: testUri },
        position: positions[1],
      });
      const expectedTools = ["saladier", "cuillère", "plat", "mixeur", "four"];
      wrap("Completion items must be correct", () =>
        expect(result).toEqual({
          isIncomplete: false,
          items: expectedTools.map((verb) => ({
            kind: CompletionItemKind.Class,
            label: verb,
          })),
        })
      );
    },
  },

  {
    name: "Test that verb need ingredient",
    doc: `# Test that verb need ingredient
Some verbs require ingredients:
* verser
* mélanger
* fondre`,
    run: async (helper) => {
      const { text, ranges } = code(`\
        # title
        ## section
        dans saladier
        @<1>verser@<1>
        `);
      const expected = [
        {
          range: ranges[1],
          severity: DiagnosticSeverity.Error,
          message: "need ingredient(s)",
        },
      ];
      await helper.testDiagnostics(text, expected);
    },
  },

  {
    name: "Test parse unknown ingredient",
    doc: `# Test parse unknown ingredient
Ingredients must first be defined to used`,
    run: async (helper) => {
      const { text, ranges } = code(`\
        # title
        ## section
        dans saladier
        verser @<1>lait@<1>
        `);
      const expected = [
        {
          range: ranges[1],
          severity: DiagnosticSeverity.Error,
          message: "unknown ingredient",
        },
      ];
      await helper.testDiagnostics(text, expected);
    },
  },

  {
    name: "Test parse duplicated ingredient",
    doc: `# Test parse duplicated ingredient
Ingredients are listed in a special section \`ingrédients\`. the first word of the line is the ingredient.
Each ingredient must declared only once.`,
    run: async (helper) => {
      const { text, ranges } = code(`\
        # title
        ## ingrédients
        lait
        @<1>lait@<1>
        ## section
        dans saladier
        verser lait
        `);
      const expected = [
        {
          range: ranges[1],
          severity: DiagnosticSeverity.Error,
          message: "duplicated ingredient",
        },
      ];
      await helper.testDiagnostics(text, expected);
    },
  },

  {
    name: "Test complete ingredient",
    doc: `# Test complete ingredient
Completion when expecting an ingredient should only porposed defined ingredients`,
    run: async (helper) => {
      const { text, positions } = code(`\
        # title
        ## ingrédients
        chocolat
        poulet
        ## section
        mélanger @{1} 
        `);
      helper.setCompletionContext(text, positions[1]);
      const testUri = await helper.openTextDocument(text);
      const result = await helper.client.textDocumentCompletion({
        textDocument: { uri: testUri },
        position: positions[1],
      });
      const expectedIngredients = ["chocolat", "poulet"];
      wrap("Completion items must be correct", () =>
        expect(result).toEqual({
          isIncomplete: false,
          items: expectedIngredients.map((ingredient) => ({
            kind: CompletionItemKind.Field,
            label: ingredient,
          })),
        })
      );
    },
  },

  {
    name: "Test complete ingredient list with unknown ingredients",
    doc: `# Test complete ingredient list with unknown ingredients
When a completion is started in ingredient section, the list of unknown ingredients must be proposed.`,
    run: async (helper) => {
      const { text, positions } = code(`\
        # title
        ## ingrédients
        lait
        @{1}
        ## section
        fondre beurre
        `);
      helper.setCompletionContext(text, positions[1]);
      const testUri = await helper.openTextDocument(text);
      const result = await helper.client.textDocumentCompletion({
        textDocument: { uri: testUri },
        position: positions[1],
      });
      const expectedIngredients: CompletionItem[] = [
        { label: "beurre", kind: CompletionItemKind.Field },
      ];
      wrap("Completion items must be correct", () =>
        expect(result).toEqual({
          isIncomplete: false,
          items: expectedIngredients,
        })
      );
    },
  },

  {
    name: "Test can rename",
    doc: `# Test can rename
In order to do rename refactoring, the server must declare the \`renameProvider\` capability and implement the \`textDocument/prepareRename\` and \`textDocument/rename\` operations`,
    run: async (helper) => {
      helper.context = {
        text: `{
  renameProvider: { prepareProvider: true }
}`,
        diagnostics: [],
      };
      wrap("Server must have rename capabilities", () => {
        expect(
          helper.client.severCapabilities.renameProvider
        ).not.toBeNullish();
        expect(helper.client.severCapabilities.renameProvider).toEqual({
          prepareProvider: true,
        });
      });
    },
  },

  {
    name: "Test rename ingredient",
    doc: `# Test rename ingredient
Ingredients could be renamed, but only words interpreted as an ingredient should be renamed.`,
    run: async (helper) => {
      const { text, positions, ranges } = code(`\
        # title
        ## ingrédients
        @<3>chocolat@<3>
        poulet
        ## section
        mélanger @<2>cho@{1}colat@<2>
        touiller chocolat
        `);
      helper.setCompletionContext(text, positions[1]);
      const testUri = await helper.openTextDocument(text);
      const prepareResult = await helper.client.textDocumentPrepareRename({
        textDocument: { uri: testUri },
        position: positions[1],
      });
      wrap("Prepare rename must return a range", () =>
        expect(prepareResult as Range).toEqual(ranges[2])
      );
      const renameResult = await helper.client.textDocumentRename({
        textDocument: { uri: testUri },
        position: positions[1],
        newName: "poireau",
      });
      wrap("Rename response must be correct", () =>
        expect(
          renameResult?.changes?.[testUri].sort(
            (a, b) => b.range.start.line - a.range.start.line
          )
        ).toEqual([
          { range: ranges[2], newText: "poireau" },
          { range: ranges[3], newText: "poireau" },
        ])
      );
    },
  },
];
