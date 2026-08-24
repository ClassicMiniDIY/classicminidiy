#!/usr/bin/env bash
# Capture the pre-migration Vercel behavior of every CMDIY hostname.
#
# This is the verification oracle the Phase 4 battery diffs against. Some of it
# is UNRECOVERABLE once the Vercel projects are deleted (notably the redirect
# behavior of classicminidiy.net/.org and wheeldictionary.com), so it must run
# while Vercel is still serving.
#
# Read-only: DNS queries and HTTP HEAD requests. Safe to re-run.

set -uo pipefail

DOMAINS=(classicminidiy.com theminiexchange.com classicminidiy.net classicminidiy.org wheeldictionary.com)
RESOLVER=1.1.1.1

hr() { printf '\n%s\n' "----------------------------------------------------------------------"; }

echo "# CMDIY pre-migration baseline"
echo
echo "Captured: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "Resolver: $RESOLVER (public, to avoid local cache — see the OECUA verification warning)"
echo
echo "Read-only snapshot of Vercel behavior before any Cloudflare change."

hr
echo "## DNS"
for d in "${DOMAINS[@]}"; do
  echo
  echo "### $d"
  echo '```'
  echo "NS     $(dig +short NS "$d" @$RESOLVER | sort | tr '\n' ' ')"
  echo "SOA    $(dig +short SOA "$d" @$RESOLVER)"
  echo "A      $(dig +short A "$d" @$RESOLVER | sort | tr '\n' ' ')"
  echo "AAAA   $(dig +short AAAA "$d" @$RESOLVER | sort | tr '\n' ' ')"
  echo "MX     $(dig +short MX "$d" @$RESOLVER | sort | tr '\n' ' ')"
  echo "CAA    $(dig +short CAA "$d" @$RESOLVER | sort | tr '\n' ' ')"
  echo "www    $(dig +short www."$d" @$RESOLVER | tr '\n' ' ')"
  echo "TXT:"
  dig +short TXT "$d" @$RESOLVER | sort | sed 's/^/       /'
  echo "_dmarc $(dig +short TXT _dmarc."$d" @$RESOLVER | tr '\n' ' ')"
  echo '```'
done

hr
echo "## HTTP behavior"
echo
echo "Status, redirect target, and key headers for apex + www over http and https."
echo "Path and query preservation probed with \`/test-path?utm_source=baseline\`."
for d in "${DOMAINS[@]}"; do
  echo
  echo "### $d"
  for host in "$d" "www.$d"; do
    for scheme in http https; do
      for path in "/" "/test-path?utm_source=baseline"; do
        url="$scheme://$host$path"
        out=$(curl -sS -o /dev/null -m 15 \
          -w 'status=%{http_code} redirect=%{redirect_url} time=%{time_total}s' \
          -I "$url" 2>&1) || out="REQUEST FAILED: $out"
        printf '    %-62s %s\n' "$url" "$out"
      done
    done
  done
done

hr
echo "## Response headers (https apex + www, root)"
for d in "${DOMAINS[@]}"; do
  for host in "$d" "www.$d"; do
    echo
    echo "### $host"
    echo '```'
    curl -sS -m 15 -I "https://$host/" 2>&1 \
      | grep -iE '^(HTTP/|location|strict-transport-security|cache-control|content-type|server|x-vercel|age|etag)' \
      || echo "(no response)"
    echo '```'
  done
done

hr
echo "## Notes"
cat <<'NOTES'

- OECUA measured Vercel's apex redirect as a **307**, not 308. Whatever this file
  records is the fact; do not carry assumptions from the plan text.
- The three redirect domains are hosted on Vercel DNS. Their redirect behavior
  disappears with the Vercel projects, so this capture is the only record.
- `theminiexchange.com` publishes a Resend SPF include while transactional mail
  is SES. Recorded, deliberately not "fixed" here.
NOTES
