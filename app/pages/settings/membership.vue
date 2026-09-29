<script lang="ts" setup>
  // Account section: settings.vue renders the sign-in card in its place when
  // there is no session. /membership stays the public sales and checkout page;
  // this is where a member manages theirs.
  definePageMeta({ settingsAuth: true });

  const { t } = useI18n();
  // `isSustainingMember` reads the profile, which loads after the session: right
  // after sign-in `user` is set and `userProfile` is still null. Wait for the
  // profile, so a member never sees the join card.
  const { isSustainingMemberUser, mountedProfile } = useMountedAuth();

  // A profile that never arrives (a failed read, no row) must not leave the
  // section spinning: after a bounded wait, fall back to the join card, which
  // links to /membership where the full state resolves.
  const PROFILE_WAIT_MS = 8000;
  const profileWaitExpired = ref(false);
  let profileWaitTimer: ReturnType<typeof setTimeout> | undefined;
  onMounted(() => {
    profileWaitTimer = setTimeout(() => (profileWaitExpired.value = true), PROFILE_WAIT_MS);
  });
  onBeforeUnmount(() => clearTimeout(profileWaitTimer));
  const waitingForProfile = computed(() => !mountedProfile.value && !profileWaitExpired.value);
</script>

<template>
  <div class="space-y-6" data-testid="settings-membership">
    <h2 class="text-xl font-semibold">{{ t('heading') }}</h2>

    <div v-if="waitingForProfile" class="card border border-base-300 bg-base-100 shadow-sm">
      <div class="card-body items-center py-12 text-center">
        <i class="fas fa-spinner fa-spin text-3xl text-primary" aria-hidden="true"></i>
      </div>
    </div>

    <MembershipManageCard v-else-if="isSustainingMemberUser" />

    <div v-else class="card border border-base-300 bg-base-100 shadow-sm" data-testid="settings-membership-join">
      <div class="card-body">
        <div class="flex flex-wrap items-center gap-3">
          <i class="fas fa-star text-2xl text-warning" aria-hidden="true"></i>
          <h3 class="text-lg font-bold">{{ t('join_title') }}</h3>
        </div>
        <p class="opacity-70">{{ t('join_body') }}</p>
        <div class="card-actions mt-2">
          <NuxtLink to="/membership#ways-to-join" class="btn btn-primary">
            {{ t('join_cta') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "heading": "Membership",
    "join_title": "Become a Sustaining Member",
    "join_body": "Members get the badge, the members-only Discord, members-only blog posts, free premium marketplace listings and more DIY Mini Bot questions.",
    "join_cta": "See plans and join"
  },
  "es": {
    "heading": "Membresía",
    "join_title": "Hazte Miembro Colaborador",
    "join_body": "Los miembros obtienen la insignia, el Discord exclusivo, entradas exclusivas del blog, anuncios premium gratis en el mercado y más preguntas al DIY Mini Bot.",
    "join_cta": "Ver planes y unirse"
  },
  "fr": {
    "heading": "Adhésion",
    "join_title": "Devenez membre bienfaiteur",
    "join_body": "Les membres obtiennent le badge, le Discord réservé, des articles de blog réservés, des annonces premium gratuites et plus de questions au DIY Mini Bot.",
    "join_cta": "Voir les formules et adhérer"
  },
  "de": {
    "heading": "Mitgliedschaft",
    "join_title": "Werden Sie förderndes Mitglied",
    "join_body": "Mitglieder erhalten das Abzeichen, den Mitglieder-Discord, exklusive Blogbeiträge, kostenlose Premium-Anzeigen und mehr Fragen an den DIY Mini Bot.",
    "join_cta": "Tarife ansehen und beitreten"
  },
  "it": {
    "heading": "Abbonamento",
    "join_title": "Diventa Membro Sostenitore",
    "join_body": "I membri ottengono il badge, il Discord riservato, articoli del blog riservati, annunci premium gratuiti e più domande al DIY Mini Bot.",
    "join_cta": "Vedi i piani e iscriviti"
  },
  "pt": {
    "heading": "Assinatura",
    "join_title": "Torne-se um Membro Apoiador",
    "join_body": "Os membros recebem o selo, o Discord exclusivo, posts exclusivos do blog, anúncios premium grátis no mercado e mais perguntas ao DIY Mini Bot.",
    "join_cta": "Ver planos e assinar"
  },
  "ru": {
    "heading": "Членство",
    "join_title": "Станьте поддерживающим участником",
    "join_body": "Участники получают значок, закрытый Discord, закрытые записи блога, бесплатные премиум-объявления и больше вопросов к DIY Mini Bot.",
    "join_cta": "Смотреть тарифы и вступить"
  },
  "ja": {
    "heading": "メンバーシップ",
    "join_title": "サステイニングメンバーになる",
    "join_body": "メンバーにはバッジ、メンバー限定 Discord、限定ブログ記事、無料のプレミアム出品、DIY Mini Bot への追加の質問が付きます。",
    "join_cta": "プランを見て参加する"
  },
  "zh": {
    "heading": "会员",
    "join_title": "成为支持会员",
    "join_body": "会员可获得徽章、会员专属 Discord、会员专属博客文章、免费高级市场刊登以及更多 DIY Mini Bot 提问次数。",
    "join_cta": "查看方案并加入"
  },
  "ko": {
    "heading": "멤버십",
    "join_title": "후원 회원이 되세요",
    "join_body": "회원은 배지, 회원 전용 Discord, 회원 전용 블로그 글, 무료 프리미엄 마켓 등록, 더 많은 DIY Mini Bot 질문을 받습니다.",
    "join_cta": "플랜 보고 가입하기"
  }
}
</i18n>
