import * as path from "path";
import { ExtensionContext } from "vscode";
import { readFileSync } from "fs";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

function createServer(context: ExtensionContext): ServerOptions {
  const config = JSON.parse(
    readFileSync(context.asAbsolutePath("../config.json"), "utf-8")
  );
  if (config.command === "server-node") {
    const serverModule = context.asAbsolutePath(
      path.join("..", "server-node", "out", "server.js")
    );
    return {
      run: { module: serverModule, transport: TransportKind.ipc },
      debug: {
        module: serverModule,
        transport: TransportKind.ipc,
      },
    };
  }
  return {
    command: config.command,
    args: config.args,
    options: {
      cwd: config.cwd,
    },
  };
}

export function activate(context: ExtensionContext) {
  const serverOptions = createServer(context);

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "recette" }],
  };

  client = new LanguageClient(
    "recette-lang-server",
    "Recette Language Server",
    serverOptions,
    clientOptions
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
