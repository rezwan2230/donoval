#!/usr/bin/env bash
# SHELDON-PERCH-A03 — grep cross-check for RE-INIT-INVENTORY.md (#48).
#
# Two directions, per the ticket's acceptance criteria:
#   DIR-1  doc -> code: no command named in the doc is absent from source.
#   DIR-2  code -> doc: no on-load binding in source is absent from the doc.
#
# Read-only. Touches no runtime file. Run from donovan-legal-site/:
#     bash scripts/verify-reinit-inventory.sh
#
# Exit 0 = inventory and code agree. Exit 1 = drift; the failing row is printed.

set -uo pipefail
cd "$(dirname "$0")/.."

DOC=RE-INIT-INVENTORY.md
fail=0
pass=0

ok()   { printf '  PASS  %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  FAIL  %s\n' "$1"; fail=$((fail+1)); }

# expect_ge <label> <actual> <minimum>
expect_ge() {
  if [ "$2" -ge "$3" ]; then ok "$1 ($2 >= $3)"; else bad "$1 (got $2, want >= $3)"; fi
}
# expect_eq <label> <actual> <expected>
expect_eq() {
  if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1 (got $2, want $3)"; fi
}

[ -f "$DOC" ] || { echo "FATAL: $DOC not found"; exit 1; }

echo "== DIR-1  doc -> code : every command in the doc exists in source =="

# Commands the doc names, and the files that must contain them.
check_sym() { # <symbol> <file...>
  local sym="$1"; shift
  grep -q -- "$sym" "$DOC" || { bad "doc does not mention $sym"; return; }
  local hits; hits=$(grep -rl -- "$sym" "$@" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$hits" -gt 0 ]; then ok "$sym -> $hits source file(s)"; else bad "$sym named in doc, ABSENT from code"; fi
}

check_sym booking_prefill      perch-inject.js perch.html functions/fn/do_page_action.js
check_sym booking_select_slot  perch-inject.js perch.html functions/fn/do_page_action.js
check_sym booking_select_type  perch-inject.js perch.html functions/fn/do_page_action.js
check_sym booking_show_date    perch-inject.js perch.html functions/fn/do_page_action.js
check_sym set_call_id          perch-inject.js perch.html
check_sym open_qualifier       perch.html functions/fn/do_page_action.js functions/fn/get_page_actions.js
check_sym "perch:ready"        perch-inject.js perch.html
check_sym __perchBookingAck    js/booking-widget.js perch.html
check_sym __perchBooking       js/booking-widget.js perch.html
check_sym __perchCallId        js/booking-widget.js
check_sym donovan_booking_unlock perch.html book.html
check_sym donovan_orb_pos      perch.html
check_sym donovan_vid          perch.html
check_sym dvn_widget_pos       js/donovan-widget.js
check_sym __vantage            perch.html js/donovan-widget.js
check_sym "vantage:call-start" perch.html js/donovan-widget.js
check_sym "vantage:call-end"   perch.html js/donovan-widget.js
check_sym data-dvn-on          js/inline-actions.js
check_sym DonovanInputFormatter js/tool-input-formatter.js

# Every /fn/ endpoint the doc lists must exist as a file.
for ep in do_page_action get_page_actions get_availability qualifier_result booking_result \
          save_lead take_message page-poll qualifier_submit booking_confirmed; do
  if grep -q "fn/$ep" "$DOC" && [ -f "functions/fn/$ep.js" ]; then ok "/fn/$ep exists"
  else bad "/fn/$ep — doc/code mismatch"; fi
done

echo
echo "== DIR-1b  the doc must NOT assert anything absent from code =="

# C1: swup is claimed by the OLD spec. The inventory must call it non-existent,
# and it must in fact be absent from every executable file.
swup_code=$(grep -rl "swup" --include=*.js --include=*.html --include=*.json . 2>/dev/null | wc -l | tr -d ' ')
expect_eq "swup absent from all executable files (C1)" "$swup_code" "0"

# C8: GA4 must be absent from code, and the doc must label it NOT YET IN CODE.
ga_code=$(grep -rn "gtag(\|googletagmanager\|dataLayer" --include=*.html --include=*.js . 2>/dev/null | wc -l | tr -d ' ')
expect_eq "GA4 absent from code (C8)" "$ga_code" "0"
if grep -q "NOT YET IN CODE" "$DOC"; then ok "doc labels GA4 NOT YET IN CODE"; else bad "doc must label GA4 NOT YET IN CODE"; fi

echo
echo "== DIR-2  code -> doc : every binding in source is in the doc =="

# 2.3 — perch-protocol commands.
for c in navigate scroll highlight scrollby booking_prefill booking_select_slot \
         booking_select_type booking_show_date set_call_id; do
  grep -q "d.cmd === '$c'" perch-inject.js || { bad "perch cmd '$c' vanished from perch-inject.js"; continue; }
  grep -q "\`$c\`" "$DOC" || grep -q "$c" "$DOC" || { bad "perch cmd '$c' in code, ABSENT from doc"; continue; }
  ok "perch cmd '$c'"
done
n=$(grep -c "d.cmd === '" perch-inject.js); expect_eq "perch cmd count" "$n" "9"

# 2.4 — dl-booking bridge actions.
for a in prefill selectType selectSlot showDate setCallId; do
  grep -q "action === '$a'" js/booking-widget.js || { bad "dl-booking action '$a' vanished"; continue; }
  grep -q "$a" "$DOC" || { bad "dl-booking action '$a' in code, ABSENT from doc"; continue; }
  ok "dl-booking action '$a'"
done

# 2.2 — bridge action keys. Every ACTION_MAP key must be listed in the doc.
keys=$(sed -n '96,115p' functions/fn/do_page_action.js | grep -o '^\s*[a-z_]*:\|[ {]\([a-z_]\+\): {' \
       | grep -o '[a-z_]\+' | grep -v '^cmd$' | grep -v '^target$' | sort -u)
missing=0
for k in $keys; do grep -q "$k" "$DOC" || { bad "ACTION_MAP key '$k' ABSENT from doc"; missing=1; }; done
[ "$missing" -eq 0 ] && ok "all ACTION_MAP keys present in doc"
nkeys=$(printf '%s\n' $keys | wc -l | tr -d ' ')
expect_eq "ACTION_MAP static key count" "$nkeys" "34"

# get_page_actions advertises 34 static + open_qualifier = 35, and omits the 4 booking_*.
nadv=$(sed -n '14,22p' functions/fn/get_page_actions.js | grep -o "'[a-z_]*'" | wc -l | tr -d ' ')
expect_eq "get_page_actions advertised key count" "$nadv" "35"
nbook=$(sed -n '14,22p' functions/fn/get_page_actions.js | grep -c "booking_" || true)
expect_eq "booking_* keys unadvertised (documented gap)" "$nbook" "0"

# 2.5 — upward messages.
for m in "perch:ready" "__perchBookingAck" "__perchBooking"; do
  grep -q "$m" perch.html && grep -q "$m" "$DOC" && ok "upward msg $m" || bad "upward msg $m drift"
done

# 3.1 — every element-bound jQuery handler in main.js must be a doc row.
for sel in '.dropdown' '.hamburger' 'btn-close.menu' 'btn-tf' 'btn-tp' 'theFirm' \
           'thePractice' 'img-hover' 'mobile-hover' 'cmm-logo-hover' 'a.marker' 'pin-popup'; do
  grep -q -- "$sel" js/main.js || { bad "main.js binding '$sel' vanished"; continue; }
  grep -q -- "$sel" "$DOC" || { bad "main.js binding '$sel' in code, ABSENT from doc"; continue; }
  ok "main.js binding '$sel'"
done

# main.js must still be in perch-router's SKIP list (correction C9 depends on it).
grep -q "main\\\\.js" js/perch-router.js && ok "main.js still in perch-router SKIP (C9)" \
  || bad "perch-router SKIP no longer lists main.js — C9 is stale"

# 3.2 — booking widget boot seams.
grep -q "data-api-init" js/booking-widget.js && grep -q "data-api-init" "$DOC" \
  && ok "widget [data-api-init] idempotence seam" || bad "widget idempotence seam drift"
grep -q "dl-booking-styles" js/booking-widget.js && grep -q "dl-booking-styles" "$DOC" \
  && ok "widget style guard" || bad "widget style guard drift"

# 3.7 — tool calculators: every js/tool-*.js with a load-time boot must be named.
for f in js/tool-*.js; do
  b=$(basename "$f")
  if grep -q "DOMContentLoaded\|document.readyState" "$f"; then
    grep -q "$b" "$DOC" && ok "tool boot: $b" || bad "tool boot $b in code, ABSENT from doc"
  fi
done
# tool-entity-formation.js binds at parse time with no ready gate — special case.
grep -q "access_submit" js/tool-entity-formation.js && grep -q "access_submit" "$DOC" \
  && ok "tool-entity-formation parse-time binding" || bad "tool-entity-formation binding drift"

# Delegated (survive) listeners must all be accounted for.
for f in js/main.js js/inline-actions.js js/members-gate.js js/consent-gate.js perch-inject.js; do
  grep -q "document.addEventListener" "$f" || continue
  grep -q "$(basename "$f")" "$DOC" && ok "delegated listener file: $(basename "$f")" \
    || bad "$(basename "$f") has a document listener, ABSENT from doc"
done

# 3.6 — beacon: counted, and must never be re-executed on swap.
nbeacon=$(grep -rl "vantage.ticoai.net/perch.js" --include=*.html . | wc -l | tr -d ' ')
expect_ge "beacon script tag pages" "$nbeacon" "140"
grep -q "vantage\\\\.ticoai\\\\.net" js/perch-router.js && ok "beacon in perch-router SKIP (never re-executed)" \
  || bad "beacon dropped from perch-router SKIP"

# 22 pages carry the delegated inline-actions dispatcher.
nia=$(grep -rl "inline-actions.js" --include=*.html . | wc -l | tr -d ' ')
expect_ge "inline-actions.js pages" "$nia" "22"

# C2 — perch-router.js exists and is loaded by zero pages.
[ -f js/perch-router.js ] && ok "js/perch-router.js exists (C2)" || bad "js/perch-router.js missing"
nrouter=$(grep -rl "perch-router" --include=*.html . | wc -l | tr -d ' ')
expect_eq "perch-router.js pages loading it (C2: zero)" "$nrouter" "0"

# 3.3 — the unlock gate is an inline script inside book.html's body (C10).
grep -q "donovan_booking_unlock" book.html && ok "book.html reads the unlock flag" \
  || bad "book.html unlock read vanished"
# C10 depends on the CSP not carrying 'strict-dynamic'. Grep the EMITTED POLICY, not
# the file: _middleware.js:48-49 carries a comment saying strict-dynamic is
# deliberately unused, and a naive file-level grep matches that explanation and
# reports the opposite of the truth. Strip // comment lines, then look only at the
# script-src directive string itself.
if sed 's://.*::' functions/_middleware.js | grep -q "script-src.*strict-dynamic"; then
  bad "CSP script-src now sets strict-dynamic — C10 reasoning is stale"
else
  ok "CSP script-src has no strict-dynamic (C10 holds)"
fi

echo
echo "-----------------------------------------------"
printf 'PASS %d   FAIL %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || { echo "RESULT: DRIFT — inventory and code disagree."; exit 1; }
echo "RESULT: inventory and code agree."
