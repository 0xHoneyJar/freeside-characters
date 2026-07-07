# docs

Documentation for freeside-characters. Start at [`AGENTS.md`](AGENTS.md) if
you're an agent working in this repo.

## Architecture & boundaries
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — substrate + character + delivery, full picture
- [`CIVIC-LAYER.md`](CIVIC-LAYER.md) — why substrate ≠ character (civic-layer doctrine)
- [`LAYERING.md`](LAYERING.md) — WHO×WHAT: the voice / CM-data membrane, and why we don't split repos early
- [`MCP-FEDERATION.md`](MCP-FEDERATION.md) — score-mcp + freeside_auth wiring

## Characters & voice
- [`CHARACTER-AUTHORING.md`](CHARACTER-AUTHORING.md) — adding a character to the umbrella
- [`MULTI-REGISTER.md`](MULTI-REGISTER.md) — per-character voice register locks
- [`EXPRESSION-TIMING.md`](EXPRESSION-TIMING.md) — when characters speak (cadence + event timing)

## Setup & deploy
- [`DISCORD-INTERACTIONS-SETUP.md`](DISCORD-INTERACTIONS-SETUP.md) — slash-command / interactions endpoint setup
- [`DISCORD-SETUP.md`](DISCORD-SETUP.md) — Discord application provisioning
- [`DEPLOY.md`](DEPLOY.md) — Railway / ECS deploy paths
- [`PURUPURU-DEPLOY.md`](PURUPURU-DEPLOY.md) — Purupuru guild deploy
- [`ONBOARDING-CUTOVER.md`](ONBOARDING-CUTOVER.md) — onboarding / verify cutover

## Observability
- [`trace-cli.md`](trace-cli.md) — local LLM trace inspection
- [`raindrop-workshop-setup.md`](raindrop-workshop-setup.md) — Raindrop Workshop setup

## Local dev
- [`EILEEN-LOCAL-SATOSHI.md`](EILEEN-LOCAL-SATOSHI.md) — local satoshi setup
- [`EILEEN-LOCAL-BEDROCK-SPLIT.md`](EILEEN-LOCAL-BEDROCK-SPLIT.md) — local Bedrock provider split

## Build-process history
Phase-gated design + gate/acceptance docs for two initiatives. Kept because code
cites them as `Authority:` provenance. Read the MVP entry in each; the rest are
gate history.
- [`recall-wedge/`](recall-wedge/) — Loa-Straylight cross-interface memory MVP → [`RECALL-WEDGE-MEMORY-MVP.md`](recall-wedge/RECALL-WEDGE-MEMORY-MVP.md)
- [`admission-wedge/`](admission-wedge/) — live-memory admission wedge → [`ADMISSION-WEDGE-MVP-DESIGN.md`](admission-wedge/ADMISSION-WEDGE-MVP-DESIGN.md)
