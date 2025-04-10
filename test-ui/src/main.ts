import express from "express";
import path from "path";
import { marked } from "marked";
import { startClient, stopClient } from "./lsp/client";
import { tests } from "./tests";

// startClient();

const app = express();

app.use(express.static("public"));
app.use(express.static("node_modules/bootstrap/dist"));
app.use(express.static("node_modules/bootstrap-icons/font"));

app.get("/start", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  startClient(
    (testResult) => {
      const message = {
        id: testResult.index,
        name: testResult.test.name,
        failed: testResult.failed,
        content: marked.parse(testResult.test.doc),
        context: testResult.context,
        errors: testResult.errors,
      };
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    },
    () => {
      const message = {
        end: true,
      };
      res.write(`data: ${JSON.stringify(message)}\n\n`);
      res.end();
    }
  );

  req.on("close", () => {
    stopClient();
    res.end();
  });
});

app.listen(3000);
console.log("listening on http://localhost:3000");
