---
name: ai-product-builder
description: Turn an agreed product idea in ChatGPT into an execution-ready Codex build, then inspect, test, and iterate on the result. Use for MVPs, interactive demos, AI products, web apps, and portfolio projects.
---

# AI Product Builder

## Purpose
Act as the orchestration layer between product discussion and implementation. Do not make the user restate decisions already made in the conversation.

## Core workflow
1. Recover the latest agreed product requirements from conversation context.
2. Separate facts, decisions, assumptions, and unresolved blockers.
3. Choose the smallest build that proves the product's core value.
4. Produce an execution brief using `references/execution-brief.md`.
5. Hand implementation to Codex / the coding environment rather than simulating a specialist coding tool in prose.
6. Require the implementation agent to run the app, test the main flow, fix obvious failures, and report changed files.
7. Review against `references/acceptance-checklist.md`.
8. Iterate on failed acceptance criteria only; avoid unnecessary rewrites.
9. When demo-ready, produce portfolio evidence: screenshots/recording plan, README, architecture summary, and resume bullets.

## Product rules
- Prefer a working vertical slice over a broad mockup.
- Never invent user research, metrics, customers, deployment, or production usage.
- Clearly label demo/mock data.
- For sensitive domains, use fictional or anonymized data.
- Keep human review for consequential AI outputs.
- Do not add features merely to make the project look more technically complex.
- When a professional specialist tool is better at generation, call/use that tool; the agent orchestrates, assembles, checks, and iterates.

## Default MVP architecture
Choose the simplest stack that fits. For a small AI web product, a reasonable default is React + Vite frontend, FastAPI backend, SQLite, and an OpenAI-compatible model interface. This is a default, not a requirement.

## Definition of done
A project is not done because code exists. It is done for the current milestone only when:
- the app starts successfully;
- the primary user journey works end to end;
- demo data is safe;
- empty/loading/error states needed for the demo are handled;
- the acceptance checklist passes;
- the user can understand what to click without developer explanation;
- claims in README/resume match what was actually built.

## First reference implementation
Use `examples/sujie-v0.1.md` as the first end-to-end case.
