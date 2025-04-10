// LSP specification
// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/

export type DocumentUri = string;

/**
 * Defines an integer number in the range of -2^31 to 2^31 - 1.
 */
export type integer = number;

/**
 * Defines an unsigned integer number in the range of 0 to 2^31 - 1.
 */
export type uinteger = number;

/**
 * Defines a decimal number. Since decimal numbers are very
 * rare in the language server specification we denote the
 * exact range with every decimal using the mathematics
 * interval notation (e.g. [0, 1] denotes all decimals d with
 * 0 <= d <= 1.
 */
export type decimal = number;

type URI = string;

export type LSPAny =
  | LSPObject
  | LSPArray
  | string
  | integer
  | uinteger
  | decimal
  | boolean
  | null;

export type LSPObject = { [key: string]: LSPAny };

export type LSPArray = LSPAny[];

export interface DidOpenTextDocumentParams {
  /**
   * The document that was opened.
   */
  textDocument: TextDocumentItem;
}

export interface TextDocumentItem {
  /**
   * The text document's URI.
   */
  uri: DocumentUri;

  /**
   * The text document's language identifier.
   */
  languageId: string;

  /**
   * The version number of this document (it will increase after each
   * change, including undo/redo).
   */
  version: integer;

  /**
   * The content of the opened text document.
   */
  text: string;
}

export interface PublishDiagnosticsParams {
  /**
   * The URI for which diagnostic information is reported.
   */
  uri: DocumentUri;

  /**
   * Optional the version number of the document the diagnostics are published
   * for.
   *
   * @since 3.15.0
   */
  version?: integer;

  /**
   * An array of diagnostic information items.
   */
  diagnostics: Diagnostic[];
}

export interface Diagnostic {
  /**
   * The range at which the message applies.
   */
  range: Range;

  /**
   * The diagnostic's severity. To avoid interpretation mismatches when a
   * server is used with different clients it is highly recommended that
   * servers always provide a severity value. If omitted, it’s recommended
   * for the client to interpret it as an Error severity.
   */
  severity?: DiagnosticSeverity;

  /**
   * The diagnostic's code, which might appear in the user interface.
   */
  code?: integer | string;

  /**
   * An optional property to describe the error code.
   *
   * @since 3.16.0
   */
  codeDescription?: CodeDescription;

  /**
   * A human-readable string describing the source of this
   * diagnostic, e.g. 'typescript' or 'super lint'.
   */
  source?: string;

  /**
   * The diagnostic's message.
   */
  message: string;

  /**
   * Additional metadata about the diagnostic.
   *
   * @since 3.15.0
   */
  tags?: DiagnosticTag[];

  /**
   * An array of related diagnostic information, e.g. when symbol-names within
   * a scope collide all definitions can be marked via this property.
   */
  relatedInformation?: DiagnosticRelatedInformation[];

  /**
   * A data entry field that is preserved between a
   * `textDocument/publishDiagnostics` notification and
   * `textDocument/codeAction` request.
   *
   * @since 3.16.0
   */
  data?: LSPAny;
}

export namespace DiagnosticSeverity {
  /**
   * Reports an error.
   */
  export const Error: 1 = 1;
  /**
   * Reports a warning.
   */
  export const Warning: 2 = 2;
  /**
   * Reports an information.
   */
  export const Information: 3 = 3;
  /**
   * Reports a hint.
   */
  export const Hint: 4 = 4;
}

export type DiagnosticSeverity = 1 | 2 | 3 | 4;

/**
 * The diagnostic tags.
 *
 * @since 3.15.0
 */
export namespace DiagnosticTag {
  /**
   * Unused or unnecessary code.
   *
   * Clients are allowed to render diagnostics with this tag faded out
   * instead of having an error squiggle.
   */
  export const Unnecessary: 1 = 1;
  /**
   * Deprecated or obsolete code.
   *
   * Clients are allowed to rendered diagnostics with this tag strike through.
   */
  export const Deprecated: 2 = 2;
}

export type DiagnosticTag = 1 | 2;

/**
 * Represents a related message and source code location for a diagnostic.
 * This should be used to point to code locations that cause or are related to
 * a diagnostics, e.g when duplicating a symbol in a scope.
 */
export interface DiagnosticRelatedInformation {
  /**
   * The location of this related diagnostic information.
   */
  location: Location;

  /**
   * The message of this related diagnostic information.
   */
  message: string;
}

/**
 * Structure to capture a description for an error code.
 *
 * @since 3.16.0
 */
export interface CodeDescription {
  /**
   * An URI to open with more information about the diagnostic error.
   */
  href: URI;
}

export interface Position {
  /**
   * Line position in a document (zero-based).
   */
  line: uinteger;

  /**
   * Character offset on a line in a document (zero-based). The meaning of this
   * offset is determined by the negotiated `PositionEncodingKind`.
   *
   * If the character value is greater than the line length it defaults back
   * to the line length.
   */
  character: uinteger;
}

export interface Range {
  /**
   * The range's start position.
   */
  start: Position;

  /**
   * The range's end position.
   */
  end: Position;
}

export interface TextDocumentIdentifier {
  /**
   * The text document's URI.
   */
  uri: DocumentUri;
}

export interface TextDocumentPositionParams {
  /**
   * The text document.
   */
  textDocument: TextDocumentIdentifier;

  /**
   * The position inside the text document.
   */
  position: Position;
}

// export interface CompletionParams extends TextDocumentPositionParams,
// 	WorkDoneProgressParams, PartialResultParams {
// 	/**
// 	 * The completion context. This is only available if the client specifies
// 	 * to send this using the client capability
// 	 * `completion.contextSupport === true`
// 	 */
// 	context?: CompletionContext;
// }
