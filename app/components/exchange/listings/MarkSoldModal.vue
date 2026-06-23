<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold mb-2">{{ t('title') }}</h3>
      <p class="text-base-content/70 mb-6">
        {{ t('subtitle') }}
      </p>

      <div class="space-y-4">
        <!-- Final Sale Price -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('finalPrice.label') }}</legend>
          <div class="join w-full">
            <span class="join-item btn btn-ghost no-animation pointer-events-none">$</span>
            <input
              v-model.number="finalPrice"
              type="number"
              class="input join-item w-full"
              min="0"
              step="1"
              :placeholder="t('finalPrice.placeholder')"
            />
          </div>
          <p class="text-xs text-base-content/50 mt-1">
            {{ t('finalPrice.hint') }}
          </p>
        </fieldset>

        <!-- Sold To (optional, from conversations) -->
        <fieldset v-if="conversations.length > 0" class="fieldset">
          <legend class="fieldset-legend">{{ t('soldTo.label') }}</legend>
          <select v-model="soldToUserId" class="select w-full">
            <option value="">{{ t('soldTo.preferNot') }}</option>
            <option v-for="conv in conversations" :key="conv.id" :value="conv.buyerId">
              {{ conv.buyerName }}
            </option>
          </select>
          <p class="text-xs text-base-content/50 mt-1">
            {{ t('soldTo.hint') }}
          </p>
        </fieldset>

        <!-- Notify Watchers -->
        <label class="flex items-center gap-3 cursor-pointer">
          <input v-model="notifyWatchers" type="checkbox" class="checkbox checkbox-sm checkbox-primary" />
          <div>
            <span class="font-medium">{{ t('notifyWatchers.label') }}</span>
            <p class="text-xs text-base-content/50">
              {{ t('notifyWatchers.hint') }}
            </p>
          </div>
        </label>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" @click="close">{{ t('cancel') }}</button>
        <button class="btn btn-success" :disabled="props.saving" @click="confirm">
          <span v-if="props.saving" class="loading loading-spinner loading-xs"></span>
          <i v-else class="fas fa-circle-check"></i>
          {{ t('confirmBtn') }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';

  const { t } = useI18n();

  const props = withDefaults(
    defineProps<{
      listing: ListingWithPhotos | null;
      saving?: boolean;
    }>(),
    {
      saving: false,
    }
  );

  const emit = defineEmits<{
    confirmed: [data: { finalPrice: number | null; soldToUserId: string | null; notifyWatchers: boolean }];
  }>();

  const supabase = useSupabase();
  const { user } = useAuth();

  const dialogRef = ref<HTMLDialogElement | null>(null);
  const finalPrice = ref<number | null>(null);
  const soldToUserId = ref('');
  const notifyWatchers = ref(true);
  const conversations = ref<Array<{ id: string; buyerId: string; buyerName: string }>>([]);

  // Fetch conversations for this listing to populate the "Sold To" dropdown
  const loadConversations = async () => {
    if (!props.listing || !user.value) return;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(
          `
          id,
          buyer_id,
          buyer:public_profiles!conversations_buyer_id_fkey (
            id,
            display_name,
            username
          )
        `
        )
        .eq('listing_id', props.listing.id)
        .eq('seller_id', user.value.id);

      if (error) throw error;

      conversations.value = (data || []).map((conv: any) => ({
        id: conv.id,
        buyerId: conv.buyer_id,
        buyerName: conv.buyer?.display_name || conv.buyer?.username || t('anonymous'),
      }));
    } catch (error) {
      console.error('Failed to load conversations:', error);
      conversations.value = [];
    }
  };

  const show = () => {
    // Reset state
    finalPrice.value = props.listing?.price || null;
    soldToUserId.value = '';
    notifyWatchers.value = true;

    loadConversations();
    dialogRef.value?.showModal();
  };

  const close = () => {
    dialogRef.value?.close();
  };

  const confirm = () => {
    emit('confirmed', {
      finalPrice: finalPrice.value,
      soldToUserId: soldToUserId.value || null,
      notifyWatchers: notifyWatchers.value,
    });
  };

  defineExpose({ show, close });
</script>

<i18n lang="json">
{
  "en": {
    "title": "Mark as Sold",
    "subtitle": "Congratulations on the sale! Fill in a few details to complete the process.",
    "anonymous": "Anonymous",
    "cancel": "Cancel",
    "confirmBtn": "Mark as Sold",
    "finalPrice": {
      "label": "Final Sale Price",
      "placeholder": "Enter the final agreed price",
      "hint": "This helps other Mini enthusiasts gauge market values. Leave blank to keep private."
    },
    "soldTo": {
      "label": "Sold To (Optional)",
      "preferNot": "Prefer not to say",
      "hint": "Select the buyer to notify them and track the completed deal."
    },
    "notifyWatchers": {
      "label": "Notify watchers",
      "hint": "Let users who saved this listing know it has sold."
    }
  },
  "es": {
    "title": "Marcar como vendido",
    "subtitle": "¡Enhorabuena por la venta! Completa algunos datos para finalizar el proceso.",
    "anonymous": "Anónimo",
    "cancel": "Cancelar",
    "confirmBtn": "Marcar como vendido",
    "finalPrice": {
      "label": "Precio final de venta",
      "placeholder": "Introduce el precio final acordado",
      "hint": "Esto ayuda a otros aficionados al Mini a estimar el valor de mercado. Déjalo en blanco para mantenerlo privado."
    },
    "soldTo": {
      "label": "Vendido a (opcional)",
      "preferNot": "Prefiero no decirlo",
      "hint": "Selecciona al comprador para notificarle y registrar el trato completado."
    },
    "notifyWatchers": {
      "label": "Notificar a los seguidores",
      "hint": "Avisa a los usuarios que guardaron este anuncio de que se ha vendido."
    }
  },
  "fr": {
    "title": "Marquer comme vendu",
    "subtitle": "Félicitations pour la vente ! Renseignez quelques détails pour terminer le processus.",
    "anonymous": "Anonyme",
    "cancel": "Annuler",
    "confirmBtn": "Marquer comme vendu",
    "finalPrice": {
      "label": "Prix de vente final",
      "placeholder": "Saisissez le prix final convenu",
      "hint": "Cela aide les autres passionnés de Mini à évaluer les prix du marché. Laissez vide pour garder privé."
    },
    "soldTo": {
      "label": "Vendu à (facultatif)",
      "preferNot": "Je préfère ne pas le dire",
      "hint": "Sélectionnez l'acheteur pour le notifier et suivre la transaction terminée."
    },
    "notifyWatchers": {
      "label": "Notifier les abonnés",
      "hint": "Informez les utilisateurs qui ont enregistré cette annonce qu'elle est vendue."
    }
  },
  "de": {
    "title": "Als verkauft markieren",
    "subtitle": "Glückwunsch zum Verkauf! Trage ein paar Details ein, um den Vorgang abzuschließen.",
    "anonymous": "Anonym",
    "cancel": "Abbrechen",
    "confirmBtn": "Als verkauft markieren",
    "finalPrice": {
      "label": "Endgültiger Verkaufspreis",
      "placeholder": "Vereinbarten Endpreis eingeben",
      "hint": "Das hilft anderen Mini-Enthusiasten, Marktwerte einzuschätzen. Leer lassen, um es privat zu halten."
    },
    "soldTo": {
      "label": "Verkauft an (optional)",
      "preferNot": "Möchte ich nicht angeben",
      "hint": "Wähle den Käufer aus, um ihn zu benachrichtigen und den abgeschlossenen Deal zu verfolgen."
    },
    "notifyWatchers": {
      "label": "Beobachter benachrichtigen",
      "hint": "Informiere Nutzer, die diese Anzeige gespeichert haben, dass sie verkauft ist."
    }
  },
  "it": {
    "title": "Segna come venduto",
    "subtitle": "Congratulazioni per la vendita! Inserisci alcuni dettagli per completare il processo.",
    "anonymous": "Anonimo",
    "cancel": "Annulla",
    "confirmBtn": "Segna come venduto",
    "finalPrice": {
      "label": "Prezzo finale di vendita",
      "placeholder": "Inserisci il prezzo finale concordato",
      "hint": "Aiuta gli altri appassionati di Mini a valutare i prezzi di mercato. Lascia vuoto per mantenerlo privato."
    },
    "soldTo": {
      "label": "Venduto a (facoltativo)",
      "preferNot": "Preferisco non dirlo",
      "hint": "Seleziona l'acquirente per notificarlo e tenere traccia dell'affare completato."
    },
    "notifyWatchers": {
      "label": "Avvisa gli osservatori",
      "hint": "Fai sapere agli utenti che hanno salvato questo annuncio che è stato venduto."
    }
  },
  "pt": {
    "title": "Marcar como vendido",
    "subtitle": "Parabéns pela venda! Preencha alguns detalhes para concluir o processo.",
    "anonymous": "Anônimo",
    "cancel": "Cancelar",
    "confirmBtn": "Marcar como vendido",
    "finalPrice": {
      "label": "Preço final de venda",
      "placeholder": "Insira o preço final acordado",
      "hint": "Isso ajuda outros entusiastas do Mini a avaliar os valores de mercado. Deixe em branco para manter privado."
    },
    "soldTo": {
      "label": "Vendido para (opcional)",
      "preferNot": "Prefiro não dizer",
      "hint": "Selecione o comprador para notificá-lo e acompanhar o negócio concluído."
    },
    "notifyWatchers": {
      "label": "Notificar observadores",
      "hint": "Avise os usuários que salvaram este anúncio de que ele foi vendido."
    }
  },
  "ru": {
    "title": "Отметить как проданное",
    "subtitle": "Поздравляем с продажей! Заполните несколько деталей, чтобы завершить процесс.",
    "anonymous": "Аноним",
    "cancel": "Отмена",
    "confirmBtn": "Отметить как проданное",
    "finalPrice": {
      "label": "Окончательная цена продажи",
      "placeholder": "Введите окончательную согласованную цену",
      "hint": "Это помогает другим энтузиастам Mini оценить рыночную стоимость. Оставьте пустым, чтобы сохранить конфиденциальность."
    },
    "soldTo": {
      "label": "Продано (необязательно)",
      "preferNot": "Предпочитаю не указывать",
      "hint": "Выберите покупателя, чтобы уведомить его и отследить завершённую сделку."
    },
    "notifyWatchers": {
      "label": "Уведомить наблюдателей",
      "hint": "Сообщите пользователям, сохранившим это объявление, что оно продано."
    }
  },
  "ja": {
    "title": "売却済みにする",
    "subtitle": "ご成約おめでとうございます！いくつかの詳細を入力して手続きを完了してください。",
    "anonymous": "匿名",
    "cancel": "キャンセル",
    "confirmBtn": "売却済みにする",
    "finalPrice": {
      "label": "最終販売価格",
      "placeholder": "最終的に合意した価格を入力",
      "hint": "他のMini愛好家が相場を把握するのに役立ちます。非公開にする場合は空欄のままにしてください。"
    },
    "soldTo": {
      "label": "売却先（任意）",
      "preferNot": "回答しない",
      "hint": "購入者を選択して通知し、成立した取引を記録します。"
    },
    "notifyWatchers": {
      "label": "ウォッチャーに通知",
      "hint": "この出品を保存したユーザーに売却済みであることを知らせます。"
    }
  },
  "zh": {
    "title": "标记为已售",
    "subtitle": "恭喜成交！填写一些详情即可完成流程。",
    "anonymous": "匿名",
    "cancel": "取消",
    "confirmBtn": "标记为已售",
    "finalPrice": {
      "label": "最终成交价",
      "placeholder": "输入最终商定价格",
      "hint": "这有助于其他Mini爱好者判断市场价值。留空可保持私密。"
    },
    "soldTo": {
      "label": "售予（可选）",
      "preferNot": "不愿透露",
      "hint": "选择买家以通知对方并记录已完成的交易。"
    },
    "notifyWatchers": {
      "label": "通知关注者",
      "hint": "让收藏了此刊登的用户知道它已售出。"
    }
  },
  "ko": {
    "title": "판매됨으로 표시",
    "subtitle": "판매를 축하합니다! 몇 가지 세부 정보를 입력하여 절차를 완료하세요.",
    "anonymous": "익명",
    "cancel": "취소",
    "confirmBtn": "판매됨으로 표시",
    "finalPrice": {
      "label": "최종 판매 가격",
      "placeholder": "최종 합의 가격 입력",
      "hint": "다른 Mini 애호가들이 시세를 파악하는 데 도움이 됩니다. 비공개로 하려면 비워 두세요."
    },
    "soldTo": {
      "label": "판매 대상 (선택 사항)",
      "preferNot": "밝히지 않음",
      "hint": "구매자를 선택하여 알리고 완료된 거래를 기록하세요."
    },
    "notifyWatchers": {
      "label": "관심 등록자에게 알림",
      "hint": "이 매물을 저장한 사용자에게 판매되었음을 알립니다."
    }
  }
}
</i18n>
