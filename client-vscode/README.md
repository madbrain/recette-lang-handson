# Recette Lang VSCode extension

This project is a simple VSCode Extension which starts the LSP Recette™ language server you are developing!

# Description

A VSCode Extension is a simple node project with dedicated configuration in `package.json`. This extension provides the following contributions:

- contribute a new language, which link a file extension to a language id
- contribute a new grammar for syntax coloring, this is not strictly needed but way cooler with!
- the extension code is first activated when a recette file is opened

The extension code simply starts a LSP client given the information provided in the `config.json` file.
