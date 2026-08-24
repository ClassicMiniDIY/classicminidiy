# CMDIY pre-migration baseline

Captured: 2026-08-24 02:14:35 UTC
Resolver: 1.1.1.1 (public, to avoid local cache — see the OECUA verification warning)

Read-only snapshot of Vercel behavior before any Cloudflare change.

## Findings that change the plan

Measured, not assumed. Four of these contradict the plan or the OECUA pathfinder.

1. **Vercel's redirects here are 308, not 307.** OECUA measured 307 on its apex and the
   pathfinder flagged it as a possible cmdiy surprise. It does not transfer — every cmdiy
   http→https and apex→www hop is a **308**. The TME map is 308 too. Only the three redirect
   domains' final hop is a 301. Amendment B2 ("Vercel serves the live map as 308s") is correct.

2. **The three redirect domains DISCARD path and query.** `www.classicminidiy.net/test-path?x=1`
   → `https://classicminidiy.com/` — the path is dropped, not preserved. Same for `.org`.
   Writing the obvious path-preserving Cloudflare rule (`/$1`) would therefore be a **behavior
   change**, not a port. Decide deliberately; do not let it happen by default.

3. **`wheeldictionary.com` has its own target:** `https://classicminidiy.com/technical/wheels`,
   not the homepage. Any rule that lumps the three redirect domains together is wrong.

4. **Every redirect domain is a 3-hop chain today.** e.g.
   `classicminidiy.net` →308→ `www.classicminidiy.net` →301→ `classicminidiy.com` →308→
   `www.classicminidiy.com`. Cloudflare can collapse this to one hop. That is a genuine SEO
   improvement, so make it intentional and record it, exactly as B2 asks for the 308→301 change.

5. **Unmatched TME paths 404 — they do not blanket-redirect.**
   `www.theminiexchange.com/test-path` returns **404**, so the 28-entry map is path-specific and
   everything else falls through to the cmdiy app's real 404. The Cloudflare rules must preserve
   that: a catch-all `theminiexchange.com/*` → cmdiy rule would convert a correct 404 into a
   soft-200 redirect across the whole unmatched URL space.

6. `www.classicminidiy.com/test-path` → **404**, confirming the catch-all soft-404 fix in
   `app/pages/[...slug].vue` is live and must stay that way after cutover.

----------------------------------------------------------------------
## DNS

### classicminidiy.com
```
NS     ns-1305.awsdns-35.org. ns-1770.awsdns-29.co.uk. ns-287.awsdns-35.com. ns-733.awsdns-27.net. 
SOA    ns-287.awsdns-35.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400
A      216.150.1.1 
AAAA   
MX     10 mx1.forwardemail.net. 10 mx2.forwardemail.net. 
CAA    
www    6ba5285d9cdd164e.vercel-dns-017.com. 216.150.16.1 216.150.1.1 
TXT:
       "apple-domain-verification=Q7E_dibhTu0DYa9L040gvH05_iDQgLrJm8GzmVUILko" "pinterest-site-verification=9bc275bcdf6cbefc26d7de2334ad4a4b"
       "forward-email-site-verification=DTZ7064McP"
       "google-site-verification=2COMcS8gbzH8ySfm67L4tip6rETVestHuun1OPSkaGA"
       "v=spf1 include:spf.forwardemail.net include:_spf.google.com include:shops.shopify.com include:amazonses.com -all"
_dmarc "v=DMARC1; p=none;" 
```

### theminiexchange.com
```
NS     ns-1107.awsdns-10.org. ns-1857.awsdns-40.co.uk. ns-225.awsdns-28.com. ns-570.awsdns-07.net. 
SOA    ns-225.awsdns-28.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400
A      216.150.1.1 
AAAA   
MX     10 mx1.forwardemail.net. 10 mx2.forwardemail.net. 
CAA    
www    923ff004868d97d9.vercel-dns-016.com. 216.150.16.193 216.150.1.193 
TXT:
       "forward-email-site-verification=0H9JuOS45J"
       "v=spf1 include:send.resend.com ~all"
_dmarc "v=DMARC1; p=none;" 
```

### classicminidiy.net
```
NS     ns1.vercel-dns.com. ns2.vercel-dns.com. 
SOA    ns1.vercel-dns.com. hostmaster.nsone.net. 1718289057 43200 7200 1209600 600
A      216.150.1.193 216.150.16.1 
AAAA   
MX     
CAA    0 issue "letsencrypt.org" 0 issue "pki.goog" 0 issue "sectigo.com" 
www    216.150.16.1 216.150.16.129 
TXT:
_dmarc 
```

### classicminidiy.org
```
NS     ns1.vercel-dns.com. ns2.vercel-dns.com. 
SOA    ns1.vercel-dns.com. hostmaster.nsone.net. 1718289055 43200 7200 1209600 600
A      216.150.16.129 216.150.16.193 
AAAA   
MX     
CAA    0 issue "letsencrypt.org" 0 issue "pki.goog" 0 issue "sectigo.com" 
www    216.150.1.65 216.150.16.193 
TXT:
_dmarc 
```

### wheeldictionary.com
```
NS     ns1.vercel-dns.com. ns2.vercel-dns.com. 
SOA    ns1.vercel-dns.com. hostmaster.nsone.net. 1718287350 43200 7200 1209600 600
A      216.150.1.65 216.150.16.193 
AAAA   
MX     
CAA    0 issue "letsencrypt.org" 0 issue "pki.goog" 0 issue "sectigo.com" 
www    216.150.16.1 216.150.1.193 
TXT:
_dmarc 
```

----------------------------------------------------------------------
## HTTP behavior

Status, redirect target, and key headers for apex + www over http and https.
Path and query preservation probed with `/test-path?utm_source=baseline`.

### classicminidiy.com
    http://classicminidiy.com/                                     status=308 redirect=https://classicminidiy.com/ time=0.142122s
    http://classicminidiy.com/test-path?utm_source=baseline        status=308 redirect=https://classicminidiy.com/test-path?utm_source=baseline time=0.056052s
    https://classicminidiy.com/                                    status=308 redirect=https://www.classicminidiy.com/ time=0.098906s
    https://classicminidiy.com/test-path?utm_source=baseline       status=308 redirect=https://www.classicminidiy.com/test-path?utm_source=baseline time=0.089793s
    http://www.classicminidiy.com/                                 status=308 redirect=https://www.classicminidiy.com/ time=0.092902s
    http://www.classicminidiy.com/test-path?utm_source=baseline    status=308 redirect=https://www.classicminidiy.com/test-path?utm_source=baseline time=0.191867s
    https://www.classicminidiy.com/                                status=200 redirect= time=0.101230s
    https://www.classicminidiy.com/test-path?utm_source=baseline   status=404 redirect= time=0.678690s

### theminiexchange.com
    http://theminiexchange.com/                                    status=308 redirect=https://theminiexchange.com/ time=0.144477s
    http://theminiexchange.com/test-path?utm_source=baseline       status=308 redirect=https://theminiexchange.com/test-path?utm_source=baseline time=0.056977s
    https://theminiexchange.com/                                   status=308 redirect=https://www.theminiexchange.com/ time=0.143219s
    https://theminiexchange.com/test-path?utm_source=baseline      status=308 redirect=https://www.theminiexchange.com/test-path?utm_source=baseline time=0.093518s
    http://www.theminiexchange.com/                                status=308 redirect=https://www.theminiexchange.com/ time=0.135165s
    http://www.theminiexchange.com/test-path?utm_source=baseline   status=308 redirect=https://www.theminiexchange.com/test-path?utm_source=baseline time=0.056303s
    https://www.theminiexchange.com/                               status=308 redirect=https://www.classicminidiy.com/exchange time=0.087189s
    https://www.theminiexchange.com/test-path?utm_source=baseline  status=404 redirect= time=0.379549s

### classicminidiy.net
    http://classicminidiy.net/                                     status=308 redirect=https://classicminidiy.net/ time=0.092489s
    http://classicminidiy.net/test-path?utm_source=baseline        status=308 redirect=https://classicminidiy.net/test-path?utm_source=baseline time=0.150708s
    https://classicminidiy.net/                                    status=308 redirect=https://www.classicminidiy.net/ time=0.222599s
    https://classicminidiy.net/test-path?utm_source=baseline       status=308 redirect=https://www.classicminidiy.net/test-path?utm_source=baseline time=0.092291s
    http://www.classicminidiy.net/                                 status=308 redirect=https://www.classicminidiy.net/ time=0.181201s
    http://www.classicminidiy.net/test-path?utm_source=baseline    status=308 redirect=https://www.classicminidiy.net/test-path?utm_source=baseline time=0.105634s
    https://www.classicminidiy.net/                                status=301 redirect=https://classicminidiy.com/ time=0.689817s
    https://www.classicminidiy.net/test-path?utm_source=baseline   status=301 redirect=https://classicminidiy.com/ time=0.176074s

### classicminidiy.org
    http://classicminidiy.org/                                     status=308 redirect=https://classicminidiy.org/ time=0.104267s
    http://classicminidiy.org/test-path?utm_source=baseline        status=308 redirect=https://classicminidiy.org/test-path?utm_source=baseline time=0.068488s
    https://classicminidiy.org/                                    status=308 redirect=https://www.classicminidiy.org/ time=0.160504s
    https://classicminidiy.org/test-path?utm_source=baseline       status=308 redirect=https://www.classicminidiy.org/test-path?utm_source=baseline time=0.095364s
    http://www.classicminidiy.org/                                 status=308 redirect=https://www.classicminidiy.org/ time=0.086804s
    http://www.classicminidiy.org/test-path?utm_source=baseline    status=308 redirect=https://www.classicminidiy.org/test-path?utm_source=baseline time=0.106279s
    https://www.classicminidiy.org/                                status=301 redirect=https://classicminidiy.com/ time=0.653960s
    https://www.classicminidiy.org/test-path?utm_source=baseline   status=301 redirect=https://classicminidiy.com/ time=0.139587s

### wheeldictionary.com
    http://wheeldictionary.com/                                    status=308 redirect=https://wheeldictionary.com/ time=0.199946s
    http://wheeldictionary.com/test-path?utm_source=baseline       status=308 redirect=https://wheeldictionary.com/test-path?utm_source=baseline time=0.056384s
    https://wheeldictionary.com/                                   status=308 redirect=https://www.wheeldictionary.com/ time=0.161839s
    https://wheeldictionary.com/test-path?utm_source=baseline      status=308 redirect=https://www.wheeldictionary.com/test-path?utm_source=baseline time=0.087454s
    http://www.wheeldictionary.com/                                status=308 redirect=https://www.wheeldictionary.com/ time=0.165137s
    http://www.wheeldictionary.com/test-path?utm_source=baseline   status=308 redirect=https://www.wheeldictionary.com/test-path?utm_source=baseline time=0.057158s
    https://www.wheeldictionary.com/                               status=301 redirect=https://classicminidiy.com/technical/wheels time=0.798764s
    https://www.wheeldictionary.com/test-path?utm_source=baseline  status=301 redirect=https://classicminidiy.com/technical/wheels time=0.208326s

----------------------------------------------------------------------
## Response headers (https apex + www, root)

### classicminidiy.com
```
HTTP/2 308 
cache-control: public, max-age=0, must-revalidate
content-type: text/plain
location: https://www.classicminidiy.com/
server: Vercel
strict-transport-security: max-age=63072000
x-vercel-id: iad1::zsktb-1787537685291-4bbd0e3d5604
```

### www.classicminidiy.com
```
HTTP/2 200 
age: 52455
cache-control: public, max-age=0, must-revalidate
content-type: text/html; charset=utf-8
etag: "0d8e311251d9e4c5367f1cd50a3ae86d"
server: Vercel
strict-transport-security: max-age=63072000
x-vercel-cache: HIT
x-vercel-id: iad1::gf75s-1787537685386-a08a69a06fbd
```

### theminiexchange.com
```
HTTP/2 308 
cache-control: public, max-age=0, must-revalidate
content-type: text/plain
location: https://www.theminiexchange.com/
server: Vercel
strict-transport-security: max-age=63072000
x-vercel-id: iad1::5lrrb-1787537685490-15ec19867969
```

### www.theminiexchange.com
```
HTTP/2 308 
cache-control: public, max-age=0, must-revalidate
content-type: text/plain
location: https://www.classicminidiy.com/exchange
server: Vercel
strict-transport-security: max-age=63072000
x-vercel-id: iad1::8dkqv-1787537685587-400d63fcd0a2
```

### classicminidiy.net
```
HTTP/2 308 
cache-control: public, max-age=0, must-revalidate
content-type: text/plain
location: https://www.classicminidiy.net/
server: Vercel
strict-transport-security: max-age=63072000
x-vercel-id: iad1::wjjtw-1787537685730-3f8d45b86836
```

### www.classicminidiy.net
```
HTTP/2 301 
age: 0
cache-control: no-store
content-type: text/plain; charset=utf-8
location: https://classicminidiy.com
server: Vercel
strict-transport-security: max-age=63072000
x-vercel-cache: MISS
x-vercel-id: iad1::iad1::dw2ds-1787537685881-a284ea446c0b
```

### classicminidiy.org
```
HTTP/2 308 
cache-control: public, max-age=0, must-revalidate
content-type: text/plain
location: https://www.classicminidiy.org/
server: Vercel
strict-transport-security: max-age=63072000
x-vercel-id: iad1::fbdqm-1787537686007-442b7f4a9fd7
```

### www.classicminidiy.org
```
HTTP/2 301 
age: 0
cache-control: no-store
content-type: text/plain; charset=utf-8
location: https://classicminidiy.com
server: Vercel
strict-transport-security: max-age=63072000
x-vercel-cache: MISS
x-vercel-id: iad1::iad1::4kb9h-1787537686106-9257c2ea364e
```

### wheeldictionary.com
```
HTTP/2 308 
cache-control: public, max-age=0, must-revalidate
content-type: text/plain
location: https://www.wheeldictionary.com/
server: Vercel
strict-transport-security: max-age=63072000
x-vercel-id: iad1::cpvsj-1787537686236-4fd6346aef64
```

### www.wheeldictionary.com
```
HTTP/2 301 
age: 0
cache-control: no-store
content-type: text/plain; charset=utf-8
location: https://classicminidiy.com/technical/wheels
server: Vercel
strict-transport-security: max-age=63072000
x-vercel-cache: MISS
x-vercel-id: iad1::iad1::z7ktm-1787537686406-dd7628e05b7e
```

----------------------------------------------------------------------
## Notes

- OECUA measured Vercel's apex redirect as a **307**, not 308. Whatever this file
  records is the fact; do not carry assumptions from the plan text.
- The three redirect domains are hosted on Vercel DNS. Their redirect behavior
  disappears with the Vercel projects, so this capture is the only record.
- `theminiexchange.com` publishes a Resend SPF include while transactional mail
  is SES. Recorded, deliberately not "fixed" here.
