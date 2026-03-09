import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDB, getSupabase } from './config';

const dynamo = getDynamoDB();
const supabase = getSupabase();

console.log('=== Migrating Wheels ===');

// Scan all items from DynamoDB 'wheels' table
let allItems: any[] = [];
let lastKey: any = undefined;

do {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: 'wheels',
      ExclusiveStartKey: lastKey,
    })
  );
  allItems.push(...(result.Items || []));
  lastKey = result.LastEvaluatedKey;
  console.log(`  Scanned ${allItems.length} wheels so far...`);
} while (lastKey);

console.log(`  Total wheels in DynamoDB: ${allItems.length}`);

// Map DynamoDB items to Supabase schema
const supabaseRows = allItems.map((item: any) => {
  // Parse photos from various formats
  let photos: string[] = [];
  if (Array.isArray(item.images)) {
    photos = item.images
      .map((img: any) => {
        if (typeof img === 'string') return img;
        if (img?.src) return img.src;
        if (img?.url) return img.url;
        return '';
      })
      .filter(Boolean);
  }

  return {
    name: item.name || '',
    wheel_type: item.type || '',
    size: parseInt(item.size) || 10,
    width: item.width || '',
    offset_value: item.offset || '',
    bolt_pattern: item.boltPattern || null,
    center_bore: item.centerBore || null,
    manufacturer: item.manufacturer || null,
    weight: item.weight ? String(item.weight) : null,
    notes: item.notes || null,
    photos: photos.length > 0 ? photos : null,
    status: 'approved',
    legacy_submitted_by: item.userName || null,
    legacy_submitted_by_email: item.emailAddress || null,
  };
});

// Insert in batches of 100
const batchSize = 100;
let inserted = 0;

for (let i = 0; i < supabaseRows.length; i += batchSize) {
  const batch = supabaseRows.slice(i, i + batchSize);
  const { error } = await supabase.from('wheels').insert(batch);
  if (error) {
    console.error(`  Error inserting batch ${i / batchSize + 1}:`, error.message);
    // Try individual inserts
    for (const row of batch) {
      const { error: singleError } = await supabase.from('wheels').insert(row);
      if (singleError) {
        console.error(`    Failed row (name=${row.name}):`, singleError.message);
      } else {
        inserted++;
      }
    }
  } else {
    inserted += batch.length;
  }
  console.log(`  Inserted ${inserted}/${supabaseRows.length}`);
}

console.log(`=== Wheels migration complete: ${inserted} rows inserted ===\n`);
