<script lang="ts" setup>
  import type { ClaimableRegistryEntry } from '../../data/models/registry';

  /**
   * "Is this your Mini?" prompt.
   *
   * Register entries migrated from DynamoDB carry only a free-text submitter name
   * and email — no account. classicminidiy-supabase #65 linked the ones whose
   * email matched a CONFIRMED account; everyone else claims theirs here once they
   * sign up and confirm.
   *
   * Deliberately a prompt, not a silent auto-link: attaching someone's car to a
   * newly created account without asking is worth a confirmation, and the entry
   * shown is the proof the user needs to recognise it as theirs.
   *
   * The RPC returns nothing for an unauthenticated or unconfirmed caller, so this
   * renders nothing rather than nagging logged-out visitors.
   */
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { listClaimable, claimEntry } = useRegistry();
  const toast = useToast();
  const { track } = useAnalytics();

  const emit = defineEmits<{ claimed: [] }>();

  const entries = ref<ClaimableRegistryEntry[]>([]);
  const claiming = ref<string | null>(null);
  const dismissed = ref(false);

  const refresh = async () => {
    if (!isAuthenticated.value) {
      entries.value = [];
      return;
    }
    entries.value = await listClaimable();
  };

  // Client-only: depends on the auth session, and re-runs when the user signs in
  // or out without a page change.
  onMounted(refresh);
  watch(isAuthenticated, refresh);

  const claim = async (entry: ClaimableRegistryEntry) => {
    claiming.value = entry.id;
    try {
      await claimEntry(entry.id);
      entries.value = entries.value.filter((e) => e.id !== entry.id);
      toast.add({
        title: t('claimed_title'),
        description: t('claimed_description', { year: entry.year, model: entry.model }),
        color: 'success',
        icon: 'i-fa6-solid-circle-check',
      });
      track?.('registry_entry_claimed', { entry_id: entry.id });
      emit('claimed');
    } catch (e: any) {
      // The RPC refuses a mismatched or already-claimed entry; surface its message
      // rather than a generic failure, since "already claimed" is actionable.
      toast.add({
        title: t('claim_failed_title'),
        description: e?.message || t('claim_failed_description'),
        color: 'error',
        icon: 'i-fa6-solid-triangle-exclamation',
      });
    } finally {
      claiming.value = null;
    }
  };
</script>

<template>
  <div v-if="entries.length > 0 && !dismissed" class="card bg-base-100 shadow-sm border border-primary/40 mb-6">
    <div class="card-body">
      <div class="flex items-start justify-between gap-4">
        <h3 class="card-title text-lg">
          <i class="fas fa-car-side text-primary mr-2" aria-hidden="true"></i>
          {{ t('heading', entries.length) }}
        </h3>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-circle"
          :aria-label="t('dismiss')"
          @click="dismissed = true"
        >
          <i class="fas fa-xmark" aria-hidden="true"></i>
        </button>
      </div>

      <p class="text-sm text-base-content/70">{{ t('description') }}</p>

      <ul class="mt-2 divide-y divide-base-300">
        <li v-for="entry in entries" :key="entry.id" class="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <div class="font-semibold">{{ entry.year }} {{ entry.model || t('unknown_model') }}</div>
            <div class="text-sm text-base-content/70">
              <span v-if="entry.bodyNum">{{ t('body_number', { value: entry.bodyNum }) }}</span>
              <span v-if="entry.bodyNum && entry.submittedBy"> &middot; </span>
              <span v-if="entry.submittedBy">{{ t('submitted_by', { value: entry.submittedBy }) }}</span>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" :disabled="claiming === entry.id" @click="claim(entry)">
            <span v-if="claiming === entry.id" class="loading loading-spinner loading-xs" aria-hidden="true"></span>
            {{ claiming === entry.id ? t('claiming') : t('claim') }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "heading": "This might be your Mini | We found {count} entries that might be yours",
    "description": "A register entry was submitted using your email address before you had an account. Claim it to have it listed as yours.",
    "claim": "This is mine",
    "claiming": "Claiming...",
    "dismiss": "Dismiss",
    "body_number": "Body no. {value}",
    "submitted_by": "Submitted by {value}",
    "unknown_model": "Mini",
    "claimed_title": "Entry claimed",
    "claimed_description": "Your {year} {model} is now linked to your account.",
    "claim_failed_title": "Could not claim entry",
    "claim_failed_description": "Please try again later."
  },
  "de": {
    "heading": "Das könnte Ihr Mini sein | Wir haben {count} Einträge gefunden, die Ihnen gehören könnten",
    "description": "Ein Registereintrag wurde mit Ihrer E-Mail-Adresse eingereicht, bevor Sie ein Konto hatten. Beanspruchen Sie ihn, damit er Ihnen zugeordnet wird.",
    "claim": "Das gehört mir",
    "claiming": "Wird beansprucht...",
    "dismiss": "Schließen",
    "body_number": "Karosserie-Nr. {value}",
    "submitted_by": "Eingereicht von {value}",
    "unknown_model": "Mini",
    "claimed_title": "Eintrag beansprucht",
    "claimed_description": "Ihr {year} {model} ist jetzt mit Ihrem Konto verknüpft.",
    "claim_failed_title": "Eintrag konnte nicht beansprucht werden",
    "claim_failed_description": "Bitte versuchen Sie es später erneut."
  },
  "es": {
    "heading": "Este podría ser su Mini | Encontramos {count} entradas que podrían ser suyas",
    "description": "Se envió una entrada al registro con su dirección de correo antes de que tuviera una cuenta. Reclámela para que aparezca como suya.",
    "claim": "Esta es mía",
    "claiming": "Reclamando...",
    "dismiss": "Descartar",
    "body_number": "N.º de carrocería {value}",
    "submitted_by": "Enviado por {value}",
    "unknown_model": "Mini",
    "claimed_title": "Entrada reclamada",
    "claimed_description": "Su {year} {model} ya está vinculado a su cuenta.",
    "claim_failed_title": "No se pudo reclamar la entrada",
    "claim_failed_description": "Inténtelo de nuevo más tarde."
  },
  "fr": {
    "heading": "Ceci est peut-être votre Mini | Nous avons trouvé {count} entrées qui pourraient être les vôtres",
    "description": "Une entrée du registre a été soumise avec votre adresse e-mail avant que vous n'ayez un compte. Réclamez-la pour qu'elle vous soit attribuée.",
    "claim": "C'est la mienne",
    "claiming": "Réclamation...",
    "dismiss": "Fermer",
    "body_number": "N° de caisse {value}",
    "submitted_by": "Soumis par {value}",
    "unknown_model": "Mini",
    "claimed_title": "Entrée réclamée",
    "claimed_description": "Votre {year} {model} est maintenant liée à votre compte.",
    "claim_failed_title": "Impossible de réclamer l'entrée",
    "claim_failed_description": "Veuillez réessayer plus tard."
  },
  "it": {
    "heading": "Questa potrebbe essere la tua Mini | Abbiamo trovato {count} voci che potrebbero essere tue",
    "description": "Una voce del registro è stata inviata con il tuo indirizzo email prima che avessi un account. Rivendicala per averla assegnata a te.",
    "claim": "Questa è mia",
    "claiming": "Rivendicazione...",
    "dismiss": "Chiudi",
    "body_number": "N. scocca {value}",
    "submitted_by": "Inviato da {value}",
    "unknown_model": "Mini",
    "claimed_title": "Voce rivendicata",
    "claimed_description": "La tua {year} {model} è ora collegata al tuo account.",
    "claim_failed_title": "Impossibile rivendicare la voce",
    "claim_failed_description": "Riprova più tardi."
  },
  "pt": {
    "heading": "Este pode ser o seu Mini | Encontramos {count} entradas que podem ser suas",
    "description": "Uma entrada no registro foi enviada com o seu endereço de e-mail antes de você ter uma conta. Reivindique-a para que fique listada como sua.",
    "claim": "Esta é minha",
    "claiming": "Reivindicando...",
    "dismiss": "Dispensar",
    "body_number": "N.º de carroceria {value}",
    "submitted_by": "Enviado por {value}",
    "unknown_model": "Mini",
    "claimed_title": "Entrada reivindicada",
    "claimed_description": "Seu {year} {model} agora está vinculado à sua conta.",
    "claim_failed_title": "Não foi possível reivindicar a entrada",
    "claim_failed_description": "Tente novamente mais tarde."
  },
  "ru": {
    "heading": "Возможно, это ваш Mini | Мы нашли {count} записей, которые могут быть вашими",
    "description": "Запись в реестре была отправлена с вашего адреса электронной почты до того, как у вас появился аккаунт. Заявите права, чтобы она числилась за вами.",
    "claim": "Это моя",
    "claiming": "Оформление...",
    "dismiss": "Закрыть",
    "body_number": "Номер кузова {value}",
    "submitted_by": "Отправил {value}",
    "unknown_model": "Mini",
    "claimed_title": "Запись закреплена",
    "claimed_description": "Ваш {year} {model} теперь привязан к вашему аккаунту.",
    "claim_failed_title": "Не удалось закрепить запись",
    "claim_failed_description": "Повторите попытку позже."
  },
  "ja": {
    "heading": "あなたのMiniかもしれません | あなたのものと思われる登録が{count}件見つかりました",
    "description": "アカウント作成前に、あなたのメールアドレスで登録が申請されていました。申請するとあなたの車両として表示されます。",
    "claim": "これは私の車です",
    "claiming": "申請中...",
    "dismiss": "閉じる",
    "body_number": "ボディ番号 {value}",
    "submitted_by": "申請者 {value}",
    "unknown_model": "Mini",
    "claimed_title": "登録を紐付けました",
    "claimed_description": "{year} {model} がアカウントに紐付けられました。",
    "claim_failed_title": "登録を紐付けできませんでした",
    "claim_failed_description": "後でもう一度お試しください。"
  },
  "zh": {
    "heading": "这可能是您的 Mini | 我们找到了 {count} 条可能属于您的记录",
    "description": "在您注册账户之前，有人使用您的邮箱提交了一条登记记录。认领后即可显示为您的车辆。",
    "claim": "这是我的",
    "claiming": "认领中...",
    "dismiss": "关闭",
    "body_number": "车身编号 {value}",
    "submitted_by": "提交者 {value}",
    "unknown_model": "Mini",
    "claimed_title": "已认领记录",
    "claimed_description": "您的 {year} {model} 已关联到您的账户。",
    "claim_failed_title": "无法认领该记录",
    "claim_failed_description": "请稍后再试。"
  },
  "ko": {
    "heading": "회원님의 Mini일 수 있습니다 | 회원님의 것으로 보이는 항목 {count}건을 찾았습니다",
    "description": "계정을 만들기 전에 회원님의 이메일 주소로 등록이 제출되었습니다. 인증하면 회원님의 차량으로 표시됩니다.",
    "claim": "제 차량입니다",
    "claiming": "처리 중...",
    "dismiss": "닫기",
    "body_number": "차체 번호 {value}",
    "submitted_by": "제출자 {value}",
    "unknown_model": "Mini",
    "claimed_title": "항목이 연결되었습니다",
    "claimed_description": "{year} {model} 차량이 계정에 연결되었습니다.",
    "claim_failed_title": "항목을 연결할 수 없습니다",
    "claim_failed_description": "나중에 다시 시도해 주세요."
  }
}
</i18n>
