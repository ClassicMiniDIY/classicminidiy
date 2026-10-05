# "Discuss this" links from knowledgebase pages to the community forum

Date: 2026-10-05. Status: implemented on `feature/community-links`.
Parent: the forum design lives in the private `classicminidiy-discourse` repo
(`docs/plans/2026-10-03-community-forum.md`, Phase 5 "Launch": "knowledgebase
'Discuss this' links"). Sign-in to the forum is `docs/plans/2026-10-03-discourse-sso.md`.

## Problem

Classic Mini DIY Community (`community.classicminidiy.com`) is a Discourse forum. The
knowledgebase pages on this site (tools, calculators, archive reference pages) have no
place for questions or corrections in public. We want each of these pages to have a
"Discuss this on the community" link. The link opens ONE forum topic for that page. The
first click creates the topic. Every later click opens the same topic.

## Which pages get the link

Reference and tool pages, where a page-level discussion makes sense. One topic per
page, not per item.

| Route                        | Page key                    |
| ---------------------------- | --------------------------- |
| `/technical/torque`          | `technical-torque`          |
| `/technical/clearance`       | `technical-clearance`       |
| `/technical/compression`     | `technical-compression`     |
| `/technical/gearing`         | `technical-gearing`         |
| `/technical/needles`         | `technical-needles`         |
| `/technical/alignment`       | `technical-alignment`       |
| `/technical/chassis-decoder` | `technical-chassis-decoder` |
| `/technical/engine-decoder`  | `technical-engine-decoder`  |
| `/technical/parts`           | `technical-parts`           |
| `/archive/electrical`        | `archive-electrical`        |
| `/archive/engines`           | `archive-engines`           |
| `/archive/weights`           | `archive-weights`           |
| `/archive/suppliers`         | `archive-suppliers`         |
| `/archive/colors`            | `archive-colors`            |
| `/archive/wheels`            | `archive-wheels`            |
| `/archive/registry`          | `archive-registry`          |
| `/archive/documents`         | `archive-documents`         |
| `/archive/variants`          | `archive-variants`          |
| `/archive/parts`             | `archive-parts`             |

Not included, and why:

- **Per-item pages** (`/archive/colors/*`, `/archive/wheels/*`, `/archive/documents/[slug]`,
  `/archive/variants/[slug]`, `/archive/parts/[number]`, `/archive/parts/diagrams/[id]`).
  There are thousands of them. A topic per item needs a server-side existence check per
  family, and it would fill the forum with empty topics. The item pages can come later
  as a second phase with a lookup per family. The section page link covers them now.
- **Hubs** (`/technical`, `/archive`, `/archive/contributors`) and
  `/archive/registry/pending`: navigation and moderation pages, not content.
- **Marketplace, models, chat, account pages**: not knowledgebase.

The allowlist is `shared/utils/communityDiscuss.ts` (`COMMUNITY_DISCUSS_PAGES`). The
component and the server route both read it. A page shows the link only when its path
is in the list.

## Mechanism

```
page  ─ <CommunityDiscussLink> ─▶ GET /api/community/discuss?page=technical-torque
        (plain <a>, rel="nofollow")
server
  1. resolve `page` against COMMUNITY_DISCUSS_PAGES          unknown ─▶ 302 forum home
  2. config set? not a crawler?                              no      ─▶ 302 forum search
  3. KV cache: topic URL                                     hit     ─▶ 302 topic
               cached failure, or KV unreadable              yes     ─▶ 302 forum search
  4. under the per-IP limit?                                 no      ─▶ 302 forum search
  5. GET  {forum}/t/external_id/cmdiy-technical-torque.json  found   ─▶ 302 topic
  6. POST {forum}/posts.json { title, raw, category,
          embed_url, external_id }                          created ─▶ 302 topic
     422 (a parallel request won) ─▶ repeat step 5 once
  steps 5-6 share one 8 s budget (5 s per call)
  any failure ─▶ cache the failure for 10 minutes                    ─▶ 302 forum search
```

- **The query string carries only a key.** The title, the canonical URL
  (`siteUrl` + path), the body text and the category all come from the server. A
  caller cannot make the route create a topic for any page outside the list, or with
  any text of its choice. At most one topic exists per listed page.
- **Titles carry a prefix.** The topic title is `Discussion: <page name>`
  (`communityDiscussTopicTitle`), so it does not clash with an imported archive topic
  that has the bare page name. The search fallback uses the bare page name.
- **`external_id` is the lookup key.** Each topic is created with
  `external_id = cmdiy-<page key>`. The route finds it with
  `GET /t/external_id/<id>.json`.
- **`embed_url` is also sent**, so Discourse records a `TopicEmbed` for the canonical
  page URL. That lets a later phase embed the topic's replies on the page with
  Discourse's comment embed. The route does not depend on it.
- The response is always a 302. The route never answers with a 500 page.
  `Cache-Control: no-store` and `X-Robots-Tag: noindex`.

### Discourse behaviour verified against source

Checked against `discourse/discourse` `main` on 2026-10-05:

- `PostsController#create` permits `embed_url` and `external_id` only for API requests
  (`is_api?`). The API response is memoized for 120 s on a signature of the params,
  so identical parallel creates return the same result.
- `PostCreator#create_embedded_topic` stores `TopicEmbed.normalize_url(embed_url)`
  (lowercase, no trailing slash). It does not check `EmbeddableHost`. `TopicEmbed`
  validates `embed_url` uniqueness.
- `TopicCreator` copies `external_id` onto the topic. `Topic` validates it as
  `[\w-]+`, at most 50 characters, unique case-insensitively, with a unique partial
  index in the database. A second create with the same id fails with a 422.
- `TopicsController#show_by_external_id` (`GET /t/external_id/:external_id`) answers a
  redirect to the topic URL, with `.json` kept for a JSON request, or a 404. Rails
  builds an absolute Location from the request protocol, which can be `http` if the
  forwarded protocol is lost behind the tunnel. The route compares only the host and
  rebuilds the URL on the configured https origin.
- The admin API limiter (`admin_api_min`, in the current-user provider) is ONE counter
  for every admin key on the forum. The flair sync and the importers spend the same
  counter. This public route must spend as little of it as possible.
- `EmbedController#info` (`GET /embed/info.json?embed_url=`) needs an API request, and
  matches `embed_url` exactly, without normalising it. **No granular API key scope
  covers it.** Only a key with global read can call it. That is why the lookup uses
  `external_id`, which the granular scope `topics:read` covers.
- Granular scopes (`ApiKeyScope.default_mappings`): `topics:write` is `posts#create`;
  `topics:read` is `topics#show`, `topics#feed`, `topics#posts` and
  `topics#show_by_external_id`.
- If the site setting `embed_unlisted` is on, a topic created with `embed_url` is
  unlisted. Its default is off. Keep it off.
- `min_topic_title_length` defaults to 15 and `allow_duplicate_topic_titles` to false.
  Every topic title is at least 15 characters and carries the `Discussion:` prefix (a
  unit test checks both). If a topic with the same title still exists, the create
  fails with a 422, the failure is cached and logged, and the link falls back to search.

## Abuse and cost controls

- **Allowlist.** Topic creation is bounded by the list: at most one topic per entry,
  for the life of the forum.
- **Crawlers never create topics.** The link has `rel="nofollow"`. The route also
  sends any request whose User-Agent is a known bot (`matchBot`) or looks like one
  (`bot`, `crawl`, `spider`, `slurp`) to the forum search, without an API call.
- **Per-IP limit.** `consumeRateLimit` (the same in-memory limiter as
  `server/middleware/rate-limit.ts`), keyed on `clientIp`. Over the limit, the route
  sends the user to the forum search instead of an error.
- **Shared cache.** A per-isolate memory cache does not protect the forum's shared
  admin API limiter: every cold isolate would call the forum again. The route keeps
  the page key to topic URL mapping in the KV-backed `useStorage('cache')` (the
  existing `CACHE` binding in `wrangler.jsonc`; no new binding) for 30 days. Every
  isolate reads the same entry, so a page costs forum calls about once a month.
- **Failures are cached too**, for 10 minutes: forum down, a timeout, a 429, a post
  sent to the review queue, and a create refused with a 422 where the second lookup
  still finds nothing. A failing page therefore costs at most one forum attempt per
  10 minutes, not one per click. If KV cannot be read, the route sends the user to
  search and does not call the forum.
- **Time budget.** Each forum call has a 5 s timeout, and the whole find-or-create has
  8 s. After that the user goes to search.
- **Failure.** The route sends the user to `{forum}/search?q=<page name>` and logs one
  line without secrets. A 422 logs the forum's `errors` array (validation messages,
  no secrets). If the topic was deleted by a moderator, its `external_id` stays
  taken, so the create fails and the link falls back to search. Restore the topic to
  bring the link back; the failure entry expires within 10 minutes.
- **Edge rate limit (recommended operator step).** Add a Cloudflare zone rate-limit
  rule for `/api/community/discuss`. The in-Worker limit is per isolate, so it only
  dampens. Choose the threshold with the forum's admin API limit in view; record it
  in the private forum repo, not here.

## Config

Runtime Worker secrets (set with `./scripts/set-cf-secrets.sh`; none belongs in the
build env). All three are optional.

| Env var                              | runtimeConfig key               | Meaning                                    |
| ------------------------------------ | ------------------------------- | ------------------------------------------ |
| `NUXT_DISCOURSE_API_KEY`             | `DISCOURSE_API_KEY`             | Forum API key (granular, see below).       |
| `NUXT_DISCOURSE_API_USERNAME`        | `DISCOURSE_API_USERNAME`        | The forum user the key acts as.            |
| `NUXT_DISCOURSE_DISCUSS_CATEGORY_ID` | `DISCOURSE_DISCUSS_CATEGORY_ID` | Numeric id of the category for new topics. |

The forum origin is the existing public `discourseUrl`.

**Inert when unset.** If any of the three is empty or the category id is not a
positive integer, the link still shows and the route sends the user to the forum
search for the page title. Nothing is created. So this can merge before the forum key
exists.

### Forum-side prerequisites (forum operator)

1. Create an API key: Admin → Advanced → API keys → New. User level: **Single user**,
   user `system` (staff, so no new-user topic limits and no approval queue). Scope:
   **Granular**, with only `topics` → `write` and `topics` → `read`. Do not use a
   global key.
2. Choose the category for page topics. The default proposal is **Tech Help**. Staff
   creates the topics through `system`, and everyone can reply.
3. Keep `embed_unlisted` off, so the topics are listed.
4. Optional, for the later comment embed: add an Embeddable Host
   `www.classicminidiy.com` mapped to the same category (Admin → Customize →
   Embedding). The discuss route does not need it.
5. Set the three secrets on the Worker.
6. Cloudflare (zone operator): add a rate-limit rule for `/api/community/discuss` (see
   "Edge rate limit" above). Recommended, not required for the merge.

## Tests

`tests/unit/server/api/community-discuss.get.test.ts` (mocked `fetch`): unknown key,
unconfigured, crawler (and a "CUBOT" phone that is not one), KV hit, KV unreadable,
found by external id, an `http://` Location, created, 422 race, 422 reasons logged,
cached failures, forum down, time budget, rate limited, enqueued post. `tests/unit/shared/communityDiscuss.test.ts`: the
allowlist shape (title length, external id format, path to key lookup).
