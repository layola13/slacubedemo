# VERSIONS.md — slaengine rebuild (2026-10-28, after the fresh-boot wipe)

- sla_ecs: `1be020bec5c219fa7d53b76b551fc1c7514d8f0e` (branch `master`,
  re-cloned 2026-10-28; unchanged from the pre-wipe clone, so no version
  drift from sla_ecs)
- three.js: `68a2712f9d130e8e9813488228dfef3509920fb2` (branch `dev`,
  shallow clone 2026-10-28; package version `0.186.0`; referenced from
  `/content/three.js`, not duplicated)
- sci: `ef3032f444070c24624b843b2ee017ed73cc2b55` (used AS-IS from
  `/content/sa_all/sci`; NEVER pulled, NEVER modified — the build artifact
  `artifacts/sa_std/libsa_std.a` was restored after the build)
- sa binary: `0.1.8` (built from sci `ef3032f4` with default `zig build`,
  LLVM-C backend on, no `-Dllvm=false`, no `-p` output prefix)
- sa_plugin_sla: `754edb2f7efa714f7b0ae13c1ed39d4c09481fdf` (branch
  `master`; installed dev-mode from a project-local copy in
  `toolchain/sa_plugin_sla`; the shared checkout was never written)
- Go `1.27.2`, Zig `0.17.0`, LLVM `14.0.6`, Bun `1.4.4`, node `v22.19.0`
  (project toolchain, `toolchain/node`)

Generated artifacts (gitignored, not committed):

- `src/hello_cube.sa`: `sa check` ok, 6024 instructions
- `build/hello_cube.mjs` (665,218 bytes), `build/hello_cube.cjs`
  (667,342 bytes)
- node verification T1–T4: ALL CHECKS PASSED (see
  `scripts/verify_node.cjs`)

API drift during reconstruction: none in the used surface. `sla check`
passed on the first attempt; the movement-demo API (`dynamic_world_new`,
`spawn`, `insert_a/b`, `increment_tick`, `query_a_b`, `pair_write_a`,
`insert_resource`, `get_a`, `get_resource`, `entity_new`) is identical to
the pre-wipe tree. One toolchain-behavior note (not an API break): the
`sla` frontend now requires `SA_PLUGIN_DEV=1` for host-verb extension
dispatch (see README quirks).
