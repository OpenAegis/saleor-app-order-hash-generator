import {
  createAppRegisterHandler,
  createManifestHandler,
} from "@saleor/app-sdk/handlers/fetch-api";
import { Hono } from "hono";
import { saleorApp } from "../saleor-app.ts";
import webhookRotues from "./webhooks/index.ts";
import { orderCreatedWebhook } from "./webhooks/order-created.ts";

const app = new Hono();

app.get("/manifest", (c) =>
  createManifestHandler({
    async manifestFactory({ appBaseUrl }) {
      return {
        name: "Saleor App Template",
        tokenTargetUrl: `${appBaseUrl}/api/register`,
        appUrl: `${appBaseUrl}/app`,
        permissions: [
          "MANAGE_ORDERS",
        ],
        id: "saleor.app.hono",
        version: "0.0.1",
        webhooks: [
          orderCreatedWebhook.getWebhookManifest(appBaseUrl),
        ],
        extensions: [],
        author: "Jonatan Witoszek",
      };
    },
  })(c.req.raw));

app.post("/register", (c) =>
  createAppRegisterHandler({
    apl: saleorApp.apl,
  })(c.req.raw));

app.route("/webhooks", webhookRotues);

export default app;
