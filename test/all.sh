#!/bin/sh
# Every check, in one command. Run this before any deploy.
#   sh test/all.sh
cd "$(dirname "$0")/.."
fail=0
for t in permissions guard notifications; do
  out=$(node "test/$t.test.js" 2>&1) || fail=1
  printf '%-14s %s\n' "$t" "$(printf '%s' "$out" | tail -1)"
  printf '%s' "$out" | grep '  FAIL' && fail=1
done
[ $fail -eq 0 ] && echo "\nall green" || echo "\nSOMETHING FAILED - do not deploy"
exit $fail
