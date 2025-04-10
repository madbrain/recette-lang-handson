# Links

- [Vite+Nodejs](https://dev.to/rxliuli/developing-and-building-nodejs-applications-with-vite-311n)
- https://github.com/rtfpessoa/diff2html
- https://github.com/kpdecker/jsdiff

```
const diff = Diff.createTwoFilesPatch("file", "file", oldText, newText);
Diff2Html.getPrettyHtml(diff,
    {inputFormat: 'diff', showFiles: false, matching: 'lines', outputFormat: 'side-by-side'}
);
```
