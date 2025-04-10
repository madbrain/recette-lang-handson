import { TestClientHelper } from "./lsp/client";
import { code } from "./lsp/helper";
import { Diagnostic, DiagnosticSeverity } from "./lsp/models";

export interface TestDescription {
  name: string;
  doc: string;
  run: (helper: TestClientHelper) => Promise<void>;
}

export const tests: TestDescription[] = [
  {
    name: "Title already defined",
    doc: ``,
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
];
