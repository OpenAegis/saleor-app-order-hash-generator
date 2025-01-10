# Saleor App Hono Deno Example

A lightweight Saleor app template leveraging Hono's ultrafast routing capabilities (under 14kB) and Deno for runtime and deployment.

> [!CAUTION]
> This example uses unreleased features of `@saleor/app-sdk`

## Overview

This template provides a foundation for building Saleor apps using the Hono framework and Deno, featuring:

- **Backend**: Hono-powered API routes for Saleor integration.
- **Frontend**: A Single Page Application (SPA) built with React, served at the `/app` route, and rendered within the Saleor Dashboard.
- **Storage**: Deno KV as the Auth Persistence Layer (APL).

## How It Works

1. **Frontend SPA**: 
   - The SPA is built using Vite and React. It is located in the `client/` directory.
   - The built files are output to the `server/dist/` directory.
   - The SPA is served at the `/app` route by Hono and displayed within the Saleor Dashboard after installing the app.

2. **Backend API**:
   - Hono serves as the backend framework, providing routes for API endpoints, webhooks, and static assets.
   - The backend handles app registration with Saleor, webhook processing, and authentication using a custom Deno KV-based APL implementation.

## Project Structure

```
├── client/           # Frontend SPA for Saleor Dashboard
│   ├── index.html    # Entry point for Vite
│   └── src/          # React components
├── server/           # Backend API powered by Hono
│   ├── main.tsx      # Entry point for the server
│   ├── deno-kv-apl.ts # Deno KV-based APL implementation
│   └── api/          # API routes and webhooks
├── graphql/          # GraphQL schema and queries
├── generated/        # Generated GraphQL types
├── deno.json         # Deno configuration and tasks
└── vite.config.ts    # Vite configuration for building the SPA
```

## Prerequisites

- [Deno](https://deno.land/) (latest version recommended)
- A running Saleor instance

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/witoszekdev/saleor-app-hono-deno-template.git
   cd saleor-app-hono-deno-template
   ```

2. Install dependencies:
   ```bash
   deno install
   ```

3. Fetch the Saleor GraphQL schema:

> [!NOTE]
> This command has to be run either through `pnpm` or `npm` because it relies on specific package.json feature for getting Saleor schema version

   ```bash
   pnpm run fetch-schema
   # or
   npm run fetch-schema
   ```

4. Generate TypeScript types from the schema:
   ```bash
   deno task generate
   ```

## Development

### Building the Frontend SPA

The SPA is built using Vite. To build it:

```bash
deno task build
```

This will generate static files in the `server/dist/` directory.

### Running the Server

Start the server with:

```bash
deno task server:start
```

The app will be available at `http://localhost:3000`.

## Configuration

### Environment Variables

Set up environment variables as needed:

- `APL`: Set to `deno` to use Deno KV-based APL.
- Other sensitive data like API keys should be managed securely using Deno's environment management.

### Customizing Routes

The SPA is served at `/app`, but you can modify this route in `server/main.tsx`. Update the `serveStatic` configuration as needed and `api/manifest` implementation.

## Deployment

You can deploy this app using any platform that supports Deno:

1. **Deno Deploy**:
   - Push your code to a GitHub repository.
   - Connect your repository to [Deno Deploy](https://deno.com/deploy).
   
2. **Self-hosted Deployment**:
   - Run on your server:
     ```bash
     deno run --allow-net --allow-env --unstable-kv ./server/main.tsx
     ```

3. **Docker Deployment** (optional):
   - Create a Dockerfile with Deno support and deploy it to your preferred cloud provider.
