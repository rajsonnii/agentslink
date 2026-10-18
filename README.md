# 🦎 Agent Slink

> **Autonomous Self-Healing Infrastructure Agent for Live Applications**  
> *Like a gecko regrowing its tail, Slink finds the fault, repairs the code, and restores service.*

---

## 🎯 What is Agent Slink?

Agent Slink is a SaaS developer tool that continuously observes running applications, catches runtime errors and crashes in real-time, deduplicates incidents, and uses an AI repair agent to diagnose root causes, generate surgical patches, verify fixes in an isolated sandbox, open GitHub pull requests, and re-verify service recovery via a headless browser.

---

## 🏗️ Architecture

```
                               ┌───────────────────────────┐
                               │       Running App         │
                               └─────────────┬─────────────┘
                                             │
                       slink run -- <cmd>    │   HTTP / Web Ping
                       (stdout / stderr)     │   (Console / 5xx)
                                             ▼
                 ┌────────────────────────────────────────────────────────┐
                 │                   AGENT SLINK CORE                     │
                 │                                                        │
                 │  ┌──────────────────┐        ┌──────────────────────┐  │
                 │  │   Slink CLI      │        │  Synthetic Browser   │  │
                 │  │ (Process Runner) │        │   Watcher (Pings)    │  │
                 │  └────────┬─────────┘        └──────────┬───────────┘  │
                 │           │                             │              │
                 │           ▼                             ▼              │
                 │  ┌──────────────────────────────────────────────────┐  │
                 │  │          Slink API & Ingestion Engine            │  │
                 │  │   (Deduplication, Normalization, Fingerprinting) │  │
                 │  └──────────────────────────┬───────────────────────┘  │
                 │                             │                          │
                 │                             ▼                          │
                 │  ┌──────────────────────────────────────────────────┐  │
                 │  │                 Incident Engine                  │  │
                 │  │    (OPEN -> DIAGNOSING -> PATCHING -> VERIFYING) │  │
                 │  └──────────────────────────┬───────────────────────┘  │
                 └─────────────────────────────┼──────────────────────────┘
                                               │
                                               ▼
                               ┌──────────────────────────────┐
                               │       AI REPAIR AGENT        │
                               │  • Evidence Synthesis        │
                               │  • Git Context & Diff        │
                               │  • LLM Root-Cause Diagnosis  │
                               └──────────────┬───────────────┘
                                              │
                                              ▼
                               ┌──────────────────────────────┐
                               │   ISOLATED TEST SANDBOX      │
                               │  • Worktree / Temp Isolation │
                               │  • Apply Proposed Patch      │
                               │  • Execute Project Tests     │
                               └──────────────┬───────────────┘
                                              │
                              ┌───────────────┴───────────────┐
                       [Tests Pass]                    [Tests Fail]
                              │                               │
                              ▼                               ▼
                 ┌─────────────────────────┐     ┌─────────────────────────┐
                 │   GitHub Pull Request   │     │  Developer Diagnostics  │
                 │  • Branch: slink/fix-*  │     │  • Detailed RCA report  │
                 │  • Formatted RCA & Fix  │     │  • Sandbox test output  │
                 │  • Test Proof Evidence  │     │  • Manual next steps    │
                 └────────────┬────────────┘     └─────────────────────────┘
                              │
                    (Deploy Fix to Live App)
                              │
                              ▼
                 ┌─────────────────────────┐
                 │ Headless Browser Watch  │
                 │  • Re-checks target URL │
                 │  • Confirms HTTP 200    │
                 │  • Status -> RECOVERED  │
                 └─────────────────────────┘
```

---

## 📦 Monorepo Structure

| Package | Description |
| :--- | :--- |
| [`@slink/shared`](file:///Users/rajsoni/documents/intellarix/agentslink/packages/shared) | Shared domain models (`Incident`, `LogBatch`, `BrowserCheckEvidence`), Zod schemas, error normalizer & SHA-256 fingerprinting hasher. |
| [`@slink/cli`](file:///Users/rajsoni/documents/intellarix/agentslink/packages/cli) | Developer CLI executable (`slink run -- <cmd>`) with real-time log teeing, unbuffered terminal streaming, WebSocket and buffered HTTP chunk transport. |
| [`@slink/browser-watcher`](file:///Users/rajsoni/documents/intellarix/agentslink/packages/browser-watcher) | Headless browser monitoring engine (Playwright + HTTP engines) capturing console errors, failed network requests, DOM crash snippets, and screenshots. |
| [`@slink/agent`](file:///Users/rajsoni/documents/intellarix/agentslink/packages/agent) | AI Diagnostic & Sandbox Repair Engine with Git context gathering, LLM diagnostic reasoning, isolated test sandbox runner, GitHub PR creator, and developer investigation reporter. |
| [`@slink/api`](file:///Users/rajsoni/documents/intellarix/agentslink/services/api) | High-performance Fastify backend service with WebSocket log intake, Sentry-style error deduplication, incident lifecycle manager, and GitHub webhooks. |

---

## 🚀 Quick Start

### 1. Installation & Build

```bash
# Install dependencies across all workspaces
npm install

# Build all packages
npm run build
```

### 2. Run All Tests

```bash
# Run all unit and integration tests
npm test

# Run the complete end-to-end self-healing loop
npm run test:e2e
```

### 3. Using the Slink CLI

Wrap any development or production command with `slink run`:

```bash
# Node.js
slink run -- npm start

# Python
slink run -- python3 app.py

# Go
slink run -- go run main.go
```

The CLI will:
1. Stream all stdout/stderr directly to your terminal without buffering or delay (keeping colors and ANSI codes intact).
2. Connect to the Slink API over WebSocket (with automatic HTTP fallback).
3. Notify the Slink API immediately if an unexpected crash or non-zero exit code occurs.

---

## 🧪 The Self-Healing Lifecycle in Action

1. **Detection & Fingerprinting**: Slink normalizes incoming terminal stack traces and browser failures by stripping timestamps, UUIDs, memory addresses (`0x...`), and host ports, computing a deterministic 32-character fingerprint.
2. **Deduplication Safeguard**: Repeating error spikes increment `occurrenceCount` and refresh the incident timeline without triggering duplicate PRs or storming the AI agent.
3. **AI Diagnosis**: Context from recent git commits, diffs, and source code around the crash line is assembled and diagnosed by the LLM.
4. **Isolated Sandbox Verification**: The patch is applied inside an isolated scratch workspace and project tests are executed.
5. **Pull Request or Report**:
   - If tests **pass**: Opens a GitHub PR with the root cause explanation, patch diff, and sandbox verification output.
   - If tests **fail**: Generates a developer investigation report highlighting why the patch was rejected.
6. **Recovery Re-check**: Once deployed, the headless browser pings the live site to confirm HTTP 200 and absence of console errors, transitioning the incident to **`RECOVERED`**.
