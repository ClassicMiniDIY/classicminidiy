<script setup lang="ts">
  // CMDIY Paid File License terms (keystone §7). Canonical human-readable text
  // for the CMDIY-PAID-PERSONAL and CMDIY-PAID-COMMERCIAL license codes; the
  // model_licenses.url column points here. DRAFT — this text and the matching
  // model_licenses.license_text seed MUST pass legal review before launch.
  import { HERO_TYPES } from '~~/data/models/generic';

  const effectiveDate = 'June 12, 2026';

  useHead({
    title: 'Paid File License | Classic Mini DIY',
    link: [{ rel: 'canonical', href: 'https://www.classicminidiy.com/legal/paid-file-license' }],
  });
  useSeoMeta({
    description:
      'The CMDIY Paid File License terms for purchased 3D model files — Personal Use and Commercial Prints — covering permitted use, restrictions, and creator rights.',
    ogTitle: 'Paid File License | Classic Mini DIY',
    ogType: 'website',
  });
</script>

<template>
  <hero title="Paid File License" :subtitle="'Terms for purchased 3D model files'" :heroType="HERO_TYPES.ARCHIVE" :navigation="true" />

  <div class="container mx-auto px-4 py-8 max-w-3xl">
    <breadcrumb class="my-6" page="Paid File License" />

    <p class="text-sm opacity-60 mb-6">Effective {{ effectiveDate }}</p>

    <p class="mb-4">
      These terms govern the digital 3D model files ("Files") you purchase through the Classic Mini DIY model library.
      When you buy a paid model you receive a <strong>license to use the Files</strong> — you do not acquire ownership
      of, or copyright in, the Files. All intellectual-property rights remain with the creator who published them
      ("Creator"). Classic Mini DIY LLC ("Classic Mini DIY") operates the marketplace; the Creator is the seller and
      merchant of record.
    </p>
    <p class="mb-8">
      A purchase grants you access to every version of the model, including versions published later, for as long as
      the model remains available in the library (see Termination below). Each version is governed by the license that
      was in effect when that version was published — if the Creator changes the license, the new license applies only
      to versions published after the change.
    </p>

    <!-- PERSONAL -->
    <section class="mb-10">
      <h2 class="text-2xl font-bold mb-1">CMDIY Paid File License — Personal Use</h2>
      <p class="text-sm opacity-60 mb-4">License code: <code>CMDIY-PAID-PERSONAL</code></p>

      <h3 class="text-lg font-semibold mb-2">You may</h3>
      <ul class="list-disc pl-6 space-y-1 mb-4">
        <li>Download the purchased Files to devices you control.</li>
        <li>Produce an unlimited number of physical prints of the Files for your own personal, non-commercial use.</li>
        <li>Provide the Files to a third-party print service solely to produce prints for your own personal use,
          provided the service does not retain, reuse, or share the Files beyond your print job.</li>
        <li>Re-download every version of the model you purchased, including versions published later, while the model
          remains available in the library.</li>
      </ul>

      <h3 class="text-lg font-semibold mb-2">You may not</h3>
      <ul class="list-disc pl-6 space-y-1 mb-4">
        <li>Redistribute, resell, sublicense, share, publish, or upload the Files anywhere, in whole or in part,
          except as expressly permitted above for print services.</li>
        <li>Sell, trade, or commercially distribute physical prints made from the Files.</li>
        <li>Create and distribute derivative or remixed versions of the Files.</li>
        <li>Remove or alter any attribution, credit, or notices included with the model.</li>
      </ul>
    </section>

    <!-- COMMERCIAL -->
    <section class="mb-10">
      <h2 class="text-2xl font-bold mb-1">CMDIY Paid File License — Commercial Prints</h2>
      <p class="text-sm opacity-60 mb-4">License code: <code>CMDIY-PAID-COMMERCIAL</code></p>

      <p class="mb-4">
        This license includes everything in the Personal Use license above, and additionally permits selling physical
        prints — but never the digital Files themselves.
      </p>

      <h3 class="text-lg font-semibold mb-2">You may</h3>
      <ul class="list-disc pl-6 space-y-1 mb-4">
        <li>Produce unlimited physical prints of the Files.</li>
        <li>Sell those physical prints, including in the course of a business.</li>
        <li>Provide the Files to a third-party print service to produce prints, including prints for sale, provided
          the service does not retain, reuse, or share the Files beyond your print job.</li>
      </ul>

      <h3 class="text-lg font-semibold mb-2">You may not</h3>
      <ul class="list-disc pl-6 space-y-1 mb-4">
        <li>Redistribute, resell, sublicense, share, publish, or upload the digital Files in any form, except as
          expressly permitted above for print services.</li>
        <li>Provide the Files to a third party to print on your behalf in a way that gives them access to the Files
          beyond the single print job.</li>
        <li>Create and distribute derivative or remixed versions of the Files.</li>
        <li>Remove or alter any attribution, credit, or notices included with the model.</li>
      </ul>
    </section>

    <!-- COMMON TERMS -->
    <section class="mb-10">
      <h2 class="text-2xl font-bold mb-3">Terms common to both licenses</h2>

      <h3 class="text-lg font-semibold mb-1">Creator rights</h3>
      <p class="mb-4">
        The Creator retains all copyright and other intellectual-property rights in the Files. This license grants only
        the limited, non-exclusive, non-transferable rights described above.
      </p>

      <h3 class="text-lg font-semibold mb-1">No warranty &amp; safety</h3>
      <p class="mb-4">
        The Files and any prints made from them are provided <strong>"as is", without warranty of any kind</strong>.
        They are not certified, tested, or approved for road use or for any safety-critical, structural, or
        load-bearing application. You are responsible for verifying fitness for your intended use. See the
        <NuxtLink to="/legal/model-terms" class="link link-primary">Model Library Terms &amp; Safety</NuxtLink>.
      </p>

      <h3 class="text-lg font-semibold mb-1">Payments &amp; refunds</h3>
      <p class="mb-4">
        Payment is processed by Stripe directly to the Creator, who is the merchant of record. Classic Mini DIY retains
        a platform commission on each sale. <strong>Digital files are delivered immediately, so all sales are final and
        non-refundable except where a refund is required by law.</strong> By purchasing, you confirm that you want the
        files made available immediately and, to the extent permitted by law, you waive any right of cancellation or
        withdrawal. Any refund a Creator chooses to grant is at their sole discretion; the platform commission is not
        refunded.
      </p>

      <h3 class="text-lg font-semibold mb-1">Termination</h3>
      <p class="mb-4">
        This license terminates automatically if you breach it. If a model is removed for an intellectual-property or
        policy violation, distribution stops for everyone; the rights of buyers who previously purchased the model are
        addressed in the Model Library Terms. The "You may not" restrictions of each license, the Creator rights
        section, and the No warranty &amp; safety section survive termination.
      </p>

      <h3 class="text-lg font-semibold mb-1">Free models</h3>
      <p class="mb-4">
        Free and tip-supported models are licensed under a Creative Commons license shown on each model, not under these
        paid terms. Refer to the specific license listed on the model page.
      </p>
    </section>

    <p class="text-sm opacity-60">
      Questions about licensing? <NuxtLink to="/contact" class="link link-primary">Contact us</NuxtLink>.
    </p>
  </div>
</template>
