import type { Database } from '~~/types/database';

type TargetType = Database['public']['Enums']['target_type_enum'];

/**
 * The four contribution tiles in step 1 (design S8). `fix` is the odd one out:
 * it produces an `edit_suggestion` against an existing entry rather than a new
 * item, which is why the wizard carries `targetType`/`targetId` separately from
 * the tile choice.
 */
export type ContributionKind = 'document' | 'registry' | 'wheel' | 'fix';

export interface ContributeWizardContext {
  /**
   * 'contribute' runs the 3-step wizard. 'request' is the short path taken from
   * omnisearch's "Request it" — no files, just the ask that feeds Most Wanted.
   */
  mode?: 'contribute' | 'request';
  /** Pre-selects the step-1 tile when launched from context. */
  kind?: ContributionKind;
  /** The entry a fix / gap-filler is about. */
  targetType?: TargetType | null;
  targetId?: string | null;
  targetTitle?: string | null;
  /** Set when launched from "I have this" — approving clears the request. */
  requestId?: string | null;
  /** Prefills the request title from the failed search or the Most Wanted row. */
  requestTitle?: string | null;
  /** Where the launch happened, for analytics. */
  origin?: string;
}

/**
 * One wizard for every contribution type, opened from anywhere (design S8).
 *
 * State is global (`useState`) because the launch points are scattered — the
 * archive subnav, a Most Wanted row's "I have this", a wheel card's "add
 * yours", a tool page's "suggest a correction", and omnisearch's "Request it".
 * They all set context here and the single modal in app.vue reacts.
 */
export const useContributeWizard = () => {
  const isOpen = useState('contribute-wizard:open', () => false);
  const context = useState<ContributeWizardContext>('contribute-wizard:context', () => ({}));
  const { track } = useAnalytics();

  const openWizard = (next: ContributeWizardContext = {}) => {
    context.value = { mode: 'contribute', ...next };
    isOpen.value = true;
    track('contribute_wizard_opened', {
      mode: context.value.mode ?? 'contribute',
      kind: context.value.kind ?? null,
      origin: context.value.origin ?? null,
    });
  };

  const closeWizard = () => {
    isOpen.value = false;
  };

  return { isOpen, context, openWizard, closeWizard };
};
