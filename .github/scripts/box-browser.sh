#!/usr/bin/env bash
# Runs one browser smoke command. Usage: .github/scripts/box-browser.sh npm run smoke:x
#
# GitHub-hosted runners: runs the command unchanged.
# Self-hosted box runners (grokbot-box-mixmash and -2 share one 15 GB box with
# agent desktops and other repos' runners):
#  - Its own D-Bus session bus. The runners inherit an agent desktop's DISPLAY
#    and no DBUS_SESSION_BUS_ADDRESS, so WebKit autolaunched one bus on that X
#    display and every job on both runners attached to it. When the job that
#    started it ended, its cleanup killed the bus and the other runner's WebKit
#    died mid-smoke ("Target page, context or browser has been closed").
#    dbus-run-session gives this command a private bus that ends with it, and
#    DISPLAY is dropped so nothing can reach the desktop's X server (all
#    browsers here are headless).
#  - One mixmash browser smoke at a time across both runners (a box-wide flock),
#    so two SwiftShader WebGL suites never compete for RAM; that contention is
#    when "WebGL context could not be created ... BindToCurrentSequence failed"
#    appeared. Non-browser steps still run in parallel.
set -euo pipefail
if [ "${RUNNER_ENVIRONMENT:-}" != self-hosted ]; then
  exec "$@"
fi
lock=${MIXMASH_BROWSER_LOCK:-/tmp/mixmash-browser-ci.lock}
runtime=$(mktemp -d "${RUNNER_TEMP:-/tmp}/box-browser-xdg.XXXXXX")
chmod 700 "$runtime"
trap 'rm -rf "$runtime"' EXIT
unset DISPLAY DBUS_SESSION_BUS_ADDRESS WAYLAND_DISPLAY
export XDG_RUNTIME_DIR=$runtime
if ! flock -n "$lock" true 2>/dev/null; then
  echo "box-browser: another mixmash browser smoke holds $lock; waiting (up to 45 min)"
fi
start=$SECONDS
# -o: the lock stays with flock itself, so a browser that outlives the command
# cannot keep holding it.
status=0
flock -o -w 2700 -E 75 "$lock" dbus-run-session -- "$@" || status=$?
[ "$status" != 75 ] || echo "box-browser: gave up waiting for $lock after 45 min"
[ $((SECONDS - start)) -lt 2 ] || echo "box-browser: $* finished after $((SECONDS - start))s including lock wait (exit $status)"
exit "$status"
