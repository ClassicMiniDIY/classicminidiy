<script setup lang="ts">
  // Model Library Terms of Use & Safety (keystone §11, §12). The "as-is, not
  // certified for road use" safety attestation buyers and sellers agree to.
  // DRAFT — MUST pass legal review before launch (run alongside the Paid File
  // License text).
  import { HERO_TYPES } from '~~/data/models/generic';

  const effectiveDate = 'June 12, 2026';

  useHead({
    title: 'Model Library Terms & Safety | Classic Mini DIY',
    link: [{ rel: 'canonical', href: 'https://classicminidiy.com/legal/model-terms' }],
  });
  useSeoMeta({
    description:
      'Terms of use and safety disclaimer for the Classic Mini DIY 3D model library — contributions, buying and selling, safety-critical parts, and moderation.',
    ogTitle: 'Model Library Terms & Safety | Classic Mini DIY',
    ogType: 'website',
  });
</script>

<template>
  <hero title="Model Library Terms & Safety" :subtitle="'Using, sharing, buying, and selling 3D models'" :heroType="HERO_TYPES.ARCHIVE" :navigation="true" />

  <div class="container mx-auto px-4 py-8 max-w-3xl">
    <breadcrumb class="my-6" page="Model Library Terms" />

    <p class="text-sm opacity-60 mb-6">Effective {{ effectiveDate }}</p>

    <p class="mb-6">
      These terms govern your use of the Classic Mini DIY 3D model library, including downloading, uploading, buying,
      and selling 3D-printable models. By using the model library you agree to these terms, our
      <NuxtLink to="/privacy" class="link link-primary">Privacy Policy</NuxtLink>, and our
      <NuxtLink to="/legal/dmca" class="link link-primary">DMCA Policy</NuxtLink>.
    </p>

    <!-- SAFETY -->
    <section class="mb-8">
      <div role="alert" class="alert alert-warning alert-soft mb-4">
        <i class="fas fa-triangle-exclamation"></i>
        <span class="font-semibold">Safety notice — please read.</span>
      </div>
      <h2 class="text-2xl font-bold mb-3">1. Safety disclaimer</h2>
      <p class="mb-3">
        All models and any physical prints made from them are provided <strong>"as is" and without warranty of any
        kind</strong>, express or implied, including fitness for a particular purpose.
      </p>
      <p class="mb-3">
        Models in this library are <strong>not certified, tested, or approved for road use</strong> or for any
        safety-critical, structural, load-bearing, braking, steering, suspension, fuel, or electrical application.
        3D-printed parts can fail without warning. You assume all risk arising from printing, fitting, or using any
        model, and you are solely responsible for verifying that a part is suitable, safe, and legal for your intended
        use. When in doubt, consult a qualified professional and comply with all applicable laws, roadworthiness, and
        inspection requirements.
      </p>
      <p>
        Models flagged as <strong>safety-critical</strong> carry additional caution and require you to acknowledge this
        notice before downloading. Classic Mini DIY and the model's creator are not liable for any loss, injury, or
        damage resulting from the use of any model or print.
      </p>
    </section>

    <!-- ACCOUNTS -->
    <section class="mb-8">
      <h2 class="text-2xl font-bold mb-3">2. Accounts &amp; eligibility</h2>
      <p>
        You need a Classic Mini DIY account to download, upload, buy, or sell models. You are responsible for activity
        under your account. We may suspend or terminate accounts that violate these terms.
      </p>
    </section>

    <!-- CONTRIBUTIONS -->
    <section class="mb-8">
      <h2 class="text-2xl font-bold mb-3">3. Models you upload</h2>
      <ul class="list-disc pl-6 space-y-2">
        <li>You must own the rights to every file you upload, or have the necessary permission and license to share and
          (if priced) sell it. You must accurately set the license for each model.</li>
        <li>You grant Classic Mini DIY a non-exclusive, worldwide license to host, store, display, reproduce, and
          distribute your models for the purpose of operating the library, and to deliver them to buyers under the
          license you selected.</li>
        <li>You must not upload material that infringes any third party's rights, that is designed to be dangerous or
          unlawful, or that violates these terms.</li>
        <li>You confirm that your models are provided as-is and are not represented as certified for road or
          safety-critical use.</li>
      </ul>
    </section>

    <!-- BUYING AND SELLING -->
    <section class="mb-8">
      <h2 class="text-2xl font-bold mb-3">4. Buying &amp; selling</h2>
      <ul class="list-disc pl-6 space-y-2">
        <li>Sellers are the merchants of record for their paid models. Payments are processed through the seller's own
          Stripe account; Classic Mini DIY retains a platform commission on each sale.</li>
        <li>When you buy a paid model you receive a license to the files under the
          <NuxtLink to="/legal/paid-file-license" class="link link-primary">Paid File License</NuxtLink>; you do not
          acquire ownership or copyright. A purchase entitles you to every version of that model.</li>
        <li>Refund requests are handled by the seller through Stripe. The platform commission is not automatically
          refunded.</li>
        <li>Free and tip-supported models are offered under the Creative Commons license shown on each model.</li>
        <li>You may not buy or sell content that you are not entitled to distribute, or use the marketplace for unlawful
          purposes.</li>
      </ul>
    </section>

    <!-- MODERATION -->
    <section class="mb-8">
      <h2 class="text-2xl font-bold mb-3">5. Moderation &amp; takedowns</h2>
      <p>
        We may review, remove, or disable access to any model, and suspend or disable selling for any account, where we
        believe these terms or the law have been violated — including in response to a valid
        <NuxtLink to="/legal/dmca" class="link link-primary">DMCA notice</NuxtLink>. If a model is taken down, it stops
        being distributed to everyone. We may report a model using the in-app report tool on each model page.
      </p>
    </section>

    <!-- LIABILITY -->
    <section class="mb-8">
      <h2 class="text-2xl font-bold mb-3">6. Disclaimers &amp; limitation of liability</h2>
      <p class="mb-3">
        The model library is provided on an "as is" and "as available" basis. To the fullest extent permitted by law,
        Classic Mini DIY disclaims all warranties and is not liable for any indirect, incidental, special, or
        consequential damages, or for any loss, injury, or damage arising from your use of any model or print.
      </p>
      <p>
        You agree to indemnify Classic Mini DIY and its creators against claims arising from your uploads, your sales,
        or your use of models in violation of these terms.
      </p>
    </section>

    <!-- CHANGES -->
    <section class="mb-8">
      <h2 class="text-2xl font-bold mb-3">7. Changes &amp; contact</h2>
      <p>
        We may update these terms from time to time; material changes will be reflected by the effective date above.
        Questions? <NuxtLink to="/contact" class="link link-primary">Contact us</NuxtLink>.
      </p>
    </section>
  </div>
</template>
