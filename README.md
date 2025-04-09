
# Recette Language Hands'on

Imagine being a software engineer at CookMaster which produce the TurboMix 2000 able to automatically
execute whatever recipes you give it. Well almost... Writing the recipes have to follow some rules
comparable to a real programming language or the machine will spit garbages. But your boss want anybody
to be able to write a recipe and charge you to design a system to help people achieve this goal.

Here comes the magic of [LSP](https://en.wikipedia.org/wiki/Language_Server_Protocol),
which will allow you to add support for this new language in any supporting text-editor.

The goal of our LSP server will be to:
- report errors instantly
- allows user to complete words (as verbs, ingredients, etc.)
- allows to rename ingredients globbaly in the recipe

In LSP terms, we will implement diagnostics, completion and rename features.

## Menu
- discover the LSP architecture and protocol
- chose a target implementation language
- using the provided tests, implement your own language server
- test it with VSCode, Neovim or any LSP-compliant editor.

## Targets
- Node
- Python
- Go
- Rust
- Java/Kotlin

## Links
- [PNPM](https://www.codecapers.com.au/pnpm-workspaces/)
