
# Links
- https://github.com/openlawlibrary/pygls/blob/main/examples/hello-world/README.md

# Install

```
python3 -m venv $PWD/env

source ./env/bin/activate

pip install -r requirements.txt

```

# Testing
- Neovim

```lua
vim.keymap.set('n', '<M-CR>', ':lua vim.lsp.buf.code_action()<CR>', { buffer = true, noremap = true })

vim.api.nvim_create_autocmd({ "BufEnter" }, {
  -- NB: You must remember to manually put the file extension pattern matchers for each LSP filetype
  pattern = { "*.rct" },
  callback = function()
    vim.lsp.start({
      name = "recette-lang-server",
      cmd = { "/home/llhours/Projects/LSP/asm-lsp/test-pnpm/server-python/env/bin/python3", "/home/llhours/Projects/LSP/asm-lsp/test-pnpm/server-python/server.py" },
      root_dir = vim.fs.dirname(vim.fs.find({ ".git" }, { upward = true })[1])
    })
  end,
})
```

