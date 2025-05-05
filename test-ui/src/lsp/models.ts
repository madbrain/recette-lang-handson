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

export interface InitializeResult {
  /**
   * The capabilities the language server provides.
   */
  capabilities: ServerCapabilities;

  /**
   * Information about the server.
   *
   * @since 3.15.0
   */
  serverInfo?: {
    /**
     * The name of the server as defined by the server.
     */
    name: string;

    /**
     * The server's version as defined by the server.
     */
    version?: string;
  };
}

export interface ServerCapabilities {
  textDocumentSync?: TextDocumentSyncOptions | TextDocumentSyncKind;

  /**
   * The server provides completion support.
   */
  completionProvider?: CompletionOptions;
}

export interface TextDocumentSyncOptions {
  /**
   * Open and close notifications are sent to the server. If omitted open
   * close notifications should not be sent.
   */
  openClose?: boolean;

  /**
   * Change notifications are sent to the server. See
   * TextDocumentSyncKind.None, TextDocumentSyncKind.Full and
   * TextDocumentSyncKind.Incremental. If omitted it defaults to
   * TextDocumentSyncKind.None.
   */
  change?: TextDocumentSyncKind;
}

/**
 * Defines how the host (editor) should sync document changes to the language
 * server.
 */
export namespace TextDocumentSyncKind {
  /**
   * Documents should not be synced at all.
   */
  export const None = 0;

  /**
   * Documents are synced by always sending the full content
   * of the document.
   */
  export const Full = 1;

  /**
   * Documents are synced by sending the full content on open.
   * After that only incremental updates to the document are
   * sent.
   */
  export const Incremental = 2;
}

export type TextDocumentSyncKind = 0 | 1 | 2;

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
 * Completion options.
 */
export interface CompletionOptions {
  /**
   * The additional characters, beyond the defaults provided by the client (typically
   * [a-zA-Z]), that should automatically trigger a completion request. For example
   * `.` in JavaScript represents the beginning of an object property or method and is
   * thus a good candidate for triggering a completion request.
   *
   * Most tools trigger a completion request automatically without explicitly
   * requesting it using a keyboard shortcut (e.g. Ctrl+Space). Typically they
   * do so when the user starts to type an identifier. For example if the user
   * types `c` in a JavaScript file code complete will automatically pop up
   * present `console` besides others as a completion item. Characters that
   * make up identifiers don't need to be listed here.
   */
  triggerCharacters?: string[];

  /**
   * The list of all possible characters that commit a completion. This field
   * can be used if clients don't support individual commit characters per
   * completion item. See client capability
   * `completion.completionItem.commitCharactersSupport`.
   *
   * If a server provides both `allCommitCharacters` and commit characters on
   * an individual completion item the ones on the completion item win.
   *
   * @since 3.2.0
   */
  allCommitCharacters?: string[];

  /**
   * The server provides support to resolve additional
   * information for a completion item.
   */
  resolveProvider?: boolean;

  /**
   * The server supports the following `CompletionItem` specific
   * capabilities.
   *
   * @since 3.17.0
   */
  completionItem?: {
    /**
     * The server has support for completion item label
     * details (see also `CompletionItemLabelDetails`) when receiving
     * a completion item in a resolve call.
     *
     * @since 3.17.0
     */
    labelDetailsSupport?: boolean;
  };
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

export interface CompletionParams extends TextDocumentPositionParams {
  /**
   * The completion context. This is only available if the client specifies
   * to send this using the client capability
   * `completion.contextSupport === true`
   */
  context?: CompletionContext;
}

export interface CompletionContext {
  /**
   * How the completion was triggered.
   */
  triggerKind: CompletionTriggerKind;

  /**
   * The trigger character (a single character) that has trigger code
   * complete. Is undefined if
   * `triggerKind !== CompletionTriggerKind.TriggerCharacter`
   */
  triggerCharacter?: string;
}

export namespace CompletionTriggerKind {
  /**
   * Completion was triggered by typing an identifier (24x7 code
   * complete), manual invocation (e.g Ctrl+Space) or via API.
   */
  export const Invoked: 1 = 1;

  /**
   * Completion was triggered by a trigger character specified by
   * the `triggerCharacters` properties of the
   * `CompletionRegistrationOptions`.
   */
  export const TriggerCharacter: 2 = 2;

  /**
   * Completion was re-triggered as the current completion list is incomplete.
   */
  export const TriggerForIncompleteCompletions: 3 = 3;
}
export type CompletionTriggerKind = 1 | 2 | 3;

export interface CompletionList {
  /**
   * This list is not complete. Further typing should result in recomputing
   * this list.
   *
   * Recomputed lists have all their items replaced (not appended) in the
   * incomplete completion sessions.
   */
  isIncomplete: boolean;

  /**
   * The completion items.
   */
  items: CompletionItem[];
}

export interface CompletionItem {
  /**
   * The label of this completion item.
   *
   * The label property is also by default the text that
   * is inserted when selecting this completion.
   *
   * If label details are provided the label itself should
   * be an unqualified name of the completion item.
   */
  label: string;

  /**
   * Additional details for the label
   *
   * @since 3.17.0
   */
  // labelDetails?: CompletionItemLabelDetails;

  /**
   * The kind of this completion item. Based of the kind
   * an icon is chosen by the editor. The standardized set
   * of available values is defined in `CompletionItemKind`.
   */
  kind?: CompletionItemKind;

  /**
   * Tags for this completion item.
   *
   * @since 3.15.0
   */
  // tags?: CompletionItemTag[];

  /**
   * A human-readable string with additional information
   * about this item, like type or symbol information.
   */
  detail?: string;

  /**
   * A human-readable string that represents a doc-comment.
   */
  documentation?: string /*| MarkupContent*/;

  /**
   * Indicates if this item is deprecated.
   *
   * @deprecated Use `tags` instead if supported.
   */
  deprecated?: boolean;

  /**
   * Select this item when showing.
   *
   * *Note* that only one completion item can be selected and that the
   * tool / client decides which item that is. The rule is that the *first*
   * item of those that match best is selected.
   */
  preselect?: boolean;

  /**
   * A string that should be used when comparing this item
   * with other items. When omitted the label is used
   * as the sort text for this item.
   */
  sortText?: string;

  /**
   * A string that should be used when filtering a set of
   * completion items. When omitted the label is used as the
   * filter text for this item.
   */
  filterText?: string;

  /**
   * A string that should be inserted into a document when selecting
   * this completion. When omitted the label is used as the insert text
   * for this item.
   *
   * The `insertText` is subject to interpretation by the client side.
   * Some tools might not take the string literally. For example
   * VS Code when code complete is requested in this example
   * `con<cursor position>` and a completion item with an `insertText` of
   * `console` is provided it will only insert `sole`. Therefore it is
   * recommended to use `textEdit` instead since it avoids additional client
   * side interpretation.
   */
  insertText?: string;

  /**
   * The format of the insert text. The format applies to both the
   * `insertText` property and the `newText` property of a provided
   * `textEdit`. If omitted defaults to `InsertTextFormat.PlainText`.
   *
   * Please note that the insertTextFormat doesn't apply to
   * `additionalTextEdits`.
   */
  // insertTextFormat?: InsertTextFormat;

  /**
   * How whitespace and indentation is handled during completion
   * item insertion. If not provided the client's default value depends on
   * the `textDocument.completion.insertTextMode` client capability.
   *
   * @since 3.16.0
   * @since 3.17.0 - support for `textDocument.completion.insertTextMode`
   */
  // insertTextMode?: InsertTextMode;

  /**
   * An edit which is applied to a document when selecting this completion.
   * When an edit is provided the value of `insertText` is ignored.
   *
   * *Note:* The range of the edit must be a single line range and it must
   * contain the position at which completion has been requested.
   *
   * Most editors support two different operations when accepting a completion
   * item. One is to insert a completion text and the other is to replace an
   * existing text with a completion text. Since this can usually not be
   * predetermined by a server it can report both ranges. Clients need to
   * signal support for `InsertReplaceEdit`s via the
   * `textDocument.completion.completionItem.insertReplaceSupport` client
   * capability property.
   *
   * *Note 1:* The text edit's range as well as both ranges from an insert
   * replace edit must be a [single line] and they must contain the position
   * at which completion has been requested.
   * *Note 2:* If an `InsertReplaceEdit` is returned the edit's insert range
   * must be a prefix of the edit's replace range, that means it must be
   * contained and starting at the same position.
   *
   * @since 3.16.0 additional type `InsertReplaceEdit`
   */
  // textEdit?: TextEdit | InsertReplaceEdit;

  /**
   * The edit text used if the completion item is part of a CompletionList and
   * CompletionList defines an item default for the text edit range.
   *
   * Clients will only honor this property if they opt into completion list
   * item defaults using the capability `completionList.itemDefaults`.
   *
   * If not provided and a list's default range is provided the label
   * property is used as a text.
   *
   * @since 3.17.0
   */
  textEditText?: string;

  /**
   * An optional array of additional text edits that are applied when
   * selecting this completion. Edits must not overlap (including the same
   * insert position) with the main edit nor with themselves.
   *
   * Additional text edits should be used to change text unrelated to the
   * current cursor position (for example adding an import statement at the
   * top of the file if the completion item will insert an unqualified type).
   */
  // additionalTextEdits?: TextEdit[];

  /**
   * An optional set of characters that when pressed while this completion is
   * active will accept it first and then type that character. *Note* that all
   * commit characters should have `length=1` and that superfluous characters
   * will be ignored.
   */
  commitCharacters?: string[];

  /**
   * An optional command that is executed *after* inserting this completion.
   * *Note* that additional modifications to the current document should be
   * described with the additionalTextEdits-property.
   */
  // command?: Command;

  /**
   * A data entry field that is preserved on a completion item between
   * a completion and a completion resolve request.
   */
  data?: LSPAny;
}

export namespace CompletionItemKind {
  export const Text = 1;
  export const Method = 2;
  export const Function = 3;
  export const Constructor = 4;
  export const Field = 5;
  export const Variable = 6;
  export const Class = 7;
  export const Interface = 8;
  export const Module = 9;
  export const Property = 10;
  export const Unit = 11;
  export const Value = 12;
  export const Enum = 13;
  export const Keyword = 14;
  export const Snippet = 15;
  export const Color = 16;
  export const File = 17;
  export const Reference = 18;
  export const Folder = 19;
  export const EnumMember = 20;
  export const Constant = 21;
  export const Struct = 22;
  export const Event = 23;
  export const Operator = 24;
  export const TypeParameter = 25;
}

export type CompletionItemKind =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25;

export interface PrepareRenameParams extends TextDocumentPositionParams {}

export interface RenameParams extends TextDocumentPositionParams {
  /**
   * The new name of the symbol. If the given name is not valid the
   * request must return a [ResponseError](#ResponseError) with an
   * appropriate message set.
   */
  newName: string;
}

export interface WorkspaceEdit {
  /**
   * Holds changes to existing resources.
   */
  changes?: { [uri: DocumentUri]: TextEdit[] };
  /**
   * Depending on the client capability
   * `workspace.workspaceEdit.resourceOperations` document changes are either
   * an array of `TextDocumentEdit`s to express changes to n different text
   * documents where each text document edit addresses a specific version of
   * a text document. Or it can contain above `TextDocumentEdit`s mixed with
   * create, rename and delete file / folder operations.
   *
   * Whether a client supports versioned document edits is expressed via
   * `workspace.workspaceEdit.documentChanges` client capability.
   *
   * If a client neither supports `documentChanges` nor
   * `workspace.workspaceEdit.resourceOperations` then only plain `TextEdit`s
   * using the `changes` property are supported.
   */
  // documentChanges?: (
  // 	TextDocumentEdit[] |
  // 	(TextDocumentEdit | CreateFile | RenameFile | DeleteFile)[]
  // );
  /**
   * A map of change annotations that can be referenced in
   * `AnnotatedTextEdit`s or create, rename and delete file / folder
   * operations.
   *
   * Whether clients honor this property depends on the client capability
   * `workspace.changeAnnotationSupport`.
   *
   * @since 3.16.0
   */
  // changeAnnotations?: {
  // 	[id: string /* ChangeAnnotationIdentifier */]: ChangeAnnotation;
  // };
}

export interface TextEdit {
  /**
   * The range of the text document to be manipulated. To insert
   * text into a document create a range where start === end.
   */
  range: Range;

  /**
   * The string to be inserted. For delete operations use an
   * empty string.
   */
  newText: string;
}
