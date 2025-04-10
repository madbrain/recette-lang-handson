import { ChildProcess, spawn } from "child_process";
import { JSONRPCEndpoint } from "./jsonRpcEndpoint";
import * as config from "../../../config.json";
import { DidOpenTextDocumentParams, PublishDiagnosticsParams } from "./models";

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
}

export interface TestResult {
  index: number;
  failed: boolean;
  test: TestDescription;
  context: string;
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
      testCallback({ index: index, failed: false, test, context });
    } catch (e) {
      console.log("ERROR", e.message, e.actual, e.expected);
      const context = helper.buildHtmlContext();
      testCallback({ index: index, failed: true, test, context });
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
