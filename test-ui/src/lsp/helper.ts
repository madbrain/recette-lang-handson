import { Diagnostic, Position, Range } from "./models";
import { Client } from "./client";
import * as Diff from "diff";
import { asyncWrap, wrap } from "./expect";
import { expect } from "earl";

export interface TestContext {
  text: string;
  diagnostics: Diagnostic[];
}

export class TestClientHelper {
  context: TestContext | undefined;

  constructor(public client: Client) {}

  async openTextDocument(text: string) {
    const testUri = "file:///test.rct";
    this.client.textdocumentDidOpen({
      textDocument: {
        uri: testUri,
        languageId: "recette",
        version: 0,
        text: text,
      },
    });
    return testUri;
  }

  async waitDiagnostics() {
    return new Promise((resolve, error) => {
      let count = 0;
      const id = setInterval(() => {
        if (this.client.diagnostics) {
          clearInterval(id);
          resolve({})
        } else if (count++ > 10) {
          clearInterval(id);
          error({})
        }
      }, 100);
    });
  }

  async testDiagnostics(text: string, expectedDiagnostics: Diagnostic[]) {
    this.context = {
      text,
      diagnostics: expectedDiagnostics,
    };
    const test_uri = await this.openTextDocument(text);

    await asyncWrap("Timeout waiting for diagnostics ", () => this.waitDiagnostics());

    wrap("Must have received diagnostics ", () =>
      expect(this.client.diagnostics).not.toBeNullish()
    );
    wrap("Diagnostics must be from correct document", () =>
      expect(this.client.diagnostics?.uri).toEqual(test_uri)
    );
    wrap("Diagnostics must be correct", () =>
      expect(this.client.diagnostics?.diagnostics).toEqual(expectedDiagnostics)
    );
  }

  buildHtmlContext(): string {
    if (!this.context) {
      return "";
    }
    this.context.diagnostics.sort((a, b) =>
      a.range.start.line === b.range.start.line
        ? a.range.start.character - b.range.start.character
        : a.range.start.line - b.range.start.line
    );
    let result = "<pre><code>";
    this.context.text.split("\n").forEach((line, index) => {
      let start = 0;
      this.context?.diagnostics
        .filter((diag) => diag.range.start.line == index)
        .forEach((diag) => {
          result += line.substring(start, diag.range.start.character);
          result += `<mark data-bs-toggle="tooltip" data-bs-title="${diag.message}">`;
          result += line.substring(
            diag.range.start.character,
            diag.range.end.character
          );
          result += "</mark>";
          start = diag.range.end.character;
        });
      if (start < line.length) {
        result += line.substring(start);
      }
      result += "\n";
    });
    result += "</code></pre>";
    return result;
  }

  buildDiff(name: string, actual: string, expected: string): any {
    return Diff.createPatch(name, expected, actual);
  }
}

export function code(content: string) {
  let margin: number | undefined = undefined;
  function stripMargin(content: string) {
    let result = "";
    let index = 0;
    let startOfLine = true;
    let m = margin;
    while (index < content.length) {
      const c = content[index++];
      if (c == " " || c == "\t") {
        if (startOfLine) {
          if (m === undefined) {
            margin = (margin || 0) + 1;
          } else if (m > 0) {
            --m;
          } else {
            result += c;
          }
        } else {
          result += c;
        }
      } else if (c == "\n") {
        startOfLine = true;
        result += c;
        m = margin;
      } else {
        startOfLine = false;
        result += c;
      }
    }
    return result;
  }
  const current: Position = { line: 0, character: 0 };
  function update(s: string, current: Position) {
    for (let i = 0; i < s.length; ++i) {
      current.character += 1;
      if (s.charAt(i) == "\n") {
        current.line += 1;
        current.character = 0;
      }
    }
    return s;
  }
  let m;
  let result = "";
  let lastIndex = 0;
  const positions: Position[] = [];
  const starts: Position[] = [];
  const ranges: Range[] = [];
  const POSITION_REGEXP = /@{([0-9]+)}|@<([0-9]+)>/g;
  do {
    m = POSITION_REGEXP.exec(content);
    if (m) {
      if (m[1]) {
        result += update(
          stripMargin(content.substring(lastIndex, m.index)),
          current
        );
        positions[parseInt(m[1])] = { ...current };
        lastIndex = m.index + m[0].length;
      } else {
        result += update(
          stripMargin(content.substring(lastIndex, m.index)),
          current
        );
        const index = parseInt(m[2]);
        if (starts[index]) {
          ranges[index] = { start: starts[index], end: { ...current } };
        } else {
          starts[index] = { ...current };
        }
        lastIndex = m.index + m[0].length;
      }
    } else {
      const r = update(stripMargin(content.substring(lastIndex)), current);
      result += r;
    }
  } while (m);
  return { text: result, positions, ranges };
}
