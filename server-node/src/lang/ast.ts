import { Token } from './lexer';
import { Span } from './position';

export enum StatementKind {
	ASSIGNMENT = "ASSIGNMENT",
	DIRECTIVE = "DIRECTIVE",
	LABEL = "LABEL",
	INSTRUCTION = "INSTRUCTION",
}

export interface BaseStatement {
	span: Span;
	kind: StatementKind;
}

export interface Assignment extends BaseStatement {
	name: Token;
	expr: Expression;
}

export enum DirectiveKind {
	PAGE = "PAGE"
}

export interface Directive extends BaseStatement {
	kind: StatementKind.DIRECTIVE;
	directive: DirectiveKind;
}

export interface Label extends BaseStatement {
	kind: StatementKind.LABEL;
	name: Token;
}

export enum OperandKind {
	ABSOLUTE = "ABSOLUTE",
	IMMEDIATE = "IMMEDIATE",
	POST_INC = "POST_INC",
	PRE_DEC = "PRE_DEC",
	INDIRECT = "INDIRECT",
	DOUBLE_INDIRECT = "DOUBLE_INDIRECT",
}

export interface BaseOperand {
	span: Span;
	kind: OperandKind;
}

export interface AbsoluteOperand extends BaseOperand {
	kind: OperandKind.ABSOLUTE;
	expr: Expression
}

export interface ImmediateOperand extends BaseOperand {
	kind: OperandKind.IMMEDIATE;
	expr: Expression
}

export interface PostIncrementOperand extends BaseOperand {
	kind: OperandKind.POST_INC;
	name: Token
}

export interface PreDecrementOperand extends BaseOperand {
	kind: OperandKind.PRE_DEC;
	name: Token
}

export interface IndirectOperand extends BaseOperand {
	kind: OperandKind.INDIRECT;
	name: Token;
	disp?: Expression;
}

export interface DoubleIndirectOperand extends BaseOperand {
	kind: OperandKind.DOUBLE_INDIRECT;
	op: Operand
}

export type Operand = AbsoluteOperand | ImmediateOperand | PostIncrementOperand | PreDecrementOperand | IndirectOperand | DoubleIndirectOperand;

export interface Instruction extends BaseStatement {
	kind: StatementKind.INSTRUCTION;
	name?: Token;
	operands: Operand[];
}

export type Statement = Assignment | Directive | Label | Instruction;

export enum ExpressionKind {
	VAR = "VAR",
	INTEGER = "INTEGER",
	STRING = "STRING",
	OP = "OP",
}

export interface BaseExpression {
	span: Span;
	kind: ExpressionKind
}

export interface VarExpression extends BaseExpression {
	kind: ExpressionKind.VAR
	name: string;
}

export interface IntegerExpression extends BaseExpression {
	kind: ExpressionKind.INTEGER
	value: number;
}

export interface StringExpression extends BaseExpression {
	kind: ExpressionKind.STRING
	value: string;
}

export enum Operation {
	ADD = "ADD",
	SUB = "SUB",
	NEGATE = "NEGATE",
	TIMES = "TIMES",
}

export interface OperationExpression extends BaseExpression {
	kind: ExpressionKind.OP
	op: Operation;
}

export interface BinaryExpression extends BaseExpression {
	kind: ExpressionKind.OP
	op: Operation.ADD | Operation.SUB | Operation.TIMES;
	left: Expression;
	right: Expression;
}

export interface UnaryExpression extends BaseExpression {
	kind: ExpressionKind.OP
	op: Operation.NEGATE;
	expr: Expression;
}

export type Expression = VarExpression | IntegerExpression | BinaryExpression | UnaryExpression | StringExpression;

export interface AsmFile {
	statements: Statement[]
}