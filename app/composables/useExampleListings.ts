export const EXAMPLE_STATUSES = ['example_free', 'example_paid'] as const;

export function isExampleStatus(status: string): boolean {
  return (EXAMPLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Stable sort that puts real listings before example listings.
 * Preserves the existing order within each group.
 */
export function sortExamplesLast<T extends { status: string }>(listings: T[]): T[] {
  return [...listings].sort((a, b) => {
    const aIsExample = isExampleStatus(a.status) ? 1 : 0;
    const bIsExample = isExampleStatus(b.status) ? 1 : 0;
    return aIsExample - bIsExample;
  });
}

export function useExampleListings() {
  const supabase = useSupabase();
  const showExamples = useState<boolean>('show-example-listings', () => true);
  const visibilityLoaded = useState<boolean>('example-visibility-loaded', () => false);

  /**
   * Load the example listings visibility setting from site_settings.
   * Cached per-session via useState so it only queries once.
   */
  async function loadVisibility() {
    if (visibilityLoaded.value) return;

    const { data, error } = await supabase.from('site_settings').select('show_example_listings').eq('id', 1).single();

    if (error || !data) {
      showExamples.value = true;
    } else {
      showExamples.value = data.show_example_listings;
    }
    visibilityLoaded.value = true;
  }

  /**
   * Toggle example listings visibility (admin only).
   * Writes to site_settings and updates local state.
   */
  async function setExampleVisibility(enabled: boolean) {
    const { error } = await supabase.from('site_settings').update({ show_example_listings: enabled }).eq('id', 1);

    if (error) {
      throw error;
    }

    showExamples.value = enabled;
  }

  const activeStatuses = computed<string[]>(() => {
    return showExamples.value ? ['active', ...EXAMPLE_STATUSES] : ['active'];
  });

  return { showExamples, loadVisibility, setExampleVisibility, activeStatuses };
}
