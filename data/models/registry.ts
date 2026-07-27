export interface RegistryItem extends Record<string, any> {
  model: string;
  bodyNum: string;
  trim: string;
  submittedBy: string;
  /**
   * Optional: only the submission form and the admin queue view (service
   * client, reads submission_queue) carry this. The public register no longer
   * fetches it — `registry_entries.legacy_submitted_by_email` is revoked from
   * anon/authenticated as PII.
   */
  submittedByEmail?: string;
  engineNum: string;
  notes: string;
  year: number;
  uniqueId: string;
  buildDate: string | any[] | null;
  bodyType: string;
  engineSize: number;
  color: string;
  status?: RegistryItemStatus;
  /**
   * profiles id of the account that owns this entry, or null while unowned.
   * Set by the #65 phase-3 backfill for submitters whose email matched a
   * confirmed account, and by `claim_registry_entry` for anyone claiming later.
   * Drives the owner-only "suggest an edit" affordance.
   */
  ownerId?: string | null;
}

/** A register entry the signed-in user is entitled to claim. */
export interface ClaimableRegistryEntry {
  id: string;
  year: number;
  model: string;
  bodyNum: string;
  submittedBy: string;
}

export interface RegistryQueueSubmissionResponse {
  uuid: string;
  details: RegistryItem;
}

export enum RegistryItemStatus {
  PENDING = 'P',
  APPROVED = 'A',
  REJECTED = 'R',
}
