package com.github.madbrain.recettelang;

import org.eclipse.lsp4j.jsonrpc.Launcher;
import org.eclipse.lsp4j.services.LanguageClient;

public class Main {
    public static void main(String[] args) {
        var server = new RecetteLangServer();
        var launcher = Launcher.createLauncher(server, LanguageClient.class, System.in, System.out);
        server.connect(launcher.getRemoteProxy());
        launcher.startListening();
    }
}
