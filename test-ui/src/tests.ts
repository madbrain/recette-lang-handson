import { code, TestClientHelper } from "./lsp/helper";
import { Diagnostic, DiagnosticSeverity } from "./lsp/models";

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
\`title already defined\` must be reported on following titles.
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
          message: "titleX already defined",
        },
      ] as Diagnostic[];

      await helper.testDiagnostics(text, expected);
    },
  },
  {
    name: "Test dandling section",
    doc: `# Test dandling section`,
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
    doc: `# Test dandling statement`,
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
];
