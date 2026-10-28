# slacubedemo — hello cube demo (SLA + sla_ecs + three.js)

A DEMO TEST, not an engine (yet): **sla_ecs** (ECS game logic, written in SLA) +
**three.js** (rendering) + the **SA JS target** (`sa build-js`) drive a cube
(two cubes in the browser page) to prove a minimal SLA program can drive
three.js rendering. This is the rebuilt demo: node-verified (T1–T4, ALL
CHECKS PASSED), served via Bun + the dev.cxu.lol tunnel.

## Architecture

- Game logic lives in `src/hello_cube.sla`: one `DynamicWorld<CubePos,
  CubeVel, CubeTime, CubeEvt>` world, one cube entity, one movement system
  (`pos += vel` per tick, `tick + 1` per tick).
- Bridge (JEV, confidence 1.0 each): **host-driven scalar accessors** — SLA
  never calls JS. The host (browser page or node harness) calls exported SLA
  functions (`cube_new`, `cube_tick`, `cube_x/y/z`, `cube_ticks`) and reads
  f64 scalars back. JS owns three.js objects; the ECS owns motion.
- Floats (JEV, confidence 1.0): **native f64 components** — no fixed-point
  hack. `CubePos`/`CubeVel` carry f64 fields.
- World persistence: SLA has no mutable top-level state (the parser rejects
  top-level `let`), but world values round-trip through JS as linear-memory
  pointers (bigint): `cube_new()` → pointer → `cube_tick(ptr)` /
  `cube_x(ptr)` works across calls.

## Two fixed bugs (kept, with the mechanism)

- `cube_ticks` panic (code 5001): `dynamic_world_get_resource` panics when
  no resource was ever inserted (the default passed to
  `dynamic_world_new` does not populate it). Fix: `cube_new` inserts
  `CubeTime{tick: 0}`, and the movement system re-inserts `tick + 1` each
  tick. (`increment_tick` bumps only the internal change tick, NOT the
  `Time` resource.)
- Resource re-insertion is safe: `resource_insert` overwrites
  (`resource.sla` test "resource replace overwrites value").

## Build, verify, run

```sh
scripts/build.sh                       # ESM build/hello_cube.mjs + CJS build/hello_cube.cjs
/content/slaengine/toolchain/node/bin/node scripts/verify_node.cjs   # T1–T4, ALL CHECKS PASSED
```

The browser page is `index.html`: two cubes (velocities 0.02 / 0.05
units/frame), a `requestAnimationFrame` loop that ticks each world once per
frame and copies ECS positions into `mesh.position`, a HUD (frame, ECS tick
counters, ECS x per cube), and a Reset button that recreates the worlds.
Serve with `scripts/serve.ts` (Bun, port 43111 (43110 is taken by the Colab infra cxu serve; do not use it), web root `/content` but
exposing only `/slaengine/*`, `/three.js/*`, `/build/*`; `/` maps to the
hello cube page).

## Deploy

Primary binding is the **dev.cxu.lol tunnel** (`get.sh`, frp client,
name `slaengine-hello-cube`, upstream 127.0.0.1:43111). A Cloudflare quick
tunnel was tried first and is edge-blocked (HTTP 403 from Cloudflare edge),
so it is not used. The public URL lives only while the
Colab machine and both processes (Bun serve + tunnel) stay up; Colab can
shut down at any time.

## Quirks (recorded, not hidden)

- `SA_PLUGIN_DEV=1` is REQUIRED for every build step: the sla frontend is a
  dev-mode plugin. Without it, `sa build-js` treats a `.sla` file as SA
  assembly (ForbiddenSyntax) and `sa sla ...` fails with SA-CLI-013. The
  `sa sla ...` verbs are deprecated ("language frontends are dispatched by
  file extension, so run the host verb directly") but keep working during
  the transition; `scripts/build.sh` uses the host `build-js` verb for JS
  and the plugin `sla build` verb for the `.sa` emission.
- `sa build-js` option order matters: options must follow the file
  (`--format cjs` before the file errors).
- ESM output exports user functions (`sla__cube_*`); in browsers `process`
  is undefined so `main()` does not auto-run on import (in node CJS,
  `require.main === module` guards it).
- The JS emitter prints negative i64 as wrapped u64; irrelevant here since
  positions are f64.
- The compiler emits `.sa` next to sources (`src/*.sa`, gitignored); the
  generated `.sa` must pass `sa check`.

## Versions

See `VERSIONS.md`.
