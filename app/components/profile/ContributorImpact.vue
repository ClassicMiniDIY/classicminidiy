<script lang="ts" setup>
  /**
   * Contributor impact + badges (design S9).
   *
   * The lead stat is framed as reach — "4.1k people helped by your
   * contributions" — not as a submission count. Volume is something you did;
   * reach is something that happened because of you, and it is the number that
   * makes a contribution feel worth making.
   *
   * Used on both the own-profile view and the public one; the copy shifts from
   * "your" to "their" via the `possessive` prop.
   */
  const props = withDefaults(
    defineProps<{
      userId: string;
      /** Own profile says "your", a public profile says "their". */
      possessive?: 'your' | 'their';
    }>(),
    { possessive: 'your' }
  );

  const { t } = useI18n();
  const supabase = useSupabase();

  interface Impact {
    people_helped: number;
    wheels_added: number;
    registry_entries: number;
    documents_added: number;
    colors_added: number;
    photos_added: number;
    total_items: number;
  }

  interface BadgeProgress {
    key: string;
    name: string;
    description: string;
    icon: string;
    threshold: number;
    current_value: number;
    earned: boolean;
  }

  const impact = ref<Impact | null>(null);
  const badges = ref<BadgeProgress[]>([]);
  const loading = ref(true);

  /** 4123 → "4.1k". The design shows reach compacted, not comma-grouped. */
  const compact = (value: number) => {
    if (value < 1000) return String(value);
    if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
    return `${(value / 1_000_000).toFixed(1)}m`;
  };

  const earned = computed(() => badges.value.filter((badge) => badge.earned));
  /**
   * One in-progress badge, not all of them: a wall of things you have not done
   * is discouraging, whereas a single "6/25" is a next step.
   */
  const nextUp = computed(() => badges.value.find((badge) => !badge.earned && badge.current_value > 0));

  const load = async () => {
    loading.value = true;
    try {
      const [impactResult, badgeResult] = await Promise.all([
        supabase.rpc('get_contributor_impact', { p_user_id: props.userId }),
        supabase.rpc('get_badge_progress', { p_user_id: props.userId }),
      ]);

      if (!impactResult.error && impactResult.data?.[0]) {
        impact.value = impactResult.data[0] as unknown as Impact;
      }
      if (!badgeResult.error) badges.value = (badgeResult.data ?? []) as unknown as BadgeProgress[];
    } catch (error) {
      console.error('Failed to load contributor impact:', error);
    } finally {
      loading.value = false;
    }
  };

  watch(() => props.userId, load, { immediate: true });
</script>

<template>
  <div v-if="!loading && impact && impact.total_items > 0" class="space-y-5">
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="stat-card">
        <p class="text-[32px] font-extrabold leading-none text-accent">{{ compact(impact.people_helped) }}</p>
        <p class="mt-1.5 text-[13px] opacity-75">{{ t(`helped_${possessive}`) }}</p>
      </div>
      <div class="stat-card">
        <p class="text-[32px] font-extrabold leading-none">{{ impact.wheels_added }}</p>
        <p class="mt-1.5 text-[13px] opacity-75">{{ t('wheels_added') }}</p>
      </div>
      <div class="stat-card">
        <p class="text-[32px] font-extrabold leading-none">{{ impact.registry_entries }}</p>
        <p class="mt-1.5 text-[13px] opacity-75">{{ t('registry_entries') }}</p>
      </div>
    </div>

    <div v-if="earned.length || nextUp" class="flex flex-wrap gap-2.5">
      <span v-for="badge in earned" :key="badge.key" class="badge-pill" :title="badge.description">
        <i :class="badge.icon" aria-hidden="true"></i>
        {{ badge.name }}
      </span>
      <span v-if="nextUp" class="badge-pill is-pending" :title="nextUp.description">
        <i :class="nextUp.icon" aria-hidden="true"></i>
        {{ nextUp.name }} &middot; {{ nextUp.current_value }}/{{ nextUp.threshold }}
      </span>
    </div>

    <p class="text-xs opacity-55">{{ t('helped_footnote') }}</p>
  </div>
</template>

<style scoped>
  .stat-card {
    padding: 1.25rem;
    text-align: center;
    border: 1px solid var(--color-base-300);
    border-radius: var(--radius-box, 0.75rem);
    background: var(--color-base-100);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
  }

  .badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4375rem;
    padding: 0.4375rem 0.9375rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    color: var(--color-accent);
    font-size: 13px;
    font-weight: 700;
  }
  .badge-pill.is-pending {
    background: transparent;
    border: 1px dashed var(--color-base-300);
    color: color-mix(in srgb, var(--color-base-content) 55%, transparent);
    font-weight: 600;
  }
</style>

<i18n lang="json">
{
  "en": {
    "helped_your": "people helped by your contributions",
    "helped_their": "people helped by their contributions",
    "wheels_added": "wheels & fitments added",
    "registry_entries": "registry entries",
    "helped_footnote": "\"Helped\" counts views and downloads of the things that have been added."
  },
  "es": {
    "helped_your": "personas ayudadas por tus contribuciones",
    "helped_their": "personas ayudadas por sus contribuciones",
    "wheels_added": "ruedas y montajes añadidos",
    "registry_entries": "entradas del registro",
    "helped_footnote": "\"Ayudadas\" cuenta las vistas y descargas de lo que se ha añadido."
  },
  "fr": {
    "helped_your": "personnes aidées par vos contributions",
    "helped_their": "personnes aidées par ses contributions",
    "wheels_added": "jantes et montages ajoutés",
    "registry_entries": "entrées de registre",
    "helped_footnote": "« Aidées » compte les vues et téléchargements de ce qui a été ajouté."
  },
  "de": {
    "helped_your": "Menschen, denen deine Beiträge geholfen haben",
    "helped_their": "Menschen, denen diese Beiträge geholfen haben",
    "wheels_added": "Räder & Passungen hinzugefügt",
    "registry_entries": "Registereinträge",
    "helped_footnote": "„Geholfen“ zählt Aufrufe und Downloads der hinzugefügten Inhalte."
  },
  "it": {
    "helped_your": "persone aiutate dai tuoi contributi",
    "helped_their": "persone aiutate dai suoi contributi",
    "wheels_added": "cerchi e montaggi aggiunti",
    "registry_entries": "voci del registro",
    "helped_footnote": "\"Aiutate\" conta visualizzazioni e download di ciò che è stato aggiunto."
  },
  "pt": {
    "helped_your": "pessoas ajudadas pelas suas contribuições",
    "helped_their": "pessoas ajudadas pelas contribuições",
    "wheels_added": "jantes e montagens adicionadas",
    "registry_entries": "entradas de registo",
    "helped_footnote": "\"Ajudadas\" conta visualizações e downloads do que foi adicionado."
  },
  "ru": {
    "helped_your": "людей, которым помогли ваши материалы",
    "helped_their": "людей, которым помогли эти материалы",
    "wheels_added": "дисков и параметров установки добавлено",
    "registry_entries": "записей в реестре",
    "helped_footnote": "«Помогли» — это просмотры и загрузки добавленных материалов."
  },
  "ja": {
    "helped_your": "人があなたの投稿に助けられました",
    "helped_their": "人がこの方の投稿に助けられました",
    "wheels_added": "件のホイール・フィットメントを追加",
    "registry_entries": "件のレジストリ登録",
    "helped_footnote": "「助けられた」は追加された内容の閲覧数とダウンロード数です。"
  },
  "zh": {
    "helped_your": "人因你的贡献而受益",
    "helped_their": "人因这些贡献而受益",
    "wheels_added": "个轮毂与安装数据",
    "registry_entries": "条注册记录",
    "helped_footnote": "“受益”统计已添加内容的浏览量和下载量。"
  },
  "ko": {
    "helped_your": "명이 회원님의 기여로 도움을 받았습니다",
    "helped_their": "명이 이 기여로 도움을 받았습니다",
    "wheels_added": "개의 휠·장착 정보 등록",
    "registry_entries": "건의 레지스트리 항목",
    "helped_footnote": "'도움'은 등록된 항목의 조회수와 다운로드 수입니다."
  }
}
</i18n>
