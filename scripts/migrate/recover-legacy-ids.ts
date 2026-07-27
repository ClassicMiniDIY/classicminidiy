/**
 * Recover the pre-Supabase wheel/colour uuids that migrate-wheels.ts and
 * migrate-colors.ts dropped on import.
 *
 * Those scripts mapped the DynamoDB fields but never carried `item.uuid` across,
 * so Postgres minted fresh v4 ids and every previously-indexed
 * /archive/wheels/<old-id> and /archive/colors/<old-id> URL went dead. The old
 * ids are UUIDv5 with a private namespace, so they cannot be recomputed — they
 * only exist in DynamoDB, which is what this script reads.
 *
 * Matching is tiered, because a row edited through the review/approve flow after
 * the import no longer matches the values that were inserted:
 *   1. exact  — the full tuple migrate-*.ts wrote, so only true duplicate
 *               records collide
 *   2. narrow — the identifying subset (name + size/width/offset, or name + code)
 *   3. name   — last resort, name alone
 * Ambiguous groups are assigned greedily and each target row is claimed once, so
 * a legacy id never points at a row another legacy id already owns.
 *
 * Credentials: uses the standard AWS credential chain, so run it with
 * AWS_PROFILE=<profile> rather than putting long-lived keys in .env.
 *
 *   AWS_PROFILE=cmdiy-dynamo bun run scripts/migrate/recover-legacy-ids.ts
 *
 * Writes SQL to stdout-adjacent file `legacy-id-backfill.sql`; apply it via a
 * migration in classicminidiy-supabase, never from here.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { getSupabase } from './config';

const dynamo = DynamoDBDocumentClient.from(
  // No explicit credentials: resolve from the AWS credential chain (AWS_PROFILE).
  new DynamoDBClient({ region: 'us-east-1' }),
  { marshallOptions: { removeUndefinedValues: true }, unmarshallOptions: { wrapNumbers: false } }
);
const supabase = getSupabase();

async function scanAll(table: string): Promise<any[]> {
  const items: any[] = [];
  let lastKey: any;
  do {
    const res: any = await dynamo.send(new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }));
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

const norm = (v: any) => String(v ?? '').trim().toLowerCase();

// The two tables disagree on where the legacy id lives: `wheels` items carry
// `uuid` (a v5), `colors` items carry `id` (a v4). Neither migrate script read
// either field, which is how both got dropped on import.
const legacyIdOf = (item: any): string | undefined => item.uuid ?? item.id;

// Photo list exactly as migrate-wheels.ts built it.
function photosOf(item: any): string[] {
  if (!Array.isArray(item.images)) return [];
  return item.images
    .map((img: any) => (typeof img === 'string' ? img : (img?.src ?? img?.url ?? '')))
    .filter(Boolean);
}

type Keyed = { exact: string; narrow: string; name: string };

function wheelKeysFromDynamo(i: any): Keyed {
  const size = parseInt(i.size) || 10;
  return {
    exact: [
      norm(i.name), norm(i.type), size, norm(i.width), norm(i.offset),
      norm(i.boltPattern), norm(i.centerBore), norm(i.manufacturer),
      norm(i.weight), norm(i.notes), JSON.stringify(photosOf(i)),
      norm(i.userName), norm(i.emailAddress),
    ].join(''),
    narrow: [norm(i.name), size, norm(i.width), norm(i.offset), norm(i.manufacturer)].join(''),
    name: norm(i.name),
  };
}

function wheelKeysFromSupabase(r: any): Keyed {
  return {
    exact: [
      norm(r.name), norm(r.wheel_type), r.size ?? 10, norm(r.width), norm(r.offset_value),
      norm(r.bolt_pattern), norm(r.center_bore), norm(r.manufacturer),
      norm(r.weight), norm(r.notes), JSON.stringify(r.photos ?? []),
      norm(r.legacy_submitted_by), norm(r.legacy_submitted_by_email),
    ].join(''),
    narrow: [norm(r.name), r.size ?? 10, norm(r.width), norm(r.offset_value), norm(r.manufacturer)].join(''),
    name: norm(r.name),
  };
}

function colorKeysFromDynamo(i: any): Keyed {
  return {
    exact: [
      norm(i.name), norm(i.code), norm(i.shortCode), norm(i.ditzlerPpgCode),
      norm(i.duluxCode), norm(i.primaryColor), String(!!i.hasSwatch), norm(i.imageSwatch),
    ].join(''),
    narrow: [norm(i.name), norm(i.code), norm(i.shortCode)].join(''),
    name: norm(i.name),
  };
}

function colorKeysFromSupabase(r: any): Keyed {
  return {
    exact: [
      norm(r.name), norm(r.code), norm(r.short_code), norm(r.ditzler_ppg_code),
      norm(r.dulux_code), norm(r.hex_value), String(!!r.has_swatch), norm(r.swatch_path),
    ].join(''),
    narrow: [norm(r.name), norm(r.code), norm(r.short_code)].join(''),
    name: norm(r.name),
  };
}

function match(dynamoItems: any[], rows: any[], dk: (i: any) => Keyed, sk: (r: any) => Keyed) {
  const buckets: Record<keyof Keyed, Map<string, any[]>> = {
    exact: new Map(), narrow: new Map(), name: new Map(),
  };
  for (const r of rows) {
    const k = sk(r);
    for (const tier of ['exact', 'narrow', 'name'] as const) {
      if (!buckets[tier].has(k[tier])) buckets[tier].set(k[tier], []);
      buckets[tier].get(k[tier])!.push(r);
    }
  }

  const claimed = new Set<string>();
  const done = new Set<string>();
  const pairs: { legacy: string; current: string; tier: string; name: string }[] = [];
  const unmatched: any[] = [];
  const noId: any[] = [];
  const stats = { exact: 0, narrow: 0, name: 0 };

  // Exact first across all items, then looser tiers, so a weak match never steals
  // a row that some other item matches exactly.
  for (const tier of ['exact', 'narrow', 'name'] as const) {
    for (const item of dynamoItems) {
      const legacy = legacyIdOf(item);
      if (!legacy || done.has(legacy)) continue;
      const candidates = (buckets[tier].get(dk(item)[tier]) ?? []).filter((r) => !claimed.has(r.id));
      if (candidates.length === 0) continue;
      const chosen = candidates[0];
      claimed.add(chosen.id);
      done.add(legacy);
      stats[tier]++;
      pairs.push({ legacy, current: chosen.id, tier, name: item.name ?? '' });
    }
  }
  for (const item of dynamoItems) {
    const legacy = legacyIdOf(item);
    if (!legacy) noId.push(item);
    else if (!done.has(legacy)) unmatched.push(item);
  }
  return { pairs, unmatched, noId, stats };
}

const sqlLit = (s: string) => `'${s.replace(/'/g, "''")}'`;

function emit(table: string, pairs: { legacy: string; current: string }[]): string {
  if (pairs.length === 0) return `-- ${table}: no pairs recovered\n`;
  const values = pairs.map((p) => `  (${sqlLit(p.legacy)}::uuid, ${sqlLit(p.current)}::uuid)`).join(',\n');
  return (
    `-- ${table}: ${pairs.length} legacy ids\n` +
    `update public.${table} as t set legacy_id = v.legacy\n` +
    `from (values\n${values}\n) as v(legacy, current)\n` +
    `where t.id = v.current;\n\n`
  );
}

// --- wheels -----------------------------------------------------------------
const dWheels = await scanAll('wheels');
const { data: sWheels, error: we } = await supabase
  .from('wheels')
  .select('id,name,wheel_type,size,width,offset_value,bolt_pattern,center_bore,manufacturer,weight,notes,photos,legacy_submitted_by,legacy_submitted_by_email');
if (we) throw we;

const wheelRes = match(dWheels, sWheels!, wheelKeysFromDynamo, wheelKeysFromSupabase);
console.log(`wheels : dynamo=${dWheels.length} supabase=${sWheels!.length}`);
console.log(`         matched=${wheelRes.pairs.length} (exact=${wheelRes.stats.exact} narrow=${wheelRes.stats.narrow} name=${wheelRes.stats.name}) unmatched=${wheelRes.unmatched.length}`);
for (const u of wheelRes.unmatched) console.log(`         UNMATCHED ${legacyIdOf(u)}  ${u.name}`);
if (wheelRes.noId.length) console.log(`         NO-LEGACY-ID rows: ${wheelRes.noId.length}`);

// --- colors -----------------------------------------------------------------
const dColors = await scanAll('colors');
const { data: sColors, error: ce } = await supabase
  .from('colors')
  .select('id,name,code,short_code,ditzler_ppg_code,dulux_code,hex_value,has_swatch,swatch_path');
if (ce) throw ce;

const colorRes = match(dColors, sColors!, colorKeysFromDynamo, colorKeysFromSupabase);
console.log(`colors : dynamo=${dColors.length} supabase=${sColors!.length}`);
console.log(`         matched=${colorRes.pairs.length} (exact=${colorRes.stats.exact} narrow=${colorRes.stats.narrow} name=${colorRes.stats.name}) unmatched=${colorRes.unmatched.length}`);
for (const u of colorRes.unmatched) console.log(`         UNMATCHED ${legacyIdOf(u)}  ${u.name}`);
if (colorRes.noId.length) console.log(`         NO-LEGACY-ID rows: ${colorRes.noId.length}`);

const out = resolve(import.meta.dir, 'legacy-id-backfill.sql');
writeFileSync(out, emit('wheels', wheelRes.pairs) + emit('colors', colorRes.pairs));
console.log(`\nwrote ${out}`);

// Spot-check the ids seen 406ing in the edge logs.
const probes = ['1ce3638a-7754-5a43-ad6f-cddffe477235', '709e2aab-f709-5330-ac0b-ace59ad281cc', '54427af3-304f-4af6-9e46-b6df1a5d95f2'];
console.log('\nlog-observed ids:');
for (const p of probes) {
  const hit = [...wheelRes.pairs, ...colorRes.pairs].find((x) => x.legacy === p);
  console.log(`  ${p} -> ${hit ? `${hit.current}  (${hit.name}, via ${hit.tier})` : 'NOT FOUND'}`);
}
