import { Position, Reporter, Span } from './position';

export enum TokenKind {
	AROBA = "AROBA",
	CHAR = "CHAR",
	COLON = "COLON",
	COMA = "COMA",
	SHARP = "SHARP",
	EQUALS = "EQUALS",
	IDENT = "IDENT",
	INTEGER = "INTEGER",
	PLUS = "PLUS",
	MINUS = "MINUS",
	LPAR = "LPAR",
	RPAR = "RPAR",
	STRING = "STRING",
	TIMES = "TIMES",
	EOF = "EOF",
	EOL = "EOL"
}

export interface Token {
	kind: TokenKind;
	span: Span;
	value?: string
}

export class Lexer {
	private index = 0;
	private position = { line: 1, character: 0 };
	private lastLineEnd = 0;
	private startPosition: Position = this.makePosition();
	private seenAscii = false;
	private unexpectedChars: Position | undefined;

	constructor(private reporter: Reporter, private content: string) {}

	nextToken(): Token {
		while (true) {
			this.markStart();
			const c = this.getChar();
			if (! c) {
				return this.token(TokenKind.EOF);
			}
			if (c == ';') {
				this.skipComment();
				continue;
			}
			if (c == '\n') {
				return this.token(TokenKind.EOL);
			}
			if (this.isSpace(c)) {
				continue;
			}
			if (c == '@') {
				return this.token(TokenKind.AROBA);
			}
			if (c == '=') {
				return this.token(TokenKind.EQUALS);
			}
			if (c == '+') {
				return this.token(TokenKind.PLUS);
			}
			if (c == '-') {
				return this.token(TokenKind.MINUS);
			}
			if (c == '*') {
				return this.token(TokenKind.TIMES);
			}
			if (c == ':') {
				return this.token(TokenKind.COLON);
			}
			if (c == '#') {
				return this.token(TokenKind.SHARP);
			}
			if (c == ',') {
				return this.token(TokenKind.COMA);
			}
			if (c == '(') {
				return this.token(TokenKind.LPAR);
			}
			if (c == ')') {
				return this.token(TokenKind.RPAR);
			}
			if (c == '"') {
				return this.nextString(c);
			}
			if (c == '/') {
				return this.nextString(c);
			}
			if (c == '\'') {
				if (this.seenAscii) {
					return this.nextString(c);
				}
				const cc = this.getChar();
				return this.token(TokenKind.CHAR, cc);
			}
			if (this.isLetterOrDot(c)) {
				return this.nextIdent(c);
			}
			if (this.isDigit(c)) {
				return this.nextInteger(c);
			}
			if (!this.unexpectedChars) {
				this.unexpectedChars = this.startPosition;
			}
		}
	}
	
	private token(kind: TokenKind, value?: string): Token {
		if (this.unexpectedChars) {
			this.reporter.error({ start: this.unexpectedChars, end: this.makePosition() }, "Unexpected chars");
		}
		return { kind, span: this.makeSpan(), value };
	}

	private nextIdent(pc: string): Token {
		let result = pc;
		while (true) {
			const c = this.getChar();
			if (!c) {
				break;
			}
			if (! this.isLetterOrDigit(c)) {
				this.pushBack(c);
				break;
			}
			result += c;
		}
		this.seenAscii = result == '.ASCII';
		return this.token(TokenKind.IDENT, result);
	}

	private nextInteger(pc: string): Token {
		let result = pc;
		while (true) {
			const c = this.getChar();
			if (!c) {
				break;
			}
			if (c === '$') {
				result += c;
				return this.token(TokenKind.IDENT, result);
			}
			if (! (this.isDigit(c) || c == '.')) {
				this.pushBack(c);
				break;
			}
			result += c;
		}
		return this.token(TokenKind.INTEGER, result);
	}

	private nextString(delim: string): Token {
		let result = "";
		while (true) {
			const c = this.getChar();
			if (!c) {
				this.reporter.error(this.makeSpan(), "Unterminated string");
				break;
			}
			if (c == delim) {
				break;
			}
			result += c;
		}
		return this.token(TokenKind.STRING, result);
	}

	private skipComment() {
		while (true) {
			const c = this.getChar();
			if (!c) {
				break;
			}
			if (c == '\n') {
				this.pushBack(c);
				break;
			}
		}
	}

	private isSpace(c: string) {
		return c == ' ' || c == '\t' || c == '\r' || c == "\u0000";
	}

	private isLetterOrDigit(c: string) {
		return this.isLetterOrDot(c) || this.isDigit(c);
	}

	private isDigit(c: string) {
		return c >= '0' && c <= '9';
	}

	private isLetterOrDot(c: string) {
		return c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' || c == '.';
	}

	private pushBack(c: string) {
		this.index -= 1;
		this.position.character -= 1;
		if (c == '\n') {
			this.position.line -= 1;
			this.position.character = this.lastLineEnd;
		}
	}
	
	private getChar(): string | undefined {
		if (this.index >= this.content.length) {
			return undefined;
		}
		const c = this.content[this.index++];
		this.position.character += 1;
		if (c == '\n') {
			this.lastLineEnd = this.position.character;
			this.position.line += 1;
			this.position.character = 0;
		}
		return c;
	}

	private markStart() {
		this.startPosition = this.makePosition();
	}

	private makePosition(): Position {
		return {
			offset: this.index,
			line: this.position.line,
			character: this.position.character,
		};
	}

	private makeSpan(): Span {
		return {
			start: this.startPosition,
			end: this.makePosition()
		};
	}
}