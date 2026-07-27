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
