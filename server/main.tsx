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

// app.get("/app", async (c) => {
//   const file = await Deno.open(`${Deno.cwd()}/client/dist/index.html`);
//   return c.body(file.readable);
// });

// app.use(
//   "/app/assets/*",
//   serveStatic({ root: `${Deno.cwd()}/client/dist/assets` }),
// );

app.get(
  "/app",
  serveStatic({ path: `${Deno.cwd()}/client/dist/index.html` }),
);

// app.get("/app", (c) => {
//   return c.html(
//     <html>
//       <head>
//         {import.meta.env.PROD
//           ? <script type="module" src="/static/client.js"></script>
//           : <script type="module" src="/client/index.tsx"></script>}
//       </head>
//       <body>
//         <div id="root"></div>
//       </body>
//     </html>,
//   );
// });

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
