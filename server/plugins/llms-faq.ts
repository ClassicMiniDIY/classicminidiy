import { torqueFaqs, clearanceFaqs, engineCodeFaqs, chassisFaqs, type Faq } from '../../app/utils/geo/generateFaqs';

/**
 * Pushes the generated technical Q&A into /llms-full.txt (nuxt-llms calls the
 * `llms:generate:full` hook with a `contents` array that becomes the response).
 *
 * This is the same data that backs the FAQPage JSON-LD on the technical pages —
 * exposed here as plain text for AI agents that consume llms-full.txt. It is a
 * sanctioned machine-readable surface (not cloaking: it is not the rendered page,
 * and the underlying values are visible on-site in the torque/clearance/decoder
 * tables). `full:` must be enabled in nuxt.config `llms` for the route to exist.
 */
function renderSection(title: string, faqs: Faq[]): string {
  if (!faqs.length) return '';
  const body = faqs.map((f) => `### ${f.q}\n${f.a}`).join('\n\n');
  return `## ${title}\n\n${body}`;
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('llms:generate:full', (_event: unknown, _llms: unknown, contents: string[]) => {
    const doc = [
      '# Classic Mini DIY — Technical Reference Q&A',
      'Answer-first reference for the Classic Mini A-series (1959–2000), generated from the Classic Mini DIY toolbox data.',
      renderSection('Torque specifications', torqueFaqs()),
      renderSection('Clearances and endfloats', clearanceFaqs()),
      renderSection('Engine codes', engineCodeFaqs()),
      renderSection('Chassis / VIN number decoding', chassisFaqs()),
    ]
      .filter(Boolean)
      .join('\n\n');

    contents.push(doc);
  });
});
