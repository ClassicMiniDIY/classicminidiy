import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDB, getSupabase } from './config';

const dynamo = getDynamoDB();
const supabase = getSupabase();

console.log('=== Migrating Colors ===');

// Scan all items from DynamoDB 'colors' table
let allItems: any[] = [];
let lastKey: any = undefined;

do {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: 'colors',
      ExclusiveStartKey: lastKey,
    })
  );
  allItems.push(...(result.Items || []));
  lastKey = result.LastEvaluatedKey;
  console.log(`  Scanned ${allItems.length} colors so far...`);
} while (lastKey);

console.log(`  Total colors in DynamoDB: ${allItems.length}`);

// Map DynamoDB items to Supabase schema
const supabaseRows = allItems.map((item: any) => ({
  name: item.name || '',
  code: item.code || '',
  short_code: item.shortCode || '',
  ditzler_ppg_code: item.ditzlerPpgCode || '',
  dulux_code: item.duluxCode || '',
  hex_value: item.primaryColor || '',
  has_swatch: item.hasSwatch || false,
  swatch_path: item.imageSwatch || null,
  contributor_images: item.images || [],
  status: 'approved',
  legacy_submitted_by: null,
  legacy_submitted_by_email: null,
}));

// Insert in batches of 100
const batchSize = 100;
let inserted = 0;

for (let i = 0; i < supabaseRows.length; i += batchSize) {
  const batch = supabaseRows.slice(i, i + batchSize);
  const { error } = await supabase.from('colors').insert(batch);
  if (error) {
    console.error(`  Error inserting batch ${i / batchSize + 1}:`, error.message);
    // Try individual inserts for this batch to identify problem rows
    for (const row of batch) {
      const { error: singleError } = await supabase.from('colors').insert(row);
      if (singleError) {
        console.error(`    Failed row (code=${row.code}):`, singleError.message);
      } else {
        inserted++;
      }
    }
  } else {
    inserted += batch.length;
  }
  console.log(`  Inserted ${inserted}/${supabaseRows.length}`);
}

console.log(`=== Colors migration complete: ${inserted} rows inserted ===\n`);
