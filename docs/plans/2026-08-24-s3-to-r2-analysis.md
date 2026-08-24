# S3 → R2: what is actually involved

**Status:** analysis for a decision. Nothing implemented.
**Context:** raised while migrating to Cloudflare Workers, because `new S3Client()` does not
work on workerd (see the migration plan's A1 entries) and R2 was floated as the way out.

---

## 1. The estate is much smaller than it feels

Measured 2026-08-24 with `aws s3 ls --recursive --summarize` (CloudWatch metrics are denied to
the `cmdiy-s3` IAM user):

| Bucket | Objects | Size | Access pattern | Touches the AWS SDK? |
|---|---|---|---|---|
| `classicminidiy` | 25,625 | **147 MB** | public HTTPS, read by browser + ipx | **No** |
| `cmdiy-archive` | 611 | **1.17 GB** | public HTTPS, read by browser + ipx | **No** |
| `classicminidiy-models` | 15 | **249 MB** | private, presigned via SDK | **YES — the only one** |
| `cmdiy-substack-redirect` | 0 | 0 | — | no (empty; delete it) |
| **Total** | **~26,251** | **~1.57 GB** | | |

Also present and out of scope: `deathly-hallows`, `deathlyhallows-backup` (unrelated project).

1.57 GB is a rounding error for a bulk migration. Super Slurper's documented limit is per-object
(1 TB); nothing here is close. The migration is minutes of transfer, whenever it happens.

## 2. The decomposition that actually matters

**The AWS SDK appears in exactly one file — `server/utils/s3Models.ts` — serving exactly one
bucket, `classicminidiy-models` (15 objects, 249 MB).**

The two big public buckets are never touched by the SDK. They are plain public HTTPS URLs read by
the browser and by ipx/Vercel's image optimizer. **They work on Workers today, unchanged.** They
are not part of the blocker and never were.

So this splits into two independent decisions that do not have to happen together:

- **Decision A — move `classicminidiy-models` (15 objects).** This is the one that interacts with
  the Workers blocker.
- **Decision B — move `classicminidiy` + `cmdiy-archive` (26,236 objects, 1.3 GB).** Purely an
  egress/cost question. Can be deferred indefinitely, or done first, or never.

## 2a. How the models bucket is actually wired (asked 2026-08-24)

Worth stating plainly, because a single model's data is split across **three** systems and that
makes the ownership look murkier than it is:

| What | Where | Pointer |
|---|---|---|
| Metadata (title, price, license, counts) | Supabase Postgres, `models` | — |
| Preview images | **Supabase Storage**, `model-images` bucket | `model_images.storage_path` |
| The downloadable 3D files | **Our own S3**, `classicminidiy-models` | `model_files.s3_key` |

`classicminidiy-models` is an ordinary bucket in **our** AWS account `938808401967` (created
2026-06-11, Block Public Access fully ON). There is **no Supabase↔S3 integration** — no sync, no
foreign key, no managed connector. The two systems are joined by one text column and three server
routes:

- `server/api/models/uploads/presign.post.ts` — mints the key via `buildModelKey()`, INSERTs the
  `model_files` row as `upload_status: 'pending'` **under the caller's JWT** so the INSERT RLS
  policy is the authoritative gate, then returns a presigned POST. The browser uploads directly
  to S3; the bytes never transit our server.
- `server/api/models/uploads/finalize.post.ts` — reads `s3_key` back, `headModelObject()` for
  existence + size, `getModelObjectHead()` for magic-byte sniffing, then flips `upload_status`.
- `server/api/models/[modelId]/files/[fileId]/download.get.ts` — reads `s3_key`, runs the full
  entitlement gate, presigns a 60 s GET.

**Consequence for this migration: moving the bucket requires NO Supabase change at all.** Keys are
preserved by Super Slurper, so every existing `model_files.s3_key` value stays valid verbatim. No
migration in `classicminidiy-supabase`, no data rewrite, no downtime. The blast radius is three
files.

The column would be named `s3_key` while pointing at R2. Leave it — renaming costs a migration in
the supabase repo for no functional gain.

## 3. R2 does NOT eliminate the signing problem

This is the finding that matters most, and it is easy to get wrong.

**R2 presigned URLs still require SigV4.** Cloudflare's own docs: presigned URLs are "generated
server-side with no communication with R2, requiring only your R2 API credentials and an
implementation of the AWS Signature Version 4 signing algorithm." Moving the bucket does not
remove the need for a signer.

What the **R2 binding** removes is the need to sign *server-side* operations. Mapping the four
current operations:

| Operation today | On R2 | Signing needed? |
|---|---|---|
| `headModelObject` (HeadObject) | `env.BUCKET.head(key)` | **No** — binding |
| `getModelObjectHead` (ranged GET) | `env.BUCKET.get(key, { range })` | **No** — binding |
| `createModelDownloadUrl` (presigned GET → 302) | stream `env.BUCKET.get()` through the existing route | **No** — binding |
| `createPresignedPost` (browser direct upload) | presigned PUT/POST | **YES — still SigV4** |

Three of four become binding calls. The fourth does not.

### Why the download case is actually an improvement

`server/api/models/[modelId]/files/[fileId]/download.get.ts` already enforces the whole gate
server-side — auth, ownership, publication, `has_model_entitlement()`, rate limit, download
recording — and only then 302s to a 60-second presigned URL. With a binding it can return
`new Response(object.body)` and stream. That is a **streaming** response, not a buffered one, so
even the 194.7 MB file is fine. It also closes the window where a presigned URL outlives the
entitlement check.

### Why the upload case is genuinely hard

Largest model object today is **194.7 MB** (`Mk1MiniFrontClip.stl`). Amendment A4 records that
nitro's module handler does `Buffer.from(await request.arrayBuffer())` — it buffers the entire
body before routing. Against a 128 MB isolate limit, routing a 194 MB upload through the Worker
is not viable. Browser-direct upload is not a preference here; it is a requirement.

Three ways to satisfy it:

1. **Presigned PUT/POST against R2, signed with SigV4.** Needs a signer — `aws4fetch` pinned, or
   ~100 lines of SubtleCrypto. Identical work to staying on S3.
2. **Worker-orchestrated multipart.** Browser sends bounded chunks (say 10 MB) to a Worker route;
   the Worker writes each part via the binding. No signing anywhere. More code, and a real
   resumability/cleanup story to own.
3. **Keep uploads on S3, serve everything else from R2.** Split-brain storage. Cheap to say,
   unpleasant to maintain.

## 4. What R2 actually buys, honestly

- **Zero egress.** R2 charges nothing for egress; S3 charges per GB out. This is the real
  financial argument, and I **cannot size it** — CloudWatch and Cost Explorer are denied to the
  `cmdiy-s3` IAM user. Cole should check the S3 line in AWS Billing before weighting this. The
  1.17 GB archive bucket (manuals, catalogues, adverts — big PDFs) is the likely egress driver,
  and it is in Decision B, not Decision A.
- **Storage cost is negligible either way.** 1.57 GB at R2's $0.015/GB-month is ~$0.024/month; at
  S3 Standard's ~$0.023/GB-month it is ~$0.036/month. A cent a month is not a reason to migrate.
- **Architectural**: three of four SDK operations become binding calls, and the download path gets
  strictly better.

**It does not remove the need for a SigV4 signer**, so the aws4fetch-vs-hand-rolled decision has
to be made regardless of what happens to R2. That decision is not blocked by this one.

## 5. Recommendation

**Do Decision A, defer Decision B.**

- Move `classicminidiy-models` (15 objects, 249 MB) to R2. It is the bucket entangled with the
  Workers blocker, it is trivially small, and it converts three of the four operations to
  binding calls with no signing.
- Still implement a SigV4 signer for presigned uploads. Pinned `aws4fetch` (exact version, the
  `dompurify` treatment) unless the multipart-through-the-Worker route is preferred.
- Leave `classicminidiy` and `cmdiy-archive` on S3 for now. They do not block anything, and 261
  hardcoded hostname references (`classicminidiy.s3.amazonaws.com` ×223,
  `classicminidiy.s3.us-east-1.amazonaws.com` ×38, `cmdiy-archive...` ×4) plus the `image.domains`
  allowlist, the PWA `runtimeCaching` patterns and the preconnect hints all key on those
  hostnames. That is a mechanical but wide change with a documented history of silent failure —
  an unlisted host in `image.domains` passes through unoptimized with no error. It deserves its
  own branch and its own verification, not a slot inside the platform migration.

**Sequencing note:** Decision B gets easier after the Workers cutover, not harder — an R2 bucket
can be served from a custom domain on a zone Cloudflare already controls, and at that point the
261 call sites can move to a single configurable base URL rather than a second hardcoded host.

## 6. Open questions for Cole

1. **What is the actual monthly S3 egress bill?** Decides whether Decision B is worth doing at
   all. Needs AWS Billing / Cost Explorer access that the `cmdiy-s3` user does not have.
2. **Upload path preference** — presigned PUT with a SigV4 signer (less code, keeps a dependency)
   vs. Worker-orchestrated multipart (no signing, more code and an ownership burden)?
3. `cmdiy-substack-redirect` is empty. Delete it?
