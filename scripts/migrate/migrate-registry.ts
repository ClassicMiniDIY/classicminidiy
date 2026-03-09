import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDB, getSupabase } from './config';

const dynamo = getDynamoDB();
const supabase = getSupabase();

console.log('=== Migrating Registry ===');

// Scan all items from DynamoDB 'MiniRegister' table
let allItems: any[] = [];
let lastKey: any = undefined;

do {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: 'MiniRegister',
      ExclusiveStartKey: lastKey,
      Limit: 1000,
    })
  );
  allItems.push(...(result.Items || []));
  lastKey = result.LastEvaluatedKey;
  console.log(`  Scanned ${allItems.length} registry entries so far...`);
} while (lastKey);

console.log(`  Total registry entries in DynamoDB: ${allItems.length}`);

// Map DynamoDB items to Supabase schema
const supabaseRows = allItems.map((item: any) => {
  // Parse buildDate - could be ISO string, Date, or array
  let buildDate: string | null = null;
  if (item.buildDate && typeof item.buildDate === 'string') {
    const cleaned = item.buildDate.trim();
    if (cleaned && cleaned !== '---' && cleaned !== '-' && cleaned !== 'N/A') {
      const d = new Date(cleaned);
      buildDate = isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
    }
  }

  return {
    year: parseInt(item.year) || 0,
    model: item.model || '',
    body_number: item.bodyNum || '',
    engine_number: item.engineNum || '',
    engine_size: item.engineSize ? parseInt(item.engineSize) : null,
    body_type: item.bodyType || null,
    color: item.color || null,
    trim: item.trim || null,
    build_date: buildDate,
    owner: null,
    location: null,
    notes: item.notes || null,
    status: 'approved',
    legacy_submitted_by: item.submittedBy || null,
    legacy_submitted_by_email: item.submittedByEmail || null,
  };
});

// Insert in batches of 100
const batchSize = 100;
let inserted = 0;

for (let i = 0; i < supabaseRows.length; i += batchSize) {
  const batch = supabaseRows.slice(i, i + batchSize);
  const { error } = await supabase.from('registry_entries').insert(batch);
  if (error) {
    console.error(`  Error inserting batch ${i / batchSize + 1}:`, error.message);
    for (const row of batch) {
      const { error: singleError } = await supabase.from('registry_entries').insert(row);
      if (singleError) {
        console.error(`    Failed row (model=${row.model}, year=${row.year}):`, singleError.message);
      } else {
        inserted++;
      }
    }
  } else {
    inserted += batch.length;
  }
  console.log(`  Inserted ${inserted}/${supabaseRows.length}`);
}

console.log(`=== Registry migration complete: ${inserted} rows inserted ===\n`);
