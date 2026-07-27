export enum WheelItemStatus {
  PENDING = 'P',
  APPROVED = 'A',
  REJECTED = 'R',
}

export interface IWheelsData {
  uuid: string;
  name: string;
  type: string;
  width: string;
  size: string;
  offset: string;
  notes: string;
  userName: string;
  /**
   * Optional: only the submission form and the admin review view (service
   * client, reads submission_queue) carry this. The public archive no longer
   * fetches it — `wheels.legacy_submitted_by_email` is revoked from
   * anon/authenticated as PII.
   */
  emailAddress?: string;
  referral: string;
  images?: any[];
  newWheel?: boolean;
  manufacturer?: string;
  boltPattern?: string;
  centerBore?: string;
  weight?: string | number;
  status?: WheelItemStatus;
}
export interface IWheelsDataReviewItem {
  uuid: string;
  name: string;
  type: string;
  width: string;
  size: string;
  offset: string;
  notes: string;
  userName: string;
  emailAddress: string;
  referral: string;
  images?: any[];
  newWheel?: boolean;
  oldWheel?: IWheelsData;
  status?: WheelItemStatus;
}

export interface IWheelToReview {
  new?: IWheelsData;
  existing?: IWheelsData;
}
