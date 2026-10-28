// Node verification for slaengine hello cube: every position must come
// from the ECS module — no hardcoded animation anywhere.
// Usage (from /content/slaengine): <node> scripts/verify_node.cjs
const path = require("path");
const m = require(path.join(__dirname, "..", "build", "hello_cube.cjs"));
const cube_new = m.sla__cube_new || m.cube_new;
const cube_tick = m.sla__cube_tick || m.cube_tick;
const cube_x = m.sla__cube_x || m.cube_x;
const cube_y = m.sla__cube_y || m.cube_y;
const cube_z = m.sla__cube_z || m.cube_z;
const cube_ticks = m.sla__cube_ticks || m.cube_ticks;
for (const [name, fn] of [
  ["cube_new", cube_new],
  ["cube_tick", cube_tick],
  ["cube_x", cube_x],
  ["cube_y", cube_y],
  ["cube_z", cube_z],
  ["cube_ticks", cube_ticks],
]) {
  if (typeof fn !== "function") {
    console.error(`MISSING EXPORT ${name}`);
    process.exit(1);
  }
}
let failures = 0;
function check(label, got, expect) {
  const g = Number(got);
  const ok = g === expect;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: got ${g}, expect ${expect}`);
  if (!ok) failures++;
}
// T1: initial x = 0; 10 ticks @0.5 -> x = 5.0, y = z = 0, ECS tick counter = 10.
let w = cube_new(0.5, 0, 0);
check("T1 initial x", cube_x(w), 0);
check("T1 y stays 0", cube_y(w), 0);
check("T1 z stays 0", cube_z(w), 0);
for (let k = 0; k < 10; k++) w = cube_tick(w);
check("T1 x after 10 ticks @0.5", cube_x(w), 5);
check("T1 tick counter", cube_ticks(w), 10);
// T2: different velocities -> different motion.
for (const [v, expect] of [
  [1.5, 15],
  [0.0, 0],
  [-0.5, -5],
]) {
  let a = cube_new(v, 0, 0);
  for (let k = 0; k < 10; k++) a = cube_tick(a);
  check(`T2 x @${v}`, cube_x(a), expect);
}
// T3: per-frame positions match ECS computation: x == 0.5*k for every k = 1..10.
let b = cube_new(0.5, 0, 0);
for (let k = 1; k <= 10; k++) {
  b = cube_tick(b);
  check(`T3 per-frame x == 0.5*${k}`, cube_x(b), 0.5 * k);
}
// T4: two interleaved worlds stay independent: @0.5 x6 -> 3.0, @1.5 x6 -> 9.0.
let A = cube_new(0.5, 0, 0);
let B = cube_new(1.5, 0, 0);
for (let k = 0; k < 6; k++) {
  A = cube_tick(A);
  B = cube_tick(B);
}
check("T4 world A @0.5 x6", cube_x(A), 3);
check("T4 world B @1.5 x6", cube_x(B), 9);
if (failures > 0) {
  console.error(`${failures} FAILURES`);
  process.exit(1);
}
console.log("ALL CHECKS PASSED");
