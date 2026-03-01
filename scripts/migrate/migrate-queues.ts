import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDB, getSupabase } from './config';

const dynamo = getDynamoDB();
const supabase = getSupabase();

console.log('=== Migrating Queue Data ===');

// Migrate colorsQueue
console.log('\n  Migrating colorsQueue...');
let colorQueueItems: any[] = [];
let lastKey: any = undefined;

do {
  const result = await dynamo.send(new ScanCommand({
    TableName: 'colorsQueue',
    ExclusiveStartKey: lastKey,
  }));
  colorQueueItems.push(...(result.Items || []));
  lastKey = result.LastEvaluatedKey;
} while (lastKey);

console.log(`    Found ${colorQueueItems.length} color queue items`);

let colorInserted = 0;
for (const item of colorQueueItems) {
  // Map legacy status
  let status = 'pending';
  if (item.status === 'A') status = 'approved';
  else if (item.status === 'R') status = 'rejected';

  const row = {
    type: 'new_item',
    target_type: 'color',
    status,
    data: {
      name: item.name || '',
      code: item.code || '',
      shortCode: item.shortCode || '',
      ditzlerPpgCode: item.ditzlerPpgCode || '',
      duluxCode: item.duluxCode || '',
      primaryColor: item.primaryColor || '',
      hasSwatch: item.hasSwatch || false,
      imageSwatch: item.imageSwatch || '',
      years: item.years || '',
      submittedBy: item.submittedBy || '',
      submittedByEmail: item.submittedByEmail || '',
    },
  };

  const { error } = await supabase.from('submission_queue').insert(row);
  if (error) {
    console.error(`    Failed color queue item (${item.name}): ${error.message}`);
  } else {
    colorInserted++;
  }
}
console.log(`    Inserted ${colorInserted} color queue items`);

// Migrate wheelsQueue
console.log('\n  Migrating wheelsQueue...');
let wheelQueueItems: any[] = [];
lastKey = undefined;

do {
  const result = await dynamo.send(new ScanCommand({
    TableName: 'wheelsQueue',
    ExclusiveStartKey: lastKey,
  }));
  wheelQueueItems.push(...(result.Items || []));
  lastKey = result.LastEvaluatedKey;
} while (lastKey);

console.log(`    Found ${wheelQueueItems.length} wheel queue items`);

let wheelInserted = 0;
for (const item of wheelQueueItems) {
  let status = 'pending';
  if (item.status === 'A') status = 'approved';
  else if (item.status === 'R') status = 'rejected';

  const row = {
    type: 'new_item',
    target_type: 'wheel',
    status,
    data: {
      name: item.name || '',
      type: item.type || '',
      size: item.size || '',
      width: item.width || '',
      offset: item.offset || '',
      notes: item.notes || '',
      userName: item.userName || '',
      emailAddress: item.emailAddress || '',
      referral: item.referral || '',
      images: item.images || [],
      manufacturer: item.manufacturer || null,
      boltPattern: item.boltPattern || null,
      centerBore: item.centerBore || null,
      weight: item.weight || null,
    },
  };

  const { error } = await supabase.from('submission_queue').insert(row);
  if (error) {
    console.error(`    Failed wheel queue item (${item.name}): ${error.message}`);
  } else {
    wheelInserted++;
  }
}
console.log(`    Inserted ${wheelInserted} wheel queue items`);

console.log(`\n=== Queue migration complete: ${colorInserted + wheelInserted} total items ===\n`);
