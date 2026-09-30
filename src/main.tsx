import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// As duas janelas usam a mesma aplicação. O parâmetro muda apenas a apresentação;
// os comandos Rust e o arquivo SQLite são compartilhados.
const overlay =
  new URLSearchParams(window.location.search).get("overlay") === "1";
document.documentElement.classList.toggle("overlay-document", overlay);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App overlay={overlay} />
  </React.StrictMode>,
);
