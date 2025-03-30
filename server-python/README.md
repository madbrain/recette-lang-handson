
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
vim.keymap.set('n', '<M-CR>', vim.lsp.buf.code_action, { buffer = true, noremap = true })

vim.keymap.set('i', '<c-space>', '<c-x><c-o>')

vim.diagnostic.config({
  update_in_insert = true
})

vim.api.nvim_create_autocmd({ "BufEnter" }, {
  -- NB: You must remember to manually put the file extension pattern matchers for each LSP filetype
  pattern = { "*.rct" },
  callback = function()
    vim.lsp.start({
      name = "recette-lang-server",
      cmd = { "/home/llhours/Projects/LSP/recette-lang-handson/server-python/env/bin/python3", "/home/llhours/Projects/LSP/recette-lang-handson/server-python/server.py" },
      root_dir = vim.fs.dirname(vim.fs.find({ ".git" }, { upward = true })[1]),
      n_attach = function(client, bufnr)
        vim.lsp.completion.enable(true, client.id, bufnr, {
          autotrigger = false,
          --convert = function(item)
          --  return { abbr = item.label:gsub('%b()', '') }
          --end,
        })
      end
    })
  end,
})
```

