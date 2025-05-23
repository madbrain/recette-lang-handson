import { writeFileSync } from "fs";
import { resolve } from "path";
import { select } from "@inquirer/prompts";

select({
  message: "Hello, choose the language server framework",
  choices: [
    { name: "NodeJS", value: "node-js" },
    { name: "Python", value: "python" },
    { name: "Rust", value: "rust" },
    { name: "Go", value: "go" },
    { name: "Kotlin", value: "kotlin" },
  ],
}).then((answer) => {
  let config: any = {};
  const projectRoot = resolve(__dirname, "../..");
  switch (answer) {
    case "python":
      {
        const pythonRoot = resolve(projectRoot, "server-python");
        config.cwd = pythonRoot;
        config.command = resolve(pythonRoot, "env/bin/python3");
        config.args = [resolve(pythonRoot, "server.py")];
      }
      break;
    case "kotlin":
      {
        const kotlinRoot = resolve(projectRoot, "server-kotlin");
        config.cwd = kotlinRoot;
        config.command = resolve(kotlinRoot, "gradlew");
        config.args = ["--console=plain", "--quiet", "run"];
      }
      break;
    case "rust":
      {
        const kotlinRoot = resolve(projectRoot, "server-rust");
        config.cwd = kotlinRoot;
        config.command = "cargo";
        config.args = ["-q", "run"];
      }
      break;
    case "node-js":
      {
        config.command = "server-node";
      }
      break;
    default:
      throw new Error(`TODO: unsupported server type`);
  }
  writeFileSync("../config.json", JSON.stringify(config));
});
