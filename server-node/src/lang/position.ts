
export interface Position {
	offset: number;
	line: number;
	character: number;
}

export interface Span {
	start: Position;
	end: Position;
}

export function mergeSpans(...spans: Span[]): Span {
	if (spans.length < 1) {
		throw new Error("must have at least one span");
	}
	let result = spans[0];
	for (const span of spans) {
		result = mergeSpan(result, span);
	}
	return result;
}

export function mergeSpan(a: Span, b: Span): Span {
	const start = minPosition(a.start, b.start);
	const end = maxPosition(a.end, b.end);
	return { start, end };
}

export function minPosition(a: Position, b: Position): Position {
	return a.offset < b.offset ? a : b;
}

export function maxPosition(a: Position, b: Position): Position {
	return a.offset > b.offset ? a : b;
}

export interface Reporter {
	error(span: Span, message: string): void;
}