import { getSupabase, getGitHubToken } from './config';

const supabase = getSupabase();
const githubToken = getGitHubToken();

console.log('=== Migrating Archive Documents from GitHub ===');

const REPO_OWNER = 'Classic-Mini-DIY';
const REPO_NAME = 'archive';

// Map directory names to document types
const typeMap: Record<string, string> = {
  manuals: 'manual',
  adverts: 'advert',
  catalogues: 'catalogue',
  tuning: 'tuning',
  electrical: 'electrical',
};

// Use repository ID to avoid redirect issues with renamed repos
const REPO_API_BASE = 'https://api.github.com/repositories/924810556';
const CONTENT_PREFIX = 'content/archive';

async function fetchGitHubContents(path: string): Promise<any[]> {
  const url = `${REPO_API_BASE}/contents/${CONTENT_PREFIX}/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    console.error(`  GitHub API error for ${path}: ${res.status} ${res.statusText}`);
    return [];
  }
  return res.json();
}

async function fetchFileContent(downloadUrl: string): Promise<string> {
  const res = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
    },
  });
  return res.text();
}

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body: match[2] || '' };
}

function generateSlug(title: string, code?: string): string {
  const base = code ? `${code}-${title}` : title;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

let totalInserted = 0;

for (const [dirName, docType] of Object.entries(typeMap)) {
  console.log(`\n  Processing ${dirName} (type: ${docType})...`);

  const contents = await fetchGitHubContents(dirName);
  if (!Array.isArray(contents)) {
    console.log(`    No contents found for ${dirName}, skipping`);
    continue;
  }

  // Get all .md files (could be nested in subdirectories)
  const mdFiles: any[] = [];

  for (const item of contents) {
    if (item.type === 'file' && item.name.endsWith('.md')) {
      mdFiles.push(item);
    } else if (item.type === 'dir') {
      // Check subdirectory for .md files
      const subContents = await fetchGitHubContents(item.path);
      if (Array.isArray(subContents)) {
        for (const subItem of subContents) {
          if (subItem.type === 'file' && subItem.name.endsWith('.md')) {
            mdFiles.push(subItem);
          }
        }
      }
    }
  }

  console.log(`    Found ${mdFiles.length} markdown files`);

  for (const file of mdFiles) {
    const raw = await fetchFileContent(file.download_url);
    const { frontmatter, body } = parseFrontmatter(raw);

    const title = frontmatter.title || file.name.replace('.md', '').replace(/-/g, ' ');
    const code = frontmatter.code || null;
    const slug = generateSlug(title, code || undefined);

    const row = {
      slug,
      legacy_slug: file.path.replace('.md', ''),
      type: docType,
      title,
      description: frontmatter.description || body.trim().slice(0, 500) || null,
      code,
      author: frontmatter.author || null,
      year: frontmatter.year ? parseInt(frontmatter.year) : null,
      file_path: frontmatter.download || null,
      thumbnail_path: frontmatter.image || null,
      sort_order: 0,
      status: 'approved',
    };

    const { error } = await supabase.from('archive_documents').insert(row);
    if (error) {
      console.error(`    Failed: ${title} (${slug}): ${error.message}`);
    } else {
      totalInserted++;
    }
  }

  console.log(`    Completed ${dirName}`);
}

console.log(`\n=== Documents migration complete: ${totalInserted} documents inserted ===\n`);
