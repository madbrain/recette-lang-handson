import { test, expect } from "vitest";
import { code } from "./helper";

test("code must extract the text, range, and positions", () => {
  const { text, ranges, positions } = code(`\
      # title
      ## section@{1}
        @<1>hello@<1> wor@{2}ld
      `);
  expect(text).toEqual("# title\n## section\n  hello world\n");
  expect(ranges).toEqual([
    undefined,
    {
      start: { line: 2, character: 2 },
      end: { line: 2, character: 7 },
    },
  ]);
  expect(positions).toEqual([
    undefined,
    { line: 1, character: 10 },
    { line: 2, character: 11 },
  ]);
});
