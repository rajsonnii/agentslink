# 🦎 Deploying Agent Slink on Coolify VPS

This guide provides the exact step-by-step instructions to deploy Agent Slink on your VPS running [Coolify](https://coolify.io).

---

## 🏗️ Architecture on Coolify

Coolify will host:
1. **`api`** (`port 4000`): The Fastify backend, WebSocket log ingestion stream, incident deduplication engine, and AI diagnostic agent.
2. **`web`** (`port 3000`): The Next.js SaaS dashboard with real-time incident radar, AI RCA viewer, and 1-click healing.
3. **`postgres`** (`port 5432`): Persistent PostgreSQL 16 database for incidents, projects, and logs.
4. **Coolify Traefik Proxy**: Automatically routes public domains (e.g. `slink.yourdomain.com` and `slink-api.yourdomain.com`) and manages free Let's Encrypt SSL certificates.

---

## 🚀 Step-by-Step Deployment Guide

### Step 1: Connect Your Git Repository to Coolify

1. Open your Coolify Dashboard (e.g. `http://<your-vps-ip>:8000`).
2. Navigate to **Projects** -> Select your Project (or create one: `Agentslink`).
3. Click **+ New Resource**.
4. Select **Docker Compose**.
5. Choose **Git Based** and connect your GitHub repository containing the Agent Slink code.

---

### Step 2: Configure Docker Compose in Coolify

1. Under **Compose File Location**, select or enter:
   ```
   docker-compose.coolify.yml
   ```
2. Coolify will parse the services (`api`, `web`, `postgres`).

---

### Step 3: Configure Domains in Coolify

In Coolify's service settings:
- Under **`web` service**:
  - Set the domain: `https://slink.yourdomain.com`
  - Internal port: `3000`
- Under **`api` service**:
  - Set the domain: `https://slink-api.yourdomain.com`
  - Internal port: `4000`

> Coolify's built-in Traefik reverse proxy will automatically generate Let's Encrypt SSL certificates for both domains.

---

### Step 4: Add Environment Variables in Coolify UI

Under the **Environment Variables** tab in Coolify, add:

```env
# Database Credentials
POSTGRES_USER=slink
POSTGRES_PASSWORD=generate_a_secure_password_here
POSTGRES_DB=slink

# Public URLs
NEXT_PUBLIC_SLINK_API_URL=https://slink-api.yourdomain.com

# AI Repair Provider (OpenRouter - Affordable & High Performance)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
# Model: google/gemini-2.0-flash-001 (~$0.10/1M tokens) or deepseek/deepseek-chat
OPENROUTER_MODEL=google/gemini-2.0-flash-001

# Alternative Direct Providers (Optional if OPENROUTER_API_KEY is provided)
# GEMINI_API_KEY=your_gemini_api_key
# OPENAI_API_KEY=your_openai_api_key

# GitHub Integration (Optional for local test, required for automated GitHub PRs)
GITHUB_APP_ID=your_github_app_id
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

---

### Step 5: Click Deploy!

1. Click **Deploy** in the top-right corner of Coolify.
2. Coolify will:
   - Pull the latest code
   - Build the multi-stage Docker images (`docker/Dockerfile.api` and `docker/Dockerfile.web`)
   - Launch PostgreSQL with persistent data volume
   - Wait for healthy status checks
   - Attach domains and issue SSL certificates

---

## 💻 Connecting Developer Machines to Your Coolify Slink

Once deployed on your VPS, developers can connect their local apps to your Coolify-hosted Slink instance in seconds:

### 1. Initialize Project Config

Inside any project on a developer's machine:

```bash
npx @slink/cli init \
  --project my-awesome-app \
  --url https://slink-api.yourdomain.com
```

This generates a `.slink.json` in the project root:
```json
{
  "projectId": "my-awesome-app",
  "apiUrl": "https://slink-api.yourdomain.com",
  "autoHeal": true
}
```

### 2. Run Any App With Slink Monitoring

```bash
# Node.js
npx @slink/cli run -- npm run dev

# Python
npx @slink/cli run -- python3 main.py

# Go
npx @slink/cli run -- go run main.go
```

Logs will stream in real-time to your Coolify VPS API (`https://slink-api.yourdomain.com`), and if a bug or crash occurs, Agent Slink will diagnose the fault and open a PR while you watch from your dashboard at `https://slink.yourdomain.com`!
