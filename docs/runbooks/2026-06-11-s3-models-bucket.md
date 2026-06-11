# Runbook — `classicminidiy-models` S3 bucket + IAM user

**Date:** 2026-06-11
**Feature:** 3D Model Library (PR 5 — S3 plumbing)
**Keystone:** `classicminidiy-supabase/docs/plans/2026-06-11-3d-model-library.md` §5, §10
**Account:** `938808401967`
**Bucket:** `classicminidiy-models` (us-east-1, private)

This bucket holds **model file bytes only**. It is intentionally separate from
the public static-assets S3 (`classicminidiy`, `cmdiy-archive`, …) and **must
not reuse** the `cmdiy-s3` credentials. Images use the public Supabase Storage
`model-images` bucket (out of scope for this runbook).

---

## Status

| Item                             | State                              | By                                      |
| -------------------------------- | ---------------------------------- | --------------------------------------- |
| Bucket created + configured      | ✅ **Done** (automated 2026-06-11) | Claude (`cmdiy-s3` creds)               |
| Dedicated IAM user + access keys | ⛔ **TODO — Cole**                 | `cmdiy-s3` lacks `iam:*` (AccessDenied) |
| Env vars set (Vercel + local)    | ⛔ **TODO — Cole**                 | needs the IAM secret                    |
| Launch flag flipped              | ⛔ Deferred to PR 11               | keep `NUXT_PUBLIC_MODELS_ENABLED=false` |

The web routes 404 while `modelsEnabled` is false, so nothing breaks before the
IAM user exists. The S3 util throws a clean 500 ("Model storage is not
configured") if a models route is ever hit with the env unset.

---

## 1. What was created (already done)

Bucket created and configured with the `cmdiy-s3` CLI identity. Verified state:

- **Region:** us-east-1
- **Versioning:** Enabled
- **Block Public Access:** all four flags `true`
- **Default encryption:** SSE-S3 (AES256)
- **Lifecycle:** `abort-incomplete-multipart-7d` (DaysAfterInitiation 7) +
  `expire-noncurrent-versions-90d` (NoncurrentDays 90). **No transition rules** —
  objects are written `StorageClass: INTELLIGENT_TIERING` directly by the app.
- **CORS:** `GET, PUT, POST, HEAD` from `https://classicminidiy.com`,
  `https://www.classicminidiy.com`, `http://localhost:3000`; `AllowedHeaders: *`;
  `ExposeHeaders: ETag`. (Browsers need this for the direct presigned-POST upload
  and the viewer's inline GET fetch.)

Exact commands used (for reproducibility / disaster recovery):

```bash
B=classicminidiy-models
aws s3api create-bucket --bucket "$B" --region us-east-1

aws s3api put-public-access-block --bucket "$B" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-versioning --bucket "$B" --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption --bucket "$B" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# lifecycle: abort incomplete MPU 7d + expire noncurrent 90d, no transitions
aws s3api put-bucket-lifecycle-configuration --bucket "$B" --lifecycle-configuration '{
  "Rules": [
    { "ID": "abort-incomplete-multipart-7d", "Status": "Enabled", "Filter": { "Prefix": "" },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 } },
    { "ID": "expire-noncurrent-versions-90d", "Status": "Enabled", "Filter": { "Prefix": "" },
      "NoncurrentVersionExpiration": { "NoncurrentDays": 90 } }
  ]
}'

# CORS for browser upload + viewer fetch
aws s3api put-bucket-cors --bucket "$B" --cors-configuration '{
  "CORSRules": [
    { "AllowedOrigins": ["https://classicminidiy.com","https://www.classicminidiy.com","http://localhost:3000"],
      "AllowedMethods": ["GET","PUT","POST","HEAD"], "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3000 }
  ]
}'
```

---

## 2. TODO (Cole) — dedicated IAM user, scoped to this bucket only

The CLI identity (`cmdiy-s3`) is not allowed `iam:*`, so this must be run with an
**IAM-capable identity** (root or an admin profile):

```bash
# 1. Create the user
aws iam create-user --user-name cmdiy-models-s3

# 2. Attach the scoped inline policy (write the JSON below to models-iam-policy.json)
aws iam put-user-policy --user-name cmdiy-models-s3 \
  --policy-name models-bucket-scoped \
  --policy-document file://models-iam-policy.json

# 3. Mint an access key — capture AccessKeyId + SecretAccessKey from the output
aws iam create-access-key --user-name cmdiy-models-s3
```

`models-iam-policy.json` (least-privilege — this bucket only):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ModelsObjectRW",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::classicminidiy-models/*"
    },
    {
      "Sid": "ModelsBucketList",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::classicminidiy-models"
    }
  ]
}
```

Why these actions: `PutObject` (presigned POST upload), `GetObject` (presigned
GET download + HeadObject sniff), `DeleteObject` (nightly orphan cleanup +
takedowns), `ListBucket`/`GetBucketLocation` (client housekeeping). No `s3:*`, no
bucket-config or IAM actions.

---

## 3. TODO (Cole) — environment variables

Set on **Vercel** (Production + Preview) and in local **`.env`**:

```env
S3_MODELS_BUCKET=classicminidiy-models
S3_MODELS_REGION=us-east-1
S3_MODELS_ACCESS_KEY_ID=<AccessKeyId from create-access-key>
S3_MODELS_SECRET_ACCESS_KEY=<SecretAccessKey from create-access-key>

# Launch gate — KEEP FALSE until PR 11 launch. Flipping to true makes the whole
# 3D Model Library reachable.
NUXT_PUBLIC_MODELS_ENABLED=false
```

All four `S3_MODELS_*` are server-only (private `runtimeConfig`); never expose in
`runtimeConfig.public`. `NUXT_PUBLIC_MODELS_ENABLED` is the only public one.

---

## 4. Smoke test (after IAM + env are in place)

```bash
# As the new user's profile, confirm scoped access works:
echo "hello" > /tmp/probe.txt
aws s3 cp /tmp/probe.txt s3://classicminidiy-models/models/_probe/v1/_/probe.txt
aws s3 ls s3://classicminidiy-models/models/_probe/v1/_/
aws s3 rm s3://classicminidiy-models/models/_probe/v1/_/probe.txt

# Confirm the user CANNOT touch other buckets (should AccessDenied):
aws s3 ls s3://classicminidiy
```

Then, with `NUXT_PUBLIC_MODELS_ENABLED=true` in a preview env, exercise
`POST /api/models/uploads/presign` → browser POST → `POST /api/models/uploads/finalize`
→ `GET /api/models/{id}/files/{fileId}/download`.

---

## 5. Rollback

The bucket is empty and reversible. To fully remove:

```bash
aws s3 rm s3://classicminidiy-models --recursive   # if any objects exist
aws s3api delete-bucket --bucket classicminidiy-models --region us-east-1
aws iam delete-access-key --user-name cmdiy-models-s3 --access-key-id <id>
aws iam delete-user-policy --user-name cmdiy-models-s3 --policy-name models-bucket-scoped
aws iam delete-user --user-name cmdiy-models-s3
```
