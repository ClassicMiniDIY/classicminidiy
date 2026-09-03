/**
 * useAdminEmailHealth — the read side of /admin/email.
 * Design doc: docs/plans/2026-09-03-forward-email-retirement.md
 *
 * Types are restated here rather than imported from `server/utils/emailHealth`,
 * matching useAdminDeveloper: client code does not reach into `server/`, and a
 * type-only import that happens to erase at build time is not a precedent worth
 * setting.
 */

export type EmailSeverity = 'ok' | 'warn' | 'fail' | 'unknown';
export type MxProvider = 'cloudflare' | 'forwardemail' | 'google' | 'other' | 'none';

export interface EmailCheck {
  id: string;
  label: string;
  severity: EmailSeverity;
  detail: string;
}

export interface EmailDomainHealth {
  domain: string;
  sends: boolean;
  mxHosts: string[];
  mxProvider: MxProvider;
  spfRecord: string | null;
  spfCount: number;
  spf: {
    lookups: number;
    includes: string[];
    directIncludes: string[];
    /** Direct includes that resolve but authorize no sender. */
    emptyIncludes: string[];
    authorizing: number;
    allQualifier: string | null;
    truncated: boolean;
  } | null;
  dmarc: { record: string; policy: string | null; pct: number; hasReporting: boolean } | null;
  unexpectedIncludes: string[];
  missingIncludes: string[];
  checks: EmailCheck[];
  worst: EmailSeverity;
}

export interface EmailHealthReport {
  checkedAt: string;
  domains: EmailDomainHealth[];
}

export const useAdminEmailHealth = () => {
  const getHealth = () => $authFetch<EmailHealthReport>('/api/admin/email/health');
  return { getHealth };
};
