import { config } from 'dotenv';
import { resolve } from 'path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createClient } from '@supabase/supabase-js';

// Load .env from project root
config({ path: resolve(import.meta.dir, '../../.env') });

export function getDynamoDB() {
  const client = new DynamoDBClient({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.dynamo_id!,
      secretAccessKey: process.env.dynamo_key!,
    },
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
    unmarshallOptions: { wrapNumbers: false },
  });
}

export function getSupabase() {
  return createClient(process.env.NUXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getGitHubToken() {
  return process.env.githubAPIKey!;
}
