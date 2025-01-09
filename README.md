# Saleor App Hono Deno Example

A lightweight Saleor app template leveraging Hono's ultrafast routing capabilities (under 14kB) and Deno for deployment.

## Demo

Experience the live demo at: *Add your live demo URL here*

## Overview

This template provides a foundation for building Saleor apps using the Hono framework, featuring:

- **Backend**: Hono-powered API routes for Saleor integration
- **Frontend**: Single Page Application (SPA) for Saleor Dashboard that uses React
- **Storage**: Deno KV as the Auth Persistence Layer (APL)

## Project Structure

```
├── src/              # Hono application and API routes
│   ├── deno-kv-apl.ts # Deno KV-based APL implementation
│   ├── main.tsx      # Main entry point for the app
│   ├── saleor-app.ts # Saleor app configuration
│   └── api/          # API routes and webhooks
│       ├── index.ts  # API route definitions
│       └── webhooks/ # Webhook handlers
├── client/           # Dashboard SPA components
├── graphql/          # GraphQL schema and queries
├── generated/        # Generated GraphQL types
└── deno.json         # Deno configuration and tasks
```

## Prerequisites

- [Deno](https://deno.land/) (latest version recommended)
- Saleor instance

## Installation

1. Clone the repository & install local npm dependencies:
   ```bash
   git clone https://github.com/your-repo/saleor-app-hono-deno-template.git
   cd saleor-app-hono-deno-template
   pnpm i
   ```

2. Fetch the Saleor GraphQL schema:
   ```bash
   pnpm run fetch-schema
   ```

3. Generate TypeScript types from the schema:
   ```bash
   pnpm run generate
   ```

## Development

Start the development server:
```bash
deno task start
```

The app will be available at `http://localhost:3000`.

## Configuration

### Environment Variables

The app requires certain environment variables for proper configuration:

- `APL`: Set to `deno` to use the Deno KV-based APL.
- Other sensitive data like API keys should be stored securely using Deno's environment management.

### Deno KV APL

This project implements a custom [APL (Auth Persistence Layer)](https://docs.saleor.io/developer/extending/apps/architecture/apl) using Deno KV. The APL handles:

- **Authentication tokens**: Securely stores app tokens per Saleor instance.
- **App configuration**: Persists app settings in Deno KV.
- **Multi-tenant support**: Manages data for multiple Saleor instances.

The implementation can be found in `src/deno-kv-apl.ts`.

#### KV Structure

The app uses the following KV structure:
```
{saleor_api_url} -> Authentication data
```

## Deployment

Deploying this app involves running it as a standalone server using Deno. You can serve it on any platform that supports Deno, such as:

1. **Deno Deploy**:
   - Push your code to a GitHub repository.
   - Connect your repository to [Deno Deploy](https://deno.com/deploy).
   - Configure your deployment settings.

2. **Self-hosted Deployment**:
   - Run the app on your server:
     ```bash
     deno run --allow-net --allow-env --unstable src/main.tsx
     ```

3. **Docker Deployment** (optional):
   - Create a Dockerfile with Deno support and deploy it to your preferred cloud provider.

## License

BSD-3-Clause
