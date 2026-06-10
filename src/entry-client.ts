import { render } from "@arrow-js/framework";
import { App } from "./App";
import "./style.css";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Unable to find app root element.");
}

render(root, App());
