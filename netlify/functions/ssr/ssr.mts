import type { Context } from "@netlify/functions";
import fs from "node:fs/promises";
import path from "node:path";
import { renderPage } from "../../../src/entry-server";

const templatePath = path.join(process.cwd(), "dist/client/index.html");

export default async function handler(
  request: Request,
  context: Context,
): Promise<Response> {
  try {
    const template = await fs.readFile(templatePath, "utf-8");
    const url = new URL(request.url);
    const page = await renderPage(url.pathname + url.search);

    const html = template
      .replace("<!--app-head-->", page.head ?? "")
      .replace("<!--app-html-->", page.html)
      .replace("<!--app-payload-->", page.payloadScript ?? "");

    return new Response(html, {
      status: page.status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
      { status: 500 },
    );
  }
}
