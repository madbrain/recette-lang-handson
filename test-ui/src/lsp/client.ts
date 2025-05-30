import {
  ChildProcess,
  ChildProcessWithoutNullStreams,
  spawn,
} from "child_process";
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
  InitializeResult,
  ServerCapabilities,
} from "./models";

import { TestClientHelper } from "./helper";
import { TestDescription, tests } from "../tests";

export class Client {
  diagnostics?: PublishDiagnosticsParams;
  severCapabilities: ServerCapabilities;

  constructor(
    private endpoint: JSONRPCEndpoint,
    private process: ChildProcess
  ) {
    endpoint.addListener("textDocument/publishDiagnostics", (d) => {
      this.diagnostics = d as PublishDiagnosticsParams;
    });
  }

  async initialize(): Promise<InitializeResult> {
    this.diagnostics = undefined;
    const response: InitializeResult = await this.endpoint.send("initialize", {
      processId: this.process.pid,
      capabilities: {
        textDocument: { rename: { prepareSupport: true } },
      },
      clientInfo: {
        name: "lsp-client-tester",
        version: "0.0.1",
      },
    });
    this.severCapabilities = response.capabilities;
    return response;
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
  errors: TestError[];
}

export type TestError =
  | { type: "diff"; diff: any }
  | { type: "simple"; message: string };

let process: ChildProcessWithoutNullStreams | null = null;

export async function startClient(
  testCallback: (r: TestResult) => void,
  endCallback: () => void
) {
  process = spawn(config.command, config.args, { cwd: config.cwd });
  process.stderr.on("data", (d) => {
    console.log("SERVER", d.toString());
  });
  const endpoint = new JSONRPCEndpoint(process.stdin, process.stdout);
  const client = new Client(endpoint, process);

  const helper = new TestClientHelper(client);

  await helper.initialize();

  let index = 0;
  for (let test of tests) {
    console.log("TEST", test.name);
    try {
      await test.run(helper);
      const context = helper.buildHtmlContext();
      testCallback({ index: index, failed: false, test, context, errors: [] });
    } catch (e) {
      const context = helper.buildHtmlContext();
      const errors: TestError[] = [];
      if (e.description && e.actual && e.expected) {
        errors.push({
          type: "diff",
          diff: helper.buildDiff(e.description, e.actual, e.expected),
        });
      } else {
        console.log("ERROR", e);
        let message = "";
        if (e.description) {
          message = e.description as string;
          if (e.emssage) {
            message = `${message}: ${e.message}`;
          }
        } else if (e.message) {
          message = e.message as string;
        }

        if (e.data) {
          message += ("\n" + e.data) as string;
        }

        errors.push({ type: "simple", message });
      }
      testCallback({
        index: index,
        failed: true,
        test,
        context,
        errors,
      });
    }
    // TODO client clean docs
    ++index;
  }
  endCallback();

  client.exit();
  stopClient();
}

export function stopClient() {
  if (process) {
    process.stdin.end(() => {});
    process.kill();
    process = null;
  }
}
