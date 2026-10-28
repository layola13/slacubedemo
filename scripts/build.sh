#!/usr/bin/env bash
# Build slaengine hello cube: SLA -> SA -> JS via the SA JS target.
# Produces src/hello_cube.sa (gitignored), ESM build/hello_cube.mjs (browser)
# + CJS build/hello_cube.cjs (node verification).
# NOTES:
# - SA_PLUGIN_DEV=1 is REQUIRED: the sla frontend is a dev-mode plugin and
#   the host verbs dispatch .sla files by extension only with it set.
#   Without it, `sa build-js` treats the .sla as SA assembly and fails with
#   ForbiddenSyntax, and `sa sla ...` fails with SA-CLI-013 unknown command.
# - sa build-js option order matters: options must follow the file
#   (--format cjs before the file errors).
# - sa build-js prints a non-fatal zig stack trace on stderr yet produces
#   correct output.
set -euo pipefail
cd "$(dirname "$0")/.."
export SA_STD_DIR=/content/sa_all/sci/sa_std
export SA_PLUGIN_DEV=1
SA=/content/sa_all/sci/zig-out/bin/sa
"$SA" sla build src/hello_cube.sla --out src/hello_cube.sa
"$SA" check src/hello_cube.sa
"$SA" build-js src/hello_cube.sla -o build/hello_cube.mjs
"$SA" build-js src/hello_cube.sla --format cjs -o build/hello_cube.cjs
echo "built: src/hello_cube.sa build/hello_cube.mjs build/hello_cube.cjs"
