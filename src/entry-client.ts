import { render } from "@arrow-js/framework";
import { App } from "./App";
import { checkWebGPUSupport } from "./send-message";
import "./style.css";

// Global error handler to catch and display any JS errors
window.addEventListener("error", (e) => {
  console.error("Uncaught error:", e.error);
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<div style="padding:20px;color:#f88;background:#300;border-radius:8px;margin:16px;">
      <h2>Application Error</h2>
      <pre style="white-space:pre-wrap;">${e.error?.message || String(e.error)}</pre>
      <p>Check the browser console for details.</p>
    </div>`;
  }
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
});

// Check WebGPU support (non-blocking — app renders regardless)
checkWebGPUSupport().catch((err) => {
  console.warn("WebGPU check failed:", err);
});

const root = document.getElementById("app");

if (!root) {
  throw new Error("Unable to find app root element.");
}

render(root, App());
