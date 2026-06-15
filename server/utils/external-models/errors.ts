/** Shared error type for the external-model scraper (kept separate so both the
 *  dispatcher and the low-level page fetcher can throw it without a cycle). */
export class ScrapeError extends Error {
  constructor(
    message: string,
    public statusCode = 422,
    public site?: string
  ) {
    super(message);
    this.name = 'ScrapeError';
  }
}
