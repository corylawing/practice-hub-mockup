#!/bin/sh
# Every check, in one command. Run this before any deploy.
#   sh test/all.sh
cd "$(dirname "$0")/.."
fail=0
for t in permissions peoplekey roster guard notifications sync theme feedback docs docsearch wordpdf tc tcstore sandboxwb layout sensitive prodbook prodstore prodswitch prodfx prodplan proddays prodoffices schedsplit schedcounts meetings push signin paystore payrules payremind payadds payentered paydibs paystripes payholidays payoffices payspecial payrates paytogether paydoctors payflags picker newhires adminsure alerts chat chatv2 chatgroups chatinstant chatlists fbreply usage loading; do
  out=$(node "test/$t.test.js" 2>&1) || fail=1
  printf '%-14s %s\n' "$t" "$(printf '%s' "$out" | tail -1)"
  printf '%s' "$out" | grep '  FAIL' && fail=1
done
[ $fail -eq 0 ] && echo "\nall green" || echo "\nSOMETHING FAILED - do not deploy"
exit $fail
