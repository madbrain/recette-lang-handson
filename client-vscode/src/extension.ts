import * as path from "path";
import { ExtensionContext } from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

function createNodeServer(context: ExtensionContext): ServerOptions {
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

function createPythonServer(): ServerOptions {
  return {
    command:
      "/home/ludo/Projects/LSP/recette-lang-handson/server-python/env/bin/python3",
    args: [
      "/home/ludo/Projects/LSP/recette-lang-handson/server-python/server.py",
    ],
    // options: {
    //   cwd: "/home/ludo/tmp/LSP/asm-lsp-server",
    // },
  };
}

export function activate(context: ExtensionContext) {
  //   const serverOptions = createNodeServer(context);
  const serverOptions = createPythonServer();

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
