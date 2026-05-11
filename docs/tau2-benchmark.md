# Tau² Benchmark Guide

Use the official `tau2-bench` benchmark as a separate benchmark family from the
Chronicle MCP eval harness. The Tau² workflow lives under `benchmarks/tau2/`
and uses isolated wrapper scripts under `scripts/`.

## What This Adds

- A pinned checkout of the upstream `sierra-research/tau2-bench` repository in
  `benchmarks/tau2/vendor/tau2-bench`
- An isolated Python virtual environment in `benchmarks/tau2/.venv`
- Repo-local scripts for running Tau², summarizing results, ingesting full
  trajectories into Chronicle, and generating side-by-side benchmark reports
- A stable Chronicle event schema for Tau² run metadata, messages, tool calls,
  tool results, and scored outcomes

## Prerequisites

- `python3`
- network access for the initial Tau² clone and pip install
- `ANTHROPIC_API_KEY` set if you are using Anthropic models through Tau²
- a running Chronicle backend if you want to ingest Tau² runs into Chronicle

## Setup

```bash
scripts/setup-tau2-bench.sh
```

This clones the upstream repository at the pinned ref recorded in
`benchmarks/tau2/upstream.json`, creates `benchmarks/tau2/.venv`, and installs
Tau² in editable mode into that isolated environment.

## Run A Small Official Smoke Benchmark

Recommended smoke run shape:

- start with `retail` or `airline`
- use `1` trial
- keep concurrency at `1`
- keep the task count small while validating the local integration path

Example:

```bash
TAU2_DOMAIN=retail \
TAU2_NUM_TRIALS=1 \
TAU2_NUM_TASKS=1 \
TAU2_MAX_CONCURRENCY=1 \
TAU2_AGENT_LLM=claude-haiku-4-5-20251001 \
TAU2_USER_LLM=claude-haiku-4-5-20251001 \
scripts/run-tau2-bench.sh
```

Raw result files are written under `benchmarks/tau2/output/raw/` unless
`TAU2_SAVE_TO` is provided explicitly.

## Generate A Normalized Tau² Summary

The run wrapper calls the summary script by default. You can also generate or
regenerate summaries manually:

```bash
scripts/report-tau2-bench.sh benchmarks/tau2/output/raw/retail-*.json
```

Outputs:

- JSON summary in `benchmarks/tau2/output/summaries/`
- Markdown summary in `benchmarks/tau2/reports/`

The normalized Tau² summary preserves Tau²-native metrics such as `pass^k`
without forcing them into Chronicle MCP scenario semantics.

## Ingest Tau² Into Chronicle

Start the Chronicle backend first, then ingest one or more official Tau² result
files:

```bash
CHRONICLE_EVENTS_URL=http://localhost:8080 \
CHRONICLE_TAU2_ORG_ID=tau2-benchmark \
scripts/ingest-tau2-bench.sh benchmarks/tau2/output/raw/retail-*.json
```

The ingester writes a manifest to `benchmarks/tau2/output/ingestion/` unless
`TAU2_INGEST_MANIFEST` is provided.

### Chronicle Event Schema

The importer uses Chronicle's native `/v1/events/batch` and `/v1/event-links`
APIs and emits these event types:

| Topic | Event type | Purpose |
| --- | --- | --- |
| `run` | `tau2.run.imported` | top-level benchmark run metadata and upstream info |
| `task` | `tau2.task.definition` | task definition, user scenario, evaluation criteria, and initial state |
| `simulation` | `tau2.simulation.started` | task/trial/simulation start marker |
| `message` | `tau2.message.system` | system messages in the trajectory |
| `message` | `tau2.message.user` | user messages in the trajectory |
| `message` | `tau2.message.assistant` | agent messages in the trajectory |
| `tool` | `tau2.tool.call` | tool call name, arguments, requestor, and turn index |
| `tool` | `tau2.tool.result` | tool output, error flag, and tool call id |
| `simulation` | `tau2.simulation.completed` | reward, termination reason, and total cost |

Each ingested event includes entity refs that let Chronicle reconstruct a run by
domain, task, simulation, or trial:

- `benchmark_run`
- `benchmark_domain`
- `benchmark_task`
- `benchmark_simulation`
- `benchmark_trial`

The importer also creates Chronicle event links:

- `tau2.contains_task`
- `tau2.has_simulation`
- `tau2.sequence`
- `tau2.tool_response`

That gives Chronicle enough structure to query a full Tau² trajectory either by
timeline or by graph traversal.

## Build A Side-By-Side Benchmark Report

First save a Chronicle MCP benchmark JSON payload or stdout capture from the
existing Chronicle MCP comparison test. Then combine it with one or more Tau²
summary files:

```bash
CHRONICLE_BENCHMARK_FILE=/tmp/chronicle-mcp-comparison.json \
scripts/report-agent-benchmarks.sh \
  benchmarks/tau2/output/summaries/retail-smoke.summary.json
```

Optional environment variables:

- `TAU2_INGEST_MANIFESTS` as a colon-separated list of ingestion manifest files
- `BENCHMARK_REPORT_OUTPUT` to override the markdown report path
- `BENCHMARK_REPORT_JSON_OUTPUT` to override the JSON report path

The report keeps the families distinct:

- Chronicle MCP evals remain product-specific grounding/reasoning benchmarks
- Tau² remains an external domain benchmark
- ingested Tau² manifests show what Chronicle stored from the official run

## Script Reference

| Script | Purpose |
| --- | --- |
| `scripts/setup-tau2-bench.sh` | clone/update the official Tau² repo and install it in an isolated `.venv` |
| `scripts/run-tau2-bench.sh` | run the official Tau² CLI with repo-standard defaults |
| `scripts/report-tau2-bench.sh` | normalize raw Tau² result JSON into summary artifacts |
| `scripts/ingest-tau2-bench.sh` | ingest full Tau² trajectories and outcomes into Chronicle |
| `scripts/report-agent-benchmarks.sh` | generate a side-by-side Chronicle MCP vs Tau² report |

## Validated Smoke Run

The wrapper workflow was validated locally with an official Tau² `retail` smoke
run using:

- `TAU2_NUM_TASKS=1`
- `TAU2_NUM_TRIALS=1`
- `TAU2_AGENT_LLM=claude-haiku-4-5-20251001`
- `TAU2_USER_LLM=claude-haiku-4-5-20251001`

That run produced a normalized summary artifact at
`benchmarks/tau2/output/summaries/retail-smoke-live.summary.json`.
