import { AsmFile, DirectiveKind, Expression, ExpressionKind, Operand, OperandKind, Operation, Statement, StatementKind } from './ast';
import { Lexer, Token, TokenKind } from './lexer';
import { mergeSpans, Reporter, Span } from './position';

export class Parser {
	private token: Token = this.lexer.nextToken();
	private lookahead: Token[] = [];
	constructor(private reporter: Reporter, private lexer: Lexer) { }

	parseFile(): AsmFile {
		const statements: Statement[] = [];
		while (this.token.kind != TokenKind.EOF) {
			this.skipEol();
			statements.push(this.parseStatement());
			this.skipEol();
		}
		return { statements };
	}

	private skipEol() {
		while (this.token.kind == TokenKind.EOL) {
			this.nextToken();
		}
	}

	private parseStatement(): Statement {
		if (this.token.kind === TokenKind.IDENT) {
			const name = this.token;
			this.nextToken();
			if (this.token.kind === TokenKind.COLON) {
				const span = mergeSpans(name.span, this.token.span);
				this.nextToken();
				return { kind: StatementKind.LABEL, span, name };
			}
			if (this.token.kind === TokenKind.EQUALS) {
				this.nextToken();
				return this.parseAssignment(name);
			}
			return this.parseInstruction(name);
		}
		if (this.token.kind === TokenKind.INTEGER) {
			const op = this.parseOperand();
			return { kind: StatementKind.INSTRUCTION, span: op.span, operands: [ op ] };
		}
		throw new Error(`UNKNOWN STATEMENT ${this.token.kind} @ ${this.token.span.start.line}`);
	}

	private parseInstruction(name: Token): Statement {
		if (name.value === '.PAGE') {
			return { kind: StatementKind.DIRECTIVE, span: name.span, directive: DirectiveKind.PAGE };
		}
		const operands = this.parseOperands();
		return { kind: StatementKind.INSTRUCTION, span: name.span, name, operands };
	}

	private parseOperands(): Operand[] {
		const operands: Operand[] = [];
		while (this.token.kind !== TokenKind.EOL) {
			operands.push(this.parseOperand());
			if (this.token.kind === TokenKind.EOL) {
				break;
			}
			if (this.token.kind !== TokenKind.COMA) {
				throw new Error(`Expecting coma @ ${this.token.span.start.line}, got ${this.token.kind}`);
			}
			this.nextToken();
		}
		return operands;
	}

	private parseOperand(): Operand {
		if (this.token.kind === TokenKind.SHARP) {
			const token = this.token;
			this.nextToken();
			const expr = this.parseExpression();
			return { kind: OperandKind.IMMEDIATE, span: mergeSpans(token.span, expr.span), expr };
		}
		if (this.token.kind === TokenKind.LPAR) {
			const start = this.token.span;
			this.nextToken();
			const name = this.parseIdent();
			let end = this.expectToken(TokenKind.RPAR);
			if (this.token.kind === TokenKind.PLUS) {
				end = this.token.span;
				this.nextToken();
				return { kind: OperandKind.POST_INC, span: mergeSpans(start, end), name };
			}
			return { kind: OperandKind.INDIRECT, span: mergeSpans(start, end), name };
		}
		if (this.token.kind === TokenKind.MINUS && this.look().kind === TokenKind.LPAR) {
			const start = this.token.span;
			this.nextToken();
			this.expectToken(TokenKind.LPAR);
			const name = this.parseIdent();
			const end = this.expectToken(TokenKind.RPAR);
			return { kind: OperandKind.PRE_DEC, span: mergeSpans(start, end), name };
		}
		if (this.token.kind === TokenKind.AROBA) {
			const start = this.token.span;
			this.nextToken();
			const op = this.parseOperand();
			return { kind: OperandKind.DOUBLE_INDIRECT, span: mergeSpans(start, op.span), op };
		}
		const expr = this.parseExpression();
		if (this.token.kind === TokenKind.LPAR) {
			this.nextToken();
			const name = this.parseIdent();
			const end = this.expectToken(TokenKind.RPAR);
			return { kind: OperandKind.INDIRECT, span: mergeSpans(expr.span, end), name, disp: expr };
		}
		return { kind: OperandKind.ABSOLUTE, span: expr.span, expr };
	}

	private parseAssignment(name: Token): Statement {
		const expr = this.parseExpression();
		return { kind: StatementKind.ASSIGNMENT, span: mergeSpans(name.span, expr.span), name, expr };
	}

	private parseExpression() {
		return this.parseAddSub();
	}

	private parseAddSub() {
		let expr = this.parseMul();
		while (true) {
			if (this.token.kind === TokenKind.PLUS) {
				this.nextToken();
				const right = this.parseMul();
				expr = { kind: ExpressionKind.OP, op: Operation.ADD, left: expr, right, span: mergeSpans(expr.span, right.span) };
			} else if (this.token.kind === TokenKind.MINUS) {
				this.nextToken();
				const right = this.parseMul();
				expr = { kind: ExpressionKind.OP, op: Operation.ADD, left: expr, right, span: mergeSpans(expr.span, right.span) };
			} else {
				break;
			}
		}
		return expr;
	}

	private parseMul() {
		let expr = this.parseUnary();
		while (true) {
			if (this.token.kind === TokenKind.TIMES) {
				this.nextToken();
				const right = this.parseUnary();
				expr = { kind: ExpressionKind.OP, op: Operation.TIMES, left: expr, right, span: mergeSpans(expr.span, right.span) };
			} else {
				break;
			}
		}
		return expr;
	}

	private parseUnary(): Expression {
		if (this.token.kind === TokenKind.MINUS) {
			const start = this.token.span;
			this.nextToken();
			const expr = this.parseUnary();
			return { kind: ExpressionKind.OP, op: Operation.NEGATE, span: mergeSpans(start, expr.span), expr };
		}
		if (this.token.kind === TokenKind.IDENT) {
			const token = this.token;
			this.nextToken();
			return { kind: ExpressionKind.VAR, span: token.span, name: token.value! };
		}
		if (this.token.kind === TokenKind.INTEGER) {
			const token = this.token;
			this.nextToken();
			return { kind: ExpressionKind.INTEGER, span: token.span, value: parseInt(token.value!) };
		}
		if (this.token.kind === TokenKind.CHAR) {
			const token = this.token;
			this.nextToken();
			return { kind: ExpressionKind.INTEGER, span: token.span, value: token.value!.charCodeAt(0) }; // TODO make a special kind ?
		}
		if (this.token.kind === TokenKind.STRING) {
			const token = this.token;
			this.nextToken();
			return { kind: ExpressionKind.STRING, span: token.span, value: token.value! };
		}
		throw new Error(`Unknown unary ${this.token.kind} ${this.token.value ?? ""} @ ${this.token.span.start.line}`);
	}

	private parseIdent() {
		if (this.token.kind !== TokenKind.IDENT) {
			throw new Error(`Expecting IDENT @ ${this.token.span.start.line}`);
		}
		const name = this.token;
		this.nextToken();
		return name;
	}

	private expectToken(kind: TokenKind): Span {
		if (this.token.kind !== kind) {
			throw new Error(`Expecting ${kind} @ ${this.token.span.start.line}`);
		}
		const span = this.token.span;
		this.nextToken();
		return span;
	}

	private look(): Token {
		if (this.lookahead.length < 1) {
			this.lookahead.push(this.lexer.nextToken());
		}
		return this.lookahead[0];
	}
	
	private nextToken() {
		if (this.lookahead.length > 0) {
			this.token = this.lookahead.splice(0, 1)[0];
		} else {
			this.token = this.lexer.nextToken();
		}
	}
}