# Q-01 — Backend engineering review

Reviewed on 2026-10-20. Scope: shared contracts, local HTTP/WebSocket security, runtime, Codex RPC adapter, SQLite persistence and workspace validation. No source edits, dependency installation or live model invocation by reviewer.

## Findings addressed during review

- Runtime previously mutated the live Run before a durable save, poisoning optimistic versions after a failed transaction. Updated commit stages a draft and publishes only after store.save succeeds.
- Workspace validation previously accepted an ancestor containing Agent Office. Updated check rejects containment in both directions.
- Recovery could interrupt a run owned by another process before a second listener failed with EADDRINUSE. Updated startup acquires a kernel-owned instance lock before recovery.
- Cancellation could return canceling while the final run later succeeded. Reproduced with an in-memory store blocked during reviewer success and a fake provider; no filesystem/model writes. Updated runtime guards final success and rechecks cancellation inside serialized transitions.
- Shell-written files could bypass the test-evidence gate when no fileChange item was emitted and the builder returned empty files/tests. Updated verifyBuild receives requireCheck=true for every workspace-write builder turn, conservatively requiring a reported check that matches an observed successful command even when no changed files were detected.

## Remaining limitations to describe accurately

1. `src/server/runtime.ts`, verifyBuild: matching a reported check to an observed exit-code-zero command verifies execution, not the semantic quality or coverage of the chosen check. Every workspace-write builder turn now requires this evidence, closing the previous shell-change detection bypass conservatively. The runtime still does not independently enumerate every changed file.
2. `src/server/codex.ts`, execute/connect: AbortSignal is attached after connect and does not cancel outstanding startup RPCs. Cancellation/shutdown during initialization or account/thread setup can wait for RPC timeouts. Add abort-aware startup or document delayed cancellation until shutdown completes.
3. Codex sandbox and human approvals are the security boundary for tool access. Prompts alone do not enforce forbidden command categories or credential-read restrictions. Avoid claiming stronger isolation than the provider actually supplies.

## Validation boundaries

The cancellation race was reproduced against the pre-fix compiled runtime using fake provider/store objects. The updated fixes were inspected in source; the integrator owns regression tests and the authorized live Codex integration test. This handoff does not assert an end-to-end live run passed.
