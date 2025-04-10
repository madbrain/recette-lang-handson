import express from "express";
import path from "path";
import { startClient } from "./lsp/client";

startClient();

// const app = express();

// app.set("views", path.join(__dirname, "views"));
// app.set("view engine", "ejs");

// app.get("/", function (req, res, next) {
//   res.render("index", {
//     title: "Users",
//     // count: count,
//     // users: users.filter(ferrets),
//   });
// });

// app.listen(3000);
// console.log("listening on http://localhost:3000");
