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

- Discover the LSP architecture and protocol
- Install dependencies
- Chose a target implementation language
- Using the provided tests, implement your own language server
- Test it with VSCode, Neovim or any LSP-compliant editor.

## Install dependencies

This project use [PNPM](https://pnpm.io/installation), it must be first installed globally.
And then run `pnpn install` to install all dependencies.

## Choose a Target plateform

run `pnpm run config` and select one of the following target plateform:

- Node
- Python
- Go
- Rust
- Java/Kotlin

this will produced the `config.json` configuration file.

## Start the testing client UI

Run `pnpm run start` to start the webserver which will drive all the tests and connect to http://localhost:3000

In the UI press **Start** and follow the tests.

## Use VSCode as client

Using your server in VSCode require an extension, a minimal extension is provided in `client-vscode` folder. Open the project with VSCode (`code client-vscode`) and then press `F5` to start a new VSCode instance hosting the extension. In this instance try to open a recette file from `examples` folder.

## Use NeoVim as client

Add the following configuration to NeoVim (`$HOME/.config/nvim/init.lua`):

```lua
vim.keymap.set('i', '<c-space>', '<c-x><c-o>')
vim.keymap.set('n', '<M-CR>', vim.lsp.buf.code_action, { buffer = true, noremap = true })

vim.diagnostic.config({
  update_in_insert = true
})

vim.api.nvim_create_autocmd({ "BufEnter" }, {
  pattern = { "*.rct" },
  callback = function()
    vim.lsp.start({
      name = "recette-lang-server",
      cmd = { <PATH AND ARGS FROM CONFIG.JSON> },
      root_dir = vim.fs.dirname(vim.fs.find({ ".git" }, { upward = true })[1]),
      n_attach = function(client, bufnr)
        vim.lsp.completion.enable(true, client.id, bufnr, {
          autotrigger = false,
        })
      end
    })
  end,
})
```

## Links

- [PNPM](https://www.codecapers.com.au/pnpm-workspaces/)
- [LSP Specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)
