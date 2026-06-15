<script setup lang="ts">
  import { HERO_TYPES } from '~~/data/models/generic';

  const { t } = useI18n();
  const { isAuthenticated } = useAuth();

  // Redirect unauthenticated visitors to login, preserving intent.
  if (!isAuthenticated.value) {
    await navigateTo(`/login?redirect=${encodeURIComponent('/models/submit-external')}`, { replace: true });
  }

  useHead(() => ({
    title: t('meta.title'),
  }));

  definePageMeta({ key: 'models-submit-external' });
</script>

<template>
  <hero
    :navigation="true"
    :title="t('hero.title')"
    :heroType="HERO_TYPES.ARCHIVE"
  />

  <div class="container mx-auto px-4 max-w-3xl pb-16">
    <breadcrumb
      class="my-6"
      :page="t('breadcrumb.page')"
      subpage="3D Models"
      subpageHref="/models"
    />

    <!-- Auth gate (SSR may not have redirected yet; belt-and-suspenders) -->
    <div v-if="!isAuthenticated" class="card bg-base-100 border border-base-300 shadow-sm my-10">
      <div class="card-body items-center text-center gap-3">
        <i class="fas fa-right-to-bracket text-4xl text-primary"></i>
        <h2 class="card-title">{{ t('auth.title') }}</h2>
        <p class="opacity-70">{{ t('auth.body') }}</p>
        <NuxtLink to="/login" class="btn btn-primary">
          <i class="fas fa-right-to-bracket mr-1"></i> {{ t('auth.btn') }}
        </NuxtLink>
      </div>
    </div>

    <template v-else>
      <!-- Intro -->
      <div class="mb-6">
        <p class="text-base opacity-80 max-w-2xl">{{ t('intro.body') }}</p>
      </div>

      <!-- Upload CTA — link to first-party upload for original designs -->
      <div class="alert alert-soft alert-info mb-6 items-start">
        <i class="fas fa-circle-info mt-0.5"></i>
        <div class="text-sm">
          {{ t('intro.ownDesignPrefix') }}
          <NuxtLink to="/models/upload" class="link link-primary font-medium">
            {{ t('intro.ownDesignLink') }}
          </NuxtLink>
          {{ t('intro.ownDesignSuffix') }}
        </div>
      </div>

      <!-- The form -->
      <ModelsExternalModelSubmitForm />
    </template>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "meta": {
      "title": "Link an external model | Classic Mini DIY"
    },
    "hero": {
      "title": "Link an External Model"
    },
    "breadcrumb": {
      "page": "Link External"
    },
    "auth": {
      "title": "Sign in to link a model",
      "body": "You need an account to submit external model links.",
      "btn": "Sign in"
    },
    "intro": {
      "body": "Found a great Classic Mini 3D model on Thingiverse, Printables, or another site? Link it here and it will appear in the library under the site's brand once approved.",
      "ownDesignPrefix": "Sharing your own original design?",
      "ownDesignLink": "Upload it instead",
      "ownDesignSuffix": "— uploading gives you more control and keeps the files hosted here."
    }
  },
  "es": {
    "meta": {
      "title": "Enlazar un modelo externo | Classic Mini DIY"
    },
    "hero": {
      "title": "Enlazar un modelo externo"
    },
    "breadcrumb": {
      "page": "Enlazar externo"
    },
    "auth": {
      "title": "Inicia sesión para enlazar un modelo",
      "body": "Necesitas una cuenta para enviar enlaces de modelos externos.",
      "btn": "Iniciar sesión"
    },
    "intro": {
      "body": "¿Encontraste un gran modelo 3D de Classic Mini en Thingiverse, Printables u otro sitio? Enlázalo aquí y aparecerá en la biblioteca con la marca del sitio una vez aprobado.",
      "ownDesignPrefix": "¿Compartes tu propio diseño original?",
      "ownDesignLink": "Súbelo en su lugar",
      "ownDesignSuffix": "— subir te da más control y mantiene los archivos alojados aquí."
    }
  },
  "fr": {
    "meta": {
      "title": "Lier un modèle externe | Classic Mini DIY"
    },
    "hero": {
      "title": "Lier un modèle externe"
    },
    "breadcrumb": {
      "page": "Lier externe"
    },
    "auth": {
      "title": "Connectez-vous pour lier un modèle",
      "body": "Vous avez besoin d'un compte pour soumettre des liens de modèles externes.",
      "btn": "Se connecter"
    },
    "intro": {
      "body": "Vous avez trouvé un super modèle 3D de Classic Mini sur Thingiverse, Printables ou un autre site ? Liez-le ici et il apparaîtra dans la bibliothèque sous la marque du site une fois approuvé.",
      "ownDesignPrefix": "Vous partagez votre propre design original ?",
      "ownDesignLink": "Téléversez-le plutôt",
      "ownDesignSuffix": "— téléverser vous donne plus de contrôle et héberge les fichiers ici."
    }
  },
  "de": {
    "meta": {
      "title": "Externes Modell verknüpfen | Classic Mini DIY"
    },
    "hero": {
      "title": "Externes Modell verknüpfen"
    },
    "breadcrumb": {
      "page": "Extern verknüpfen"
    },
    "auth": {
      "title": "Anmelden um ein Modell zu verknüpfen",
      "body": "Du benötigst ein Konto, um externe Modell-Links einzureichen.",
      "btn": "Anmelden"
    },
    "intro": {
      "body": "Ein tolles Classic Mini 3D-Modell auf Thingiverse, Printables oder einer anderen Seite gefunden? Verknüpfe es hier — nach Genehmigung erscheint es in der Bibliothek mit dem Markenzeichen der Quelle.",
      "ownDesignPrefix": "Du teilst dein eigenes Original-Design?",
      "ownDesignLink": "Lade es stattdessen hoch",
      "ownDesignSuffix": "— Hochladen gibt dir mehr Kontrolle und die Dateien werden hier gespeichert."
    }
  },
  "it": {
    "meta": {
      "title": "Collega un modello esterno | Classic Mini DIY"
    },
    "hero": {
      "title": "Collega un modello esterno"
    },
    "breadcrumb": {
      "page": "Collega esterno"
    },
    "auth": {
      "title": "Accedi per collegare un modello",
      "body": "Hai bisogno di un account per inviare link a modelli esterni.",
      "btn": "Accedi"
    },
    "intro": {
      "body": "Hai trovato un ottimo modello 3D per Classic Mini su Thingiverse, Printables o un altro sito? Collegalo qui e apparirà nella libreria con il brand del sito una volta approvato.",
      "ownDesignPrefix": "Stai condividendo il tuo design originale?",
      "ownDesignLink": "Caricalo invece",
      "ownDesignSuffix": "— caricare ti dà più controllo e mantiene i file ospitati qui."
    }
  },
  "pt": {
    "meta": {
      "title": "Vincular um modelo externo | Classic Mini DIY"
    },
    "hero": {
      "title": "Vincular um modelo externo"
    },
    "breadcrumb": {
      "page": "Vincular externo"
    },
    "auth": {
      "title": "Entre para vincular um modelo",
      "body": "Você precisa de uma conta para enviar links de modelos externos.",
      "btn": "Entrar"
    },
    "intro": {
      "body": "Encontrou um ótimo modelo 3D de Classic Mini no Thingiverse, Printables ou outro site? Vincule aqui e ele aparecerá na biblioteca com a marca do site após aprovação.",
      "ownDesignPrefix": "Está compartilhando seu próprio design original?",
      "ownDesignLink": "Faça o upload",
      "ownDesignSuffix": "— fazer upload dá mais controle e mantém os arquivos hospedados aqui."
    }
  },
  "ru": {
    "meta": {
      "title": "Добавить внешнюю модель | Classic Mini DIY"
    },
    "hero": {
      "title": "Добавить внешнюю модель"
    },
    "breadcrumb": {
      "page": "Внешняя ссылка"
    },
    "auth": {
      "title": "Войдите для добавления модели",
      "body": "Вам нужен аккаунт для отправки ссылок на внешние модели.",
      "btn": "Войти"
    },
    "intro": {
      "body": "Нашли отличную 3D-модель Classic Mini на Thingiverse, Printables или другом сайте? Добавьте ссылку здесь — после одобрения модель появится в библиотеке с логотипом источника.",
      "ownDesignPrefix": "Делитесь собственным оригинальным дизайном?",
      "ownDesignLink": "Загрузите его вместо этого",
      "ownDesignSuffix": "— загрузка даёт больше контроля и хранит файлы здесь."
    }
  },
  "ja": {
    "meta": {
      "title": "外部モデルをリンク | Classic Mini DIY"
    },
    "hero": {
      "title": "外部モデルをリンクする"
    },
    "breadcrumb": {
      "page": "外部リンク"
    },
    "auth": {
      "title": "モデルをリンクするにはサインインしてください",
      "body": "外部モデルリンクを送信するにはアカウントが必要です。",
      "btn": "サインイン"
    },
    "intro": {
      "body": "Thingiverse、Printablesなど他のサイトで素晴らしいClassic Mini 3Dモデルを見つけましたか？こちらにリンクすると、承認後にサイトのブランドとともにライブラリに表示されます。",
      "ownDesignPrefix": "自分のオリジナルデザインを共有しますか？",
      "ownDesignLink": "代わりにアップロード",
      "ownDesignSuffix": "— アップロードすることでより多くの制御ができ、ファイルはここに保存されます。"
    }
  },
  "zh": {
    "meta": {
      "title": "链接外部模型 | Classic Mini DIY"
    },
    "hero": {
      "title": "链接外部模型"
    },
    "breadcrumb": {
      "page": "链接外部"
    },
    "auth": {
      "title": "登录以链接模型",
      "body": "您需要一个账号才能提交外部模型链接。",
      "btn": "登录"
    },
    "intro": {
      "body": "在 Thingiverse、Printables 或其他网站上发现了很棒的 Classic Mini 3D 模型？在这里链接它，经过审核后将以该网站的品牌显示在库中。",
      "ownDesignPrefix": "分享自己的原创设计？",
      "ownDesignLink": "改为上传",
      "ownDesignSuffix": "— 上传让您拥有更多控制权，并将文件托管在此处。"
    }
  },
  "ko": {
    "meta": {
      "title": "외부 모델 링크 | Classic Mini DIY"
    },
    "hero": {
      "title": "외부 모델 링크하기"
    },
    "breadcrumb": {
      "page": "외부 링크"
    },
    "auth": {
      "title": "모델을 링크하려면 로그인하세요",
      "body": "외부 모델 링크를 제출하려면 계정이 필요합니다.",
      "btn": "로그인"
    },
    "intro": {
      "body": "Thingiverse, Printables 또는 다른 사이트에서 멋진 Classic Mini 3D 모델을 찾으셨나요? 여기에 링크하면 승인 후 해당 사이트의 브랜드와 함께 라이브러리에 표시됩니다.",
      "ownDesignPrefix": "자신의 오리지널 디자인을 공유하시나요?",
      "ownDesignLink": "대신 업로드하세요",
      "ownDesignSuffix": "— 업로드하면 더 많은 제어권을 갖고 파일이 여기에 보관됩니다."
    }
  }
}
</i18n>
