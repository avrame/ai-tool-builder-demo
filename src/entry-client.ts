import { render } from "@arrow-js/framework";
import { App } from "./App";
import { checkWebGPUSupport } from "./send-message";
import "./style.css";

// Check WebGPU support on startup
checkWebGPUSupport();

const root = document.getElementById("app");

if (!root) {
  throw new Error("Unable to find app root element.");
}

render(root, App());
