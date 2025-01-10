import { Context, Hono, Next } from "hono";
import apiRoutes from "./api/index.ts";
import { serveStatic } from "hono/deno";

const app = new Hono();

const getBaseUrl = (url: string) => {
  const parsedUrl = new URL(url);
  return parsedUrl.origin;
};

app.get("/", (c) => {
  const baseUrl = getBaseUrl(c.req.url);

  return c.html(
    <main>
      <h1>Welcome to Saleor App!</h1>

      <p>Install app in Saleor using this manifest URL:</p>
      <code>{baseUrl + "/api/manifest"}</code>
    </main>,
  );
});

app.use(
  "/app/*",
  serveStatic({
    root: `${Deno.cwd()}/server/dist`,
    mimes: {
      js: "application/javascript", // Explicitly set the MIME type for .js files
    },
    precompressed: true,
    rewriteRequestPath: (path) => {
      return path.replace(/^\/app/, "");
    },
  }),
);

app.use(
  "/assets/*",
  serveStatic({
    root: `${Deno.cwd()}/server/dist`,
    mimes: {
      js: "application/javascript", // Explicitly set the MIME type for .js files
    },
    precompressed: true,
  }),
);

app.notFound((c) => {
  return c.html(
    <html>
      <body>
        <main>
          <h1>Not found</h1>
          <p>Requested page was not found</p>
        </main>
      </body>
    </html>,
  );
});

app.route("/api", apiRoutes);

Deno.serve({ port: 3000 }, app.fetch);
