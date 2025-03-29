import * as assert from 'assert';
import * as fs from 'fs';
import { Lexer, TokenKind } from './lang/lexer';
import { Reporter, Span } from './lang/position';
import { Parser } from './lang/parser';
import { StatementKind } from './lang/ast';

function span(line: number, character: number, offset: number, length: number): Span {
	return {
		start: {
			line,
			character,
			offset,
		},
		end: {
			line,
			character: character + length,
			offset: offset + length
		}
	};
}

class TestReporter implements Reporter {
	error(span: Span, message: string): void {
		console.log(message + " @ " + span.start.line);
	}
}

describe("parser", () => {
	it("should parse", () => {
		const content = fs.readFileSync("../../examples/gtlem.mac", "ascii");
		const reporter = new TestReporter();
		const lexer = new Lexer(reporter, content);
		const parser = new Parser(reporter, lexer);

		const result = parser.parseFile();
		for (let i = 0; i < 300; i++) {
			const stmt = result.statements[i];
			if (stmt.kind === StatementKind.ASSIGNMENT) {
				console.log(stmt.kind, stmt.name.value);
			} else if (stmt.kind === StatementKind.LABEL) {
				console.log(stmt.kind, stmt.name.value);
			} else if (stmt.kind === StatementKind.INSTRUCTION) {
				console.log(stmt.kind, stmt.name?.value);
			} else {
				console.log(stmt.kind);
			}
		}
		// assert.deepEqual(result, {});
	});
});