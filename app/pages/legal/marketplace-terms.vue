<script setup lang="ts">
  // The Mini Exchange marketplace Terms of Use, ported into CMDIY as the
  // authoritative ENGLISH-ONLY legal page for the /exchange marketplace.
  // Like all /legal/* pages this is intentionally NOT internationalized.
  import { HERO_TYPES } from '~~/data/models/generic';

  const lastUpdated = 'February 7, 2026';

  useHead({
    title: 'Terms of Use | Classic Mini DIY',
    link: [{ rel: 'canonical', href: 'https://www.classicminidiy.com/legal/marketplace-terms' }],
  });
  useSeoMeta({
    description:
      'Terms of Use for The Mini Exchange marketplace. Read our comprehensive terms governing the use of our Classic Mini marketplace platform, including user responsibilities, dispute resolution, and legal provisions.',
    ogTitle: 'Terms of Use | Classic Mini DIY',
    ogType: 'website',
  });
</script>

<template>
  <hero title="Terms of Use" :subtitle="'The Mini Exchange marketplace'" :heroType="HERO_TYPES.ARCHIVE" :navigation="true" />

  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <breadcrumb class="my-6" page="Terms of Use" />

    <p class="text-base-content/70 mb-8">Last updated: {{ lastUpdated }}</p>

    <div class="prose prose-lg max-w-none">
      <h2>1. Acceptance of Terms</h2>
      <p>
        These Terms of Use ("Terms") govern your access to and use of The Mini Exchange website and services
        (collectively, the "Platform"). The Platform is operated by The Mini Exchange ("we," "us," or "our").
      </p>
      <p>
        <strong
          >By accessing or using the Platform, you agree to be bound by these Terms and our Privacy Notice. If you do
          not agree to these Terms, you may not access or use the Platform.</strong
        >
      </p>
      <p>
        These Terms constitute a legally binding agreement between you and The Mini Exchange. We may modify these
        Terms at any time, and your continued use of the Platform after changes are posted constitutes acceptance of
        the modified Terms.
      </p>

      <h2>2. Description of Service and Platform Role</h2>

      <h3>2.1 What We Provide</h3>
      <p>
        The Mini Exchange is an online marketplace platform exclusively for Classic Mini Cooper vehicles (1959-2000).
        The Platform allows users to:
      </p>
      <ul>
        <li>Create and publish classified listings for Classic Mini vehicles, parts, and related items</li>
        <li>Browse, search, and filter available listings</li>
        <li>Communicate with other users through our messaging system</li>
        <li>Post questions and comments on listings</li>
        <li>Save favorite listings to a watchlist</li>
        <li>Purchase premium listing features (Premium tier, $10)</li>
      </ul>

      <h3>2.2 What We Are Not</h3>
      <p>
        <strong
          >The Mini Exchange is a marketplace platform only. We are not a vehicle dealer, broker, auction house, or
          traditional intermediary.</strong
        >
        We do not:
      </p>
      <ul>
        <li>Own, possess, sell, or broker any vehicles, parts, or items listed on the Platform</li>
        <li>Take title to or physical possession of any listed items</li>
        <li>Process, facilitate, or guarantee payments between buyers and sellers for vehicle transactions</li>
        <li>Inspect, verify, authenticate, or validate vehicles or listings</li>
        <li>Arrange transportation, shipping, or delivery of vehicles</li>
        <li>Provide warranties or guarantees regarding vehicles or sellers</li>
        <li>Act as an agent for buyers or sellers</li>
      </ul>
      <p>
        All transactions occur directly between buyers and sellers. We provide the platform for users to connect, but
        we are not a party to any transaction.
      </p>

      <h2>3. User Accounts and Eligibility</h2>

      <h3>3.1 Account Registration</h3>
      <p>
        To access certain features of the Platform (posting listings, messaging, commenting), you must create an
        account by providing a valid email address. When you create an account, you agree to:
      </p>
      <ul>
        <li>Provide accurate, current, and complete information</li>
        <li>Maintain and promptly update your account information to keep it accurate and current</li>
        <li>Maintain the security and confidentiality of your account credentials</li>
        <li>Notify us immediately of any unauthorized access or security breach</li>
        <li>Accept responsibility for all activities that occur under your account</li>
      </ul>
      <p>
        You may not share, transfer, or sell your account to another person. You are solely responsible for your
        account and any activity occurring through it, whether or not you authorized such activity.
      </p>

      <h3>3.2 Eligibility</h3>
      <p>
        You must be at least 18 years old to use the Platform. By using the Platform, you represent and warrant that
        you are at least 18 years of age and have the legal capacity to enter into these Terms.
      </p>

      <h3>3.3 Account Suspension and Termination</h3>
      <p>
        We reserve the right to suspend, disable, or terminate your account at any time, with or without notice, for
        any reason, including if we believe you have:
      </p>
      <ul>
        <li>Violated these Terms or our policies</li>
        <li>Engaged in fraudulent, deceptive, or illegal activity</li>
        <li>Posed a risk to the Platform, other users, or third parties</li>
        <li>Created liability for us or exposed us to legal action</li>
        <li>Engaged in conduct harmful to our business or reputation</li>
      </ul>
      <p>
        If your account is terminated, you may not create a new account or access the Platform using another account
        without our express written permission. Attempting to circumvent an account suspension or termination is a
        violation of these Terms.
      </p>
      <p>
        You may terminate your account at any time by contacting us at
        <a href="mailto:hello@theminiexchange.com" class="link link-primary">hello@theminiexchange.com</a>. Upon
        termination, your right to access and use the Platform immediately ceases.
      </p>

      <h2>4. User Conduct and Prohibited Activities</h2>

      <h3>4.1 General Conduct</h3>
      <p>You agree to use the Platform in a lawful, respectful, and responsible manner. You agree not to:</p>
      <ul>
        <li>Violate any applicable local, state, federal, or international law or regulation</li>
        <li>Engage in any fraudulent, deceptive, misleading, or manipulative activity</li>
        <li>Infringe upon the intellectual property, privacy, publicity, or other rights of any third party</li>
        <li>Harass, threaten, intimidate, abuse, defame, or otherwise harm other users</li>
        <li>Post or transmit content that is unlawful, hateful, discriminatory, or offensive</li>
        <li>
          Impersonate any person or entity, or falsely state or misrepresent your affiliation with any person or
          entity
        </li>
        <li>Interfere with or disrupt the Platform, servers, networks, or security measures</li>
        <li>
          Collect, harvest, or scrape personal data from other users or use automated systems (bots, scripts,
          crawlers) to access the Platform without our express written permission
        </li>
        <li>Attempt to gain unauthorized access to any portion of the Platform, other accounts, or systems</li>
        <li>Transmit viruses, malware, or any other malicious code</li>
        <li>Circumvent any security features or access restrictions</li>
        <li>Use the Platform for any commercial purpose not expressly permitted by these Terms</li>
      </ul>

      <h3>4.2 Prohibited Listing Content</h3>
      <p>When creating listings, you may not:</p>
      <ul>
        <li>Post false, inaccurate, misleading, or deceptive information about vehicles</li>
        <li>Misrepresent the condition, history, title status, or specifications of a vehicle</li>
        <li>List vehicles you do not own or have authority to sell</li>
        <li>List stolen vehicles or vehicles with fraudulent documentation</li>
        <li>
          List items that are not Classic Mini vehicles, parts, or directly related accessories (1959-2000 only)
        </li>
        <li>Use photos you do not own or have permission to use</li>
        <li>Include external links or contact information intended to circumvent the Platform's messaging system</li>
        <li>
          List the same vehicle on multiple accounts or repeatedly post identical listings to manipulate visibility
        </li>
      </ul>

      <h3>4.3 Messaging and Communication</h3>
      <p>When using the Platform's messaging system, you agree not to:</p>
      <ul>
        <li>Send spam, unsolicited advertisements, or promotional content</li>
        <li>Share external payment links or attempt to process payments outside approved methods</li>
        <li>Harass or abuse other users</li>
        <li>Share personal information of others without consent</li>
        <li>Use offensive, abusive, or inappropriate language in messages or public comments</li>
      </ul>
      <p>
        Messages and comments are subject to automated content moderation. Content containing profanity, personal
        contact information (phone numbers, email addresses), or external URLs may be flagged or filtered.
      </p>
      <p>
        The Contact Seller form allows unauthenticated visitors to send inquiries to sellers. By submitting this form,
        you consent to your name and email address being shared with the seller so they can respond to your inquiry.
      </p>

      <h3>4.4 Comments</h3>
      <p>When posting comments on listings, you agree to the following rules:</p>
      <ul>
        <li>Comments are limited to 2,000 characters</li>
        <li>Threaded replies are supported for organized discussion</li>
        <li>Comments may be edited within 15 minutes of posting</li>
        <li>Comments may be deleted at any time by the author</li>
        <li>All comments are subject to automated content moderation and manual review</li>
        <li>Comments that violate these Terms or our content guidelines may be removed without notice</li>
      </ul>

      <h2>5. Listing Guidelines and Seller Obligations</h2>

      <h3>5.1 Listing Requirements</h3>
      <p>When posting a listing, you represent and warrant that:</p>
      <ul>
        <li>All information provided is accurate, complete, and truthful</li>
        <li>You have the legal right and authority to sell the item</li>
        <li>The item is a Classic Mini Cooper vehicle or directly related part/accessory from the 1959-2000 era</li>
        <li>All photos are your own or you have explicit permission to use them</li>
        <li>You have disclosed all known defects, damage, modifications, and issues</li>
        <li>The vehicle has a clear title or you have fully disclosed any title issues</li>
        <li>The listing complies with all applicable laws and regulations</li>
      </ul>

      <h3>5.2 Disclosure Obligations</h3>
      <p>Sellers must disclose:</p>
      <ul>
        <li>Accurate mileage (or indicate if mileage is unknown/exempt)</li>
        <li>Known mechanical issues, defects, or damage</li>
        <li>Previous accidents or collision repairs</li>
        <li>Title status (clean, salvage, rebuilt, etc.)</li>
        <li>Any liens or encumbrances on the vehicle</li>
        <li>Modifications from original factory specifications</li>
        <li>Whether the vehicle is currently registered and emissions-compliant</li>
      </ul>

      <h3>5.3 Listing During Publication</h3>
      <p>
        While your listing is active on The Mini Exchange, you may not simultaneously list the same vehicle on other
        classified or dealer platforms without updating or removing your listing if the vehicle sells elsewhere. You
        must promptly mark listings as sold when a sale is completed.
      </p>

      <h3>5.4 Listing Moderation</h3>
      <p>
        All listings are subject to review and moderation. We reserve the right to reject, remove, or modify any
        listing that violates these Terms, contains inappropriate content, or does not meet our quality standards. We
        may also remove listings that appear to be duplicates, spam, or not relevant to Classic Minis (1959-2000).
      </p>
      <p>
        Certain changes to published listings (such as price, year, model, or VIN) require admin review and approval
        before taking effect. You will be notified when your edit request is approved or rejected.
      </p>
      <p>
        Sold listings may remain publicly visible in our Sold Archive as historical reference for the Classic Mini
        community. Sold listings are attributed to your account unless you delete your account, in which case they
        will be anonymized.
      </p>
      <p>
        Active listing data (including title, description, photos, seller display name, and creation date) is included
        in our public RSS, Atom, and JSON feeds for syndication purposes.
      </p>

      <h2>6. Buyer and Seller Responsibilities</h2>

      <h3>6.1 Buyer Responsibilities and Due Diligence</h3>
      <p>As a buyer, you acknowledge and agree that you are solely responsible for:</p>
      <ul>
        <li>Conducting thorough due diligence before purchasing any vehicle</li>
        <li>
          Inspecting vehicles in person whenever possible before completing a purchase (or arranging professional
          inspection services)
        </li>
        <li>
          Verifying ownership, title status, vehicle history reports, and all claims made in listings independently
        </li>
        <li>Assessing the condition, authenticity, and value of vehicles</li>
        <li>Negotiating terms directly with sellers</li>
        <li>Arranging and paying for transportation, shipping, and delivery</li>
        <li>Ensuring compliance with registration, taxation, and emissions requirements in your jurisdiction</li>
        <li>
          Using secure payment methods and taking appropriate precautions to avoid fraud (never wire money to unknown
          parties)
        </li>
      </ul>
      <p>
        <strong
          >We strongly recommend inspecting any vehicle in person before purchase and never sending payment before
          seeing the vehicle.</strong
        >
      </p>

      <h3>6.2 Seller Responsibilities</h3>
      <p>As a seller, you are solely responsible for:</p>
      <ul>
        <li>Accurately representing your vehicle and complying with all disclosure requirements</li>
        <li>Providing clear and marketable title to any vehicle sold</li>
        <li>Complying with all applicable local, state, and federal laws regarding vehicle sales</li>
        <li>Communicating honestly and promptly with potential buyers</li>
        <li>Removing or marking listings as sold promptly after completing a sale</li>
        <li>Paying any applicable taxes on proceeds from your sales</li>
        <li>Honoring commitments made to buyers</li>
      </ul>

      <h3>6.3 No Platform Involvement in Transactions</h3>
      <p>
        <strong
          >All transactions occur directly between buyers and sellers. The Mini Exchange is not a party to any
          transaction.</strong
        >
        We do not process vehicle payments, hold funds in escrow, or guarantee transactions. Buyers and sellers must
        arrange payment, delivery, and all transaction terms independently.
      </p>

      <h2>7. Payment Terms</h2>

      <h3>7.1 Listing Tiers and Fees</h3>
      <p>The Platform offers two listing tiers:</p>
      <ul>
        <li>
          <strong>Free Tier</strong>: No cost. Up to 5 photos, standard visibility, Q&amp;A comments, and messaging.
          All listings are subject to admin approval before going live.
        </li>
        <li>
          <strong>Premium Tier</strong>: $10 USD one-time payment. Up to 20 photos, featured placement for 30 days,
          priority in search results, homepage carousel exposure, and a featured badge on your listing. All listings
          are subject to admin approval before going live.
        </li>
      </ul>
      <p>
        Premium listing payments are processed securely through Stripe. All fees are non-refundable once your listing
        is published, except as required by law or at our sole discretion.
      </p>

      <h3>7.2 Payment Processing</h3>
      <p>
        Premium listing payments are processed by Stripe, a third-party payment processor. By making a payment, you
        agree to Stripe's Terms of Service and Privacy Policy. We do not store complete payment card information on
        our servers.
      </p>

      <h3>7.3 Taxes</h3>
      <p>
        You are responsible for paying any applicable taxes on premium listing purchases. Sellers are responsible for
        paying any applicable taxes on proceeds from vehicle sales. We do not collect or remit taxes on behalf of
        users.
      </p>

      <h3>7.4 No Vehicle Transaction Fees</h3>
      <p>
        <strong>We do not charge transaction fees or commissions on vehicle sales between buyers and sellers.</strong>
        The Platform's revenue comes solely from optional premium listing features.
      </p>

      <h2>8. Disclaimers and Warranties</h2>

      <h3>8.1 "AS IS" Disclaimer</h3>
      <p>
        <strong
          >THE PLATFORM AND ALL CONTENT, MATERIALS, INFORMATION, LISTINGS, AND SERVICES ARE PROVIDED "AS IS" AND "AS
          AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.</strong
        >
      </p>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY LAW, THE MINI EXCHANGE DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED,
        INCLUDING BUT NOT LIMITED TO:
      </p>
      <ul>
        <li>Warranties of merchantability, fitness for a particular purpose, and non-infringement</li>
        <li>Warranties regarding the accuracy, reliability, completeness, or timeliness of content or listings</li>
        <li>Warranties that the Platform will be uninterrupted, secure, or error-free</li>
        <li>Warranties regarding the quality, safety, or legality of vehicles listed</li>
        <li>Warranties regarding other users or their conduct</li>
      </ul>

      <h3>8.2 No Verification or Endorsement</h3>
      <p>
        <strong
          >We do not verify, authenticate, inspect, or endorse any listings, vehicles, or users. We make no
          representations or warranties about the accuracy of listings, the quality of vehicles, or the
          trustworthiness of users.</strong
        >
        Any reliance on listings or user-generated content is at your own risk.
      </p>

      <h3>8.3 No Guarantee of Results</h3>
      <p>
        We do not guarantee that using the Platform will result in any particular outcome, including the sale or
        purchase of a vehicle. Premium listing features provide enhanced visibility but do not guarantee a sale.
      </p>

      <h2>9. Limitation of Liability</h2>

      <h3>9.1 Damages Limitation</h3>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE MINI EXCHANGE, ITS OFFICERS, DIRECTORS,
        EMPLOYEES, AGENTS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR
        EXEMPLARY DAMAGES ARISING FROM OR RELATED TO YOUR USE OF THE PLATFORM, INCLUDING BUT NOT LIMITED TO:
      </p>
      <ul>
        <li>Loss of profits, revenue, business opportunities, or data</li>
        <li>Loss resulting from fraudulent transactions or misrepresentations by other users</li>
        <li>Vehicle defects, damage, or condition issues</li>
        <li>Personal injury or property damage resulting from vehicles</li>
        <li>Disputes between buyers and sellers</li>
        <li>Unauthorized access to your account or personal information</li>
        <li>Errors, bugs, viruses, or interruptions in Platform service</li>
        <li>Actions or omissions of other users</li>
      </ul>

      <h3>9.2 Liability Cap</h3>
      <p>
        TO THE EXTENT LIABILITY CANNOT BE EXCLUDED BY LAW, OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING
        FROM OR RELATED TO THE PLATFORM SHALL NOT EXCEED THE GREATER OF (A) FIFTY DOLLARS ($50 USD) OR (B) THE TOTAL
        AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO LIABILITY.
      </p>

      <h3>9.3 Release from User Disputes</h3>
      <p>
        <strong
          >YOU RELEASE THE MINI EXCHANGE, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES FROM ALL CLAIMS,
          DEMANDS, AND DAMAGES ARISING OUT OF OR RELATED TO DISPUTES WITH OTHER USERS OR THIRD PARTIES.</strong
        >
      </p>
      <p>
        If you are a California resident, you waive California Civil Code Section 1542, which states: "A general
        release does not extend to claims that the creditor or releasing party does not know or suspect to exist in
        his or her favor at the time of executing the release and that, if known by him or her, would have materially
        affected his or her settlement with the debtor or released party."
      </p>

      <h3>9.4 Force Majeure</h3>
      <p>
        We shall not be liable for any failure or delay in performance due to circumstances beyond our reasonable
        control, including acts of God, natural disasters, war, terrorism, pandemics, labor disputes, or government
        actions.
      </p>

      <h2>10. Intellectual Property</h2>

      <h3>10.1 Platform Ownership</h3>
      <p>
        The Platform, including its design, features, software, code, graphics, user interface, and all content
        (excluding user-generated content), is owned by The Mini Exchange and protected by copyright, trademark, and
        other intellectual property laws. All rights are reserved.
      </p>

      <h3>10.2 Restrictions on Use</h3>
      <p>You may not:</p>
      <ul>
        <li>Copy, modify, distribute, sell, or lease any part of the Platform or its software</li>
        <li>Reverse engineer, decompile, or attempt to extract source code from the Platform</li>
        <li>Remove, alter, or obscure any copyright, trademark, or proprietary notices</li>
        <li>Use the Platform's name, trademarks, or branding without our express written permission</li>
        <li>Build a competing business, product, or service using the Platform or its content</li>
        <li>Frame, mirror, or otherwise incorporate the Platform into another website without permission</li>
      </ul>

      <h3>10.3 User Content License</h3>
      <p>
        By posting content on the Platform (including listings, photos, messages, comments, and descriptions), you
        grant The Mini Exchange a worldwide, non-exclusive, royalty-free, fully paid, sublicensable, and transferable
        license to use, reproduce, modify, adapt, publish, display, distribute, and create derivative works from your
        content for the purpose of operating, promoting, and improving the Platform.
      </p>
      <p>This license continues even after you stop using the Platform or delete your account.</p>

      <h3>10.4 User Content Representations</h3>
      <p>You represent and warrant that:</p>
      <ul>
        <li>You own or have the necessary rights to all content you post</li>
        <li>Your content does not infringe any third-party intellectual property, privacy, or publicity rights</li>
        <li>Your content complies with these Terms and all applicable laws</li>
        <li>You have obtained all necessary permissions to use photos, descriptions, or other materials you post</li>
      </ul>

      <h3>10.5 Copyright Infringement</h3>
      <p>
        If you believe content on the Platform infringes your copyright, please contact us at
        <a href="mailto:hello@theminiexchange.com" class="link link-primary">hello@theminiexchange.com</a>
        with detailed information about the alleged infringement. We will investigate and take appropriate action,
        which may include removing the content.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        <strong
          >You agree to indemnify, defend, and hold harmless The Mini Exchange, its officers, directors, employees,
          agents, affiliates, and service providers from and against any and all claims, demands, losses, liabilities,
          damages, costs, and expenses (including reasonable attorneys' fees) arising from or related to:</strong
        >
      </p>
      <ul>
        <li>Your use or misuse of the Platform</li>
        <li>Your violation of these Terms</li>
        <li>Your violation of any law or regulation</li>
        <li>
          Your violation of any rights of a third party, including intellectual property, privacy, or publicity rights
        </li>
        <li>Your content, including listings, photos, messages, and comments</li>
        <li>Any transaction or dispute with another user</li>
        <li>Your sale or purchase of a vehicle through the Platform</li>
        <li>Any negligence, willful misconduct, or fraud on your part</li>
      </ul>
      <p>
        This indemnification obligation survives termination of your account and your use of the Platform. We reserve
        the right to assume exclusive defense and control of any matter subject to indemnification, at your expense.
      </p>

      <h2>12. Dispute Resolution and Arbitration</h2>

      <h3>12.1 Informal Resolution First</h3>
      <p>
        If you have a dispute with The Mini Exchange, you agree to first contact us at
        <a href="mailto:hello@theminiexchange.com" class="link link-primary">hello@theminiexchange.com</a>
        and attempt to resolve the dispute informally for at least 30 days before initiating arbitration or
        litigation.
      </p>

      <h3>12.2 Binding Arbitration</h3>
      <p>
        <strong
          >PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN
          COURT.</strong
        >
      </p>
      <p>
        You and The Mini Exchange agree that any dispute, claim, or controversy arising out of or relating to these
        Terms or your use of the Platform (except disputes related to intellectual property rights) shall be resolved
        exclusively through binding individual arbitration rather than in court.
      </p>
      <p>
        Arbitration shall be conducted under the American Arbitration Association (AAA) Consumer Arbitration Rules.
      </p>

      <h3>12.3 Class Action Waiver</h3>
      <p>
        <strong
          >YOU AND THE MINI EXCHANGE AGREE THAT DISPUTES SHALL BE RESOLVED ON AN INDIVIDUAL BASIS ONLY. YOU WAIVE YOUR
          RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION.</strong
        >
        Any arbitration shall be conducted on an individual basis and not as a class, consolidated, or representative
        action.
      </p>

      <h3>12.4 Exceptions to Arbitration</h3>
      <p>The following disputes are not subject to arbitration:</p>
      <ul>
        <li>Disputes related to intellectual property rights (trademarks, copyrights, patents)</li>
        <li>Claims that can be brought in small claims court</li>
        <li>
          Requests for injunctive or equitable relief to prevent infringement or misuse of intellectual property
        </li>
      </ul>

      <h3>12.5 User-to-User Disputes</h3>
      <p>
        <strong
          >Disputes between users (buyer-seller disagreements, transaction disputes, etc.) are the sole responsibility
          of the parties involved.</strong
        >
        The Mini Exchange is not obligated to mediate, resolve, or intervene in user-to-user disputes. We encourage
        users to communicate directly and resolve disputes amicably.
      </p>
      <p>
        If you have a dispute with another user, you release The Mini Exchange from all claims, demands, and damages
        arising from or related to that dispute.
      </p>

      <h2>13. Governing Law and Venue</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of the State of California, without
        regard to its conflict of law provisions. Any litigation not subject to arbitration shall be brought
        exclusively in the state or federal courts located in California, and you consent to the personal jurisdiction
        of those courts.
      </p>

      <h2>14. Modifications to Terms</h2>
      <p>
        We reserve the right to modify, amend, or update these Terms at any time, at our sole discretion. When we make
        changes, we will:
      </p>
      <ul>
        <li>Update the "Last Updated" date at the top of this page</li>
        <li>Post the revised Terms on the Platform</li>
        <li>For material changes, provide notice via email or a prominent Platform notification</li>
      </ul>
      <p>
        Your continued use of the Platform after changes are posted constitutes your acceptance of the modified Terms.
        If you do not agree to the modified Terms, you must stop using the Platform immediately.
      </p>

      <h2>15. Modifications to Platform Services</h2>
      <p>
        We reserve the right to modify, suspend, or discontinue any aspect of the Platform (including features,
        pricing, and availability) at any time, with or without notice, and without liability to you or any third
        party.
      </p>

      <h2>16. Privacy</h2>
      <p>
        Your use of the Platform is also governed by our
        <NuxtLink to="/privacy" class="link link-primary">Privacy Notice</NuxtLink>, which describes how we collect,
        use, and protect your personal information. By using the Platform, you consent to our collection and use of
        your information as described in the Privacy Notice.
      </p>

      <h2>17. Third-Party Links and Services</h2>
      <p>
        The Platform may contain links to third-party websites, services, or resources (such as Stripe for payment
        processing). We are not responsible for the content, policies, or practices of third-party websites or
        services. Your use of third-party services is subject to their own terms and policies.
      </p>

      <h2>18. Entire Agreement</h2>
      <p>
        These Terms, together with our Privacy Notice and any other policies referenced herein, constitute the entire
        agreement between you and The Mini Exchange regarding your use of the Platform and supersede all prior
        agreements, understandings, and communications, whether written or oral.
      </p>

      <h2>19. Severability</h2>
      <p>
        If any provision of these Terms is found to be invalid, illegal, or unenforceable by a court of competent
        jurisdiction, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining
        provisions shall remain in full force and effect.
      </p>

      <h2>20. Waiver</h2>
      <p>
        Our failure to enforce any provision of these Terms shall not constitute a waiver of that provision or any
        other provision. No waiver shall be effective unless made in writing and signed by an authorized
        representative of The Mini Exchange.
      </p>

      <h2>21. Assignment</h2>
      <p>
        You may not assign, transfer, or delegate these Terms or your rights and obligations hereunder without our
        prior written consent. We may assign these Terms without restriction. Any attempted assignment in violation of
        this provision is void.
      </p>

      <h2>22. Survival</h2>
      <p>
        Provisions of these Terms that by their nature should survive termination shall survive, including but not
        limited to: intellectual property provisions, disclaimers, limitations of liability, indemnification, dispute
        resolution, and governing law.
      </p>

      <h2>23. Contact Information</h2>
      <p>For questions, concerns, or notices regarding these Terms of Use, please contact us at:</p>
      <p>
        <strong>Email:</strong>
        <a href="mailto:hello@theminiexchange.com" class="link link-primary">hello@theminiexchange.com</a>
      </p>
      <p><strong>Subject Line:</strong> Terms of Use Inquiry</p>

      <div class="alert alert-warning mt-8">
        <i class="fas fa-triangle-exclamation"></i>
        <div>
          <h3 class="font-bold">Important Safety Notice</h3>
          <p class="text-sm mt-1">
            <strong>Always inspect vehicles in person before purchasing.</strong> Verify ownership documentation,
            obtain vehicle history reports, and use secure payment methods. Never wire money to unknown parties or
            send payment before seeing a vehicle in person. If an offer seems too good to be true, it probably is.
            Report suspicious activity to us immediately.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
