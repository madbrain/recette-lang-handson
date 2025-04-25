import { ChildProcess, spawn } from "child_process";
import { JSONRPCEndpoint } from "./jsonRpcEndpoint";
import * as config from "../../../config.json";
import {
  CompletionItem,
  CompletionList,
  CompletionParams,
  DidOpenTextDocumentParams,
  Range,
  PrepareRenameParams,
  PublishDiagnosticsParams,
  RenameParams,
  WorkspaceEdit,
} from "./models";

import { TestClientHelper } from "./helper";
import { TestDescription, tests } from "../tests";

export class Client {
  diagnostics: PublishDiagnosticsParams;

  constructor(
    private endpoint: JSONRPCEndpoint,
    private process: ChildProcess
  ) {
    endpoint.addListener("textDocument/publishDiagnostics", (d) => {
      this.diagnostics = d as PublishDiagnosticsParams;
    });
  }

  async initialize() {
    return await this.endpoint.send("initialize", {
      processId: this.process.pid,
      capabilities: {},
      clientInfo: {
        name: "lsp-client-tester",
        version: "0.0.1",
      },
    });
  }

  exit() {
    this.endpoint.notify("exit");
  }

  textdocumentDidOpen(params: DidOpenTextDocumentParams) {
    this.endpoint.notify("textDocument/didOpen", params);
  }

  textDocumentCompletion(params: CompletionParams) {
    return this.endpoint.send("textDocument/completion", params) as Promise<
      CompletionItem[] | CompletionList | null
    >;
  }

  textDocumentPrepareRename(params: PrepareRenameParams) {
    return this.endpoint.send("textDocument/prepareRename", params) as Promise<
      | Range
      | { range: Range; placeholder: string }
      | { defaultBehavior: boolean }
      | null
    >;
  }

  textDocumentRename(params: RenameParams) {
    return this.endpoint.send(
      "textDocument/rename",
      params
    ) as Promise<WorkspaceEdit | null>;
  }
}

export interface TestResult {
  index: number;
  failed: boolean;
  test: TestDescription;
  context: string;
  errors: { message: string; diff: any }[];
}

export async function startClient(
  testCallback: (r: TestResult) => void,
  endCallback: () => void
) {
  const controller = new AbortController();
  const { signal } = controller;
  const process = spawn(config.command, config.args, { signal });
  const endpoint = new JSONRPCEndpoint(process.stdin, process.stdout);
  const client = new Client(endpoint, process);

  const resp = await client.initialize();
  console.log("INIT", resp);

  const helper = new TestClientHelper(client);

  let index = 0;
  for (let test of tests) {
    console.log("TEST", test.name);
    try {
      await test.run(helper);
      const context = helper.buildHtmlContext();
      testCallback({ index: index, failed: false, test, context, errors: [] });
    } catch (e) {
      const context = helper.buildHtmlContext();
      const diff = helper.buildDiff(e.description, e.actual, e.expected);
      testCallback({
        index: index,
        failed: true,
        test,
        context,
        errors: [diff],
      });
    }
    // TODO client clean docs
    ++index;
  }
  endCallback();

  client.exit();
  // controller.abort(); TODO abort not working
}

export function stopClient() {
  console.log("TODO stop client");
}
