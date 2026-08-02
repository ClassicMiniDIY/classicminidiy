import { ToolCatalog, type ToolCatalogEntry } from '../../data/models/toolbox-catalog';

const STORAGE_KEY = 'cmdiy:recent-tools';
const LIMIT = 3;

/**
 * "Recently used" tool chips on the Toolbox landing (design S4).
 *
 * localStorage on purpose — no account required. The toolbox is explicitly "no
 * accounts, no ads, no nonsense", so making wayfinding depend on being signed in
 * would contradict the page it sits on.
 *
 * Only slugs are stored; the display data is looked up from ToolCatalog at read
 * time so a renamed tool never leaves a stale chip behind.
 */
export const useRecentTools = () => {
  const slugs = useState<string[]>('toolbox:recent', () => []);

  const read = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]).slice(0, LIMIT) : [];
    } catch {
      return [];
    }
  };

  /**
   * Must be called from onMounted, never during setup: reading localStorage
   * while the server-rendered markup says "no chips" is exactly the structural
   * hydration mismatch that broke /chat.
   */
  const load = () => {
    slugs.value = read();
  };

  const record = (slug: string) => {
    if (typeof window === 'undefined') return;
    if (!ToolCatalog.some((tool) => tool.slug === slug)) return;

    const next = [slug, ...read().filter((existing) => existing !== slug)].slice(0, LIMIT);
    slugs.value = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode / quota — recents are a nicety, never a hard failure */
    }
  };

  const tools = computed<ToolCatalogEntry[]>(() =>
    slugs.value
      .map((slug) => ToolCatalog.find((tool) => tool.slug === slug))
      .filter((tool): tool is ToolCatalogEntry => Boolean(tool))
  );

  return { slugs, tools, load, record };
};
