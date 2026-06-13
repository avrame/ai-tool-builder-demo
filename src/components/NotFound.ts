import { component, html } from "@arrow-js/core";

export const NotFound = component((props: { path: string }) => {
  return html`<main>
    <h1>404 - Not Found</h1>
    <p>No route for <code>${() => props.path}</code></p>
  </main>`;
});
