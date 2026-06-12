<script setup lang="ts">
  // DMCA policy (keystone §12). Notice → takedown → counter-notice → repeat-
  // infringer. DRAFT pending legal review. The designated-agent block below is a
  // PLACEHOLDER — it must be completed with the agent registered with the U.S.
  // Copyright Office (DMCA Designated Agent Directory) before launch.
  import { HERO_TYPES } from '~~/data/models/generic';

  const effectiveDate = 'June 12, 2026';
  const agentEmail = 'classicminidiy@gmail.com';

  useHead({
    title: 'DMCA Policy | Classic Mini DIY',
    link: [{ rel: 'canonical', href: 'https://classicminidiy.com/legal/dmca' }],
  });
  useSeoMeta({
    description:
      'Classic Mini DIY DMCA policy — how to submit a copyright takedown notice or counter-notice, and our repeat-infringer policy for the 3D model library.',
    ogTitle: 'DMCA Policy | Classic Mini DIY',
    ogType: 'website',
  });
</script>

<template>
  <hero title="DMCA Policy" :subtitle="'Copyright takedown &amp; counter-notice'" :heroType="HERO_TYPES.ARCHIVE" :navigation="true" />

  <div class="container mx-auto px-4 py-8 max-w-3xl">
    <breadcrumb class="my-6" page="DMCA Policy" />

    <p class="text-sm opacity-60 mb-6">Effective {{ effectiveDate }}</p>

    <p class="mb-4">
      Classic Mini DIY respects the intellectual property of others and complies with the Digital Millennium Copyright
      Act (17 U.S.C. § 512). We respond to valid notices of claimed copyright infringement relating to material in the
      3D model library, and we terminate the accounts of repeat infringers.
    </p>

    <!-- DESIGNATED AGENT -->
    <section class="mb-8">
      <h2 class="text-2xl font-bold mb-3">Designated Copyright Agent</h2>
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body p-4 text-sm">
          <p>Send copyright notices to our designated agent:</p>
          <p class="mt-2">
            <strong>Classic Mini DIY — DMCA Agent</strong><br />
            Email: <a :href="`mailto:${agentEmail}`" class="link link-primary">{{ agentEmail }}</a><br />
            <span class="opacity-60">Mailing address on file with the U.S. Copyright Office DMCA Designated Agent Directory.</span>
          </p>
        </div>
      </div>
    </section>

    <!-- TAKEDOWN NOTICE -->
    <section class="mb-8">
      <h2 class="text-2xl font-bold mb-3">Filing a takedown notice</h2>
      <p class="mb-3">
        If you believe material in the model library infringes your copyright, send our agent a written notice that
        includes all of the following:
      </p>
      <ol class="list-decimal pl-6 space-y-2 mb-3">
        <li>Your physical or electronic signature.</li>
        <li>Identification of the copyrighted work you claim has been infringed.</li>
        <li>Identification of the material that you claim is infringing, with enough detail for us to locate it — the
          model's URL is ideal.</li>
        <li>Your name, mailing address, telephone number, and email address.</li>
        <li>A statement that you have a good-faith belief that the disputed use is not authorized by the copyright
          owner, its agent, or the law.</li>
        <li>A statement, made under penalty of perjury, that the information in your notice is accurate and that you are
          the copyright owner or are authorized to act on the owner's behalf.</li>
      </ol>
      <p class="mb-2">
        On receipt of a valid notice we will expeditiously remove or disable access to the material and notify the
        member who uploaded it.
      </p>
      <p class="text-sm opacity-70">
        Note: under 17 U.S.C. § 512(f), anyone who knowingly materially misrepresents that material is infringing may be
        liable for damages.
      </p>
    </section>

    <!-- COUNTER NOTICE -->
    <section class="mb-8">
      <h2 class="text-2xl font-bold mb-3">Filing a counter-notice</h2>
      <p class="mb-3">
        If your material was removed and you believe that was a mistake or misidentification, you may send our agent a
        counter-notice that includes:
      </p>
      <ol class="list-decimal pl-6 space-y-2 mb-3">
        <li>Your physical or electronic signature.</li>
        <li>Identification of the material that was removed and the location where it appeared before removal.</li>
        <li>A statement, under penalty of perjury, that you have a good-faith belief the material was removed as a
          result of mistake or misidentification.</li>
        <li>Your name, mailing address, and telephone number, and a statement that you consent to the jurisdiction of
          the federal court for your district (or, if outside the U.S., any district in which we may be found) and that
          you will accept service of process from the party who filed the original notice.</li>
      </ol>
      <p>
        If we receive a valid counter-notice, we may restore the material in 10–14 business days unless the original
        complainant notifies us that they have filed a court action to restrain the allegedly infringing activity.
      </p>
    </section>

    <!-- REPEAT INFRINGER -->
    <section class="mb-8">
      <h2 class="text-2xl font-bold mb-3">Repeat-infringer policy</h2>
      <p class="mb-3">
        We terminate, in appropriate circumstances, the accounts of members who are repeat infringers. A seller who
        accrues three upheld copyright takedowns has selling disabled and their account placed under review, in
        addition to any other action we deem appropriate.
      </p>
    </section>

    <p class="text-sm opacity-60">
      This policy supplements our
      <NuxtLink to="/legal/model-terms" class="link link-primary">Model Library Terms</NuxtLink> and
      <NuxtLink to="/privacy" class="link link-primary">Privacy Policy</NuxtLink>.
    </p>
  </div>
</template>
