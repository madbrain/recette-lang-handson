import { startClient } from "./client";

startClient(r => {
    console.log("TEST", r)
}, () => {
    console.log("END")
})