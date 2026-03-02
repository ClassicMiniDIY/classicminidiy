<template>
  <div class="min-h-screen flex items-center justify-center bg-muted">
    <UCard class="w-full max-w-lg">
      <!-- Welcome Header -->
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fad fa-hand-wave text-3xl text-primary"></i>
        </div>
        <h1 class="text-3xl font-bold">{{ $t('title') }}</h1>
        <p class="opacity-70 mt-2">{{ $t('subtitle') }}</p>
      </div>

      <!-- One Account, Two Sites Explanation -->
      <UAlert
        color="info"
        icon="i-fa6-solid-circle-info"
        :title="$t('unified_title')"
        :description="$t('unified_description')"
        class="mb-6"
      />

      <USeparator class="my-4" />

      <!-- Optional Profile Setup Form -->
      <div class="space-y-4 mb-6">
        <h2 class="text-lg font-semibold">{{ $t('profile_heading') }}</h2>
        <p class="text-sm opacity-70">{{ $t('profile_subheading') }}</p>

        <UFormField :label="$t('display_name_label')">
          <UInput
            v-model="displayName"
            :placeholder="$t('display_name_placeholder')"
            class="w-full"
            :disabled="isSaving"
          />
        </UFormField>

        <UFormField :label="$t('bio_label')">
          <UTextarea
            v-model="bio"
            :placeholder="$t('bio_placeholder')"
            class="w-full"
            :rows="3"
            :disabled="isSaving"
          />
        </UFormField>

        <UAlert v-if="saveError" color="error" icon="i-fa6-solid-triangle-exclamation" :title="saveError" />
        <UAlert v-if="saveSuccess" color="success" icon="i-fa6-solid-circle-check" :title="$t('save_success')" />
      </div>

      <USeparator class="my-4" />

      <!-- What You Can Do Section -->
      <div class="mb-6">
        <h2 class="text-lg font-semibold mb-3">{{ $t('what_you_can_do') }}</h2>
        <ul class="space-y-3">
          <li class="flex items-start gap-3">
            <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <i class="fad fa-books text-primary text-sm"></i>
            </div>
            <div>
              <p class="font-medium">{{ $t('feature_archive_title') }}</p>
              <p class="text-sm opacity-70">{{ $t('feature_archive_desc') }}</p>
            </div>
          </li>
          <li class="flex items-start gap-3">
            <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <i class="fad fa-wrench text-primary text-sm"></i>
            </div>
            <div>
              <p class="font-medium">{{ $t('feature_tools_title') }}</p>
              <p class="text-sm opacity-70">{{ $t('feature_tools_desc') }}</p>
            </div>
          </li>
          <li class="flex items-start gap-3">
            <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <i class="fad fa-users text-primary text-sm"></i>
            </div>
            <div>
              <p class="font-medium">{{ $t('feature_contribute_title') }}</p>
              <p class="text-sm opacity-70">{{ $t('feature_contribute_desc') }}</p>
            </div>
          </li>
        </ul>
      </div>

      <USeparator class="my-4" />

      <!-- Action Buttons -->
      <div class="flex flex-col gap-3">
        <UButton
          color="primary"
          class="w-full"
          :disabled="isSaving"
          :loading="isSaving"
          @click="handleGetStarted"
        >
          <template #leading>
            <i v-if="!isSaving" class="fad fa-rocket"></i>
          </template>
          {{ $t('get_started') }}
        </UButton>

        <UButton
          variant="ghost"
          class="w-full"
          :disabled="isSaving"
          @click="handleSkip"
        >
          {{ $t('skip_for_now') }}
        </UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  // SEO and meta
  useHead({
    title: t('page_title'),
    meta: [
      {
        name: 'description',
        content: t('page_description'),
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  const { isAuthenticated, userProfile, initAuth, fetchUserProfile, user } = useAuth();
  const supabase = useSupabase();
  const route = useRoute();

  // Reactive state
  const displayName = ref('');
  const bio = ref('');
  const isSaving = ref(false);
  const saveError = ref('');
  const saveSuccess = ref(false);

  // Redirect target from query param or default to home
  const redirectTo = computed(() => {
    const redirect = route.query.redirect;
    if (typeof redirect === 'string' && redirect.startsWith('/')) {
      return redirect;
    }
    return '/';
  });

  // Auth check on mount
  onMounted(async () => {
    await initAuth();
    if (!isAuthenticated.value) {
      navigateTo('/login', { replace: true });
      return;
    }

    // Pre-fill form with existing profile data
    if (userProfile.value) {
      displayName.value = userProfile.value.display_name || '';
    }
  });

  // Save profile and navigate
  const handleGetStarted = async () => {
    isSaving.value = true;
    saveError.value = '';
    saveSuccess.value = false;

    try {
      // Only update if user filled in at least one field
      if (displayName.value.trim() || bio.value.trim()) {
        const updates: Record<string, string> = {};
        if (displayName.value.trim()) {
          updates.display_name = displayName.value.trim();
        }
        if (bio.value.trim()) {
          updates.bio = bio.value.trim();
        }

        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.value!.id);

        if (error) {
          saveError.value = t('save_error');
          isSaving.value = false;
          return;
        }

        // Refresh the profile data in auth state
        await fetchUserProfile(user.value!.id);
      }

      navigateTo(redirectTo.value, { replace: true });
    } catch (error) {
      console.error('Error saving profile:', error);
      saveError.value = t('save_error');
    } finally {
      isSaving.value = false;
    }
  };

  // Skip profile setup and navigate
  const handleSkip = () => {
    navigateTo(redirectTo.value, { replace: true });
  };
</script>

<i18n lang="json">
{
  "en": {
    "page_title": "Welcome - Classic Mini DIY",
    "page_description": "Welcome to Classic Mini DIY. Set up your profile and get started.",
    "title": "Welcome!",
    "subtitle": "We're glad you're here. Let's get you set up.",
    "unified_title": "One Account, Two Sites",
    "unified_description": "Your account works across both classicminidiy.com and theminiexchange.com. Sign in once and you're good to go on both platforms.",
    "profile_heading": "Set Up Your Profile",
    "profile_subheading": "This is optional. You can always update your profile later.",
    "display_name_label": "Display Name",
    "display_name_placeholder": "How should we call you?",
    "bio_label": "Bio",
    "bio_placeholder": "Tell the community a bit about yourself and your Mini...",
    "save_success": "Profile saved successfully!",
    "save_error": "Failed to save profile. Please try again.",
    "what_you_can_do": "What You Can Do",
    "feature_archive_title": "Browse the Archive",
    "feature_archive_desc": "Explore technical documents, wiring diagrams, and manuals for Classic Minis.",
    "feature_tools_title": "Use the Tools",
    "feature_tools_desc": "Access calculators, torque specs, colour references, and more.",
    "feature_contribute_title": "Contribute",
    "feature_contribute_desc": "Share your knowledge by submitting documents and helping fellow enthusiasts.",
    "get_started": "Get Started",
    "skip_for_now": "Skip for Now"
  },
  "es": {
    "page_title": "Bienvenido - Classic Mini DIY",
    "page_description": "Bienvenido a Classic Mini DIY. Configura tu perfil y comienza.",
    "title": "Bienvenido!",
    "subtitle": "Nos alegra que estes aqui. Vamos a configurarte.",
    "unified_title": "Una Cuenta, Dos Sitios",
    "unified_description": "Tu cuenta funciona tanto en classicminidiy.com como en theminiexchange.com. Inicia sesion una vez y listo para ambas plataformas.",
    "profile_heading": "Configura Tu Perfil",
    "profile_subheading": "Esto es opcional. Siempre puedes actualizar tu perfil mas tarde.",
    "display_name_label": "Nombre para Mostrar",
    "display_name_placeholder": "Como debemos llamarte?",
    "bio_label": "Biografia",
    "bio_placeholder": "Cuentale a la comunidad un poco sobre ti y tu Mini...",
    "save_success": "Perfil guardado exitosamente!",
    "save_error": "Error al guardar el perfil. Intentalo de nuevo.",
    "what_you_can_do": "Que Puedes Hacer",
    "feature_archive_title": "Explorar el Archivo",
    "feature_archive_desc": "Explora documentos tecnicos, diagramas de cableado y manuales para Classic Minis.",
    "feature_tools_title": "Usar las Herramientas",
    "feature_tools_desc": "Accede a calculadoras, especificaciones de torque, referencias de colores y mas.",
    "feature_contribute_title": "Contribuir",
    "feature_contribute_desc": "Comparte tu conocimiento enviando documentos y ayudando a otros entusiastas.",
    "get_started": "Comenzar",
    "skip_for_now": "Omitir por Ahora"
  },
  "fr": {
    "page_title": "Bienvenue - Classic Mini DIY",
    "page_description": "Bienvenue sur Classic Mini DIY. Configurez votre profil et commencez.",
    "title": "Bienvenue !",
    "subtitle": "Nous sommes ravis de vous voir. Configurons votre compte.",
    "unified_title": "Un Compte, Deux Sites",
    "unified_description": "Votre compte fonctionne sur classicminidiy.com et theminiexchange.com. Connectez-vous une fois et vous etes pret pour les deux plateformes.",
    "profile_heading": "Configurez Votre Profil",
    "profile_subheading": "C'est facultatif. Vous pourrez toujours mettre a jour votre profil plus tard.",
    "display_name_label": "Nom d'affichage",
    "display_name_placeholder": "Comment devons-nous vous appeler ?",
    "bio_label": "Biographie",
    "bio_placeholder": "Parlez a la communaute de vous et de votre Mini...",
    "save_success": "Profil sauvegarde avec succes !",
    "save_error": "Echec de la sauvegarde du profil. Veuillez reessayer.",
    "what_you_can_do": "Ce Que Vous Pouvez Faire",
    "feature_archive_title": "Parcourir les Archives",
    "feature_archive_desc": "Explorez les documents techniques, schemas de cablage et manuels pour les Classic Minis.",
    "feature_tools_title": "Utiliser les Outils",
    "feature_tools_desc": "Accedez aux calculateurs, specifications de couple, references de couleurs et plus.",
    "feature_contribute_title": "Contribuer",
    "feature_contribute_desc": "Partagez vos connaissances en soumettant des documents et en aidant les passionnes.",
    "get_started": "Commencer",
    "skip_for_now": "Passer pour le Moment"
  },
  "it": {
    "page_title": "Benvenuto - Classic Mini DIY",
    "page_description": "Benvenuto su Classic Mini DIY. Configura il tuo profilo e inizia.",
    "title": "Benvenuto!",
    "subtitle": "Siamo felici che tu sia qui. Configuriamo il tuo account.",
    "unified_title": "Un Account, Due Siti",
    "unified_description": "Il tuo account funziona sia su classicminidiy.com che su theminiexchange.com. Accedi una volta e sei pronto per entrambe le piattaforme.",
    "profile_heading": "Configura il Tuo Profilo",
    "profile_subheading": "Questo e facoltativo. Puoi sempre aggiornare il tuo profilo in seguito.",
    "display_name_label": "Nome Visualizzato",
    "display_name_placeholder": "Come dovremmo chiamarti?",
    "bio_label": "Biografia",
    "bio_placeholder": "Racconta alla comunita qualcosa su di te e la tua Mini...",
    "save_success": "Profilo salvato con successo!",
    "save_error": "Impossibile salvare il profilo. Riprova.",
    "what_you_can_do": "Cosa Puoi Fare",
    "feature_archive_title": "Sfoglia l'Archivio",
    "feature_archive_desc": "Esplora documenti tecnici, schemi di cablaggio e manuali per le Classic Mini.",
    "feature_tools_title": "Usa gli Strumenti",
    "feature_tools_desc": "Accedi a calcolatrici, specifiche di coppia, riferimenti colore e altro.",
    "feature_contribute_title": "Contribuisci",
    "feature_contribute_desc": "Condividi le tue conoscenze inviando documenti e aiutando gli appassionati.",
    "get_started": "Inizia",
    "skip_for_now": "Salta per Ora"
  },
  "de": {
    "page_title": "Willkommen - Classic Mini DIY",
    "page_description": "Willkommen bei Classic Mini DIY. Richten Sie Ihr Profil ein und legen Sie los.",
    "title": "Willkommen!",
    "subtitle": "Wir freuen uns, dass Sie hier sind. Lassen Sie uns Ihr Konto einrichten.",
    "unified_title": "Ein Konto, Zwei Seiten",
    "unified_description": "Ihr Konto funktioniert sowohl auf classicminidiy.com als auch auf theminiexchange.com. Melden Sie sich einmal an und Sie sind auf beiden Plattformen startklar.",
    "profile_heading": "Profil Einrichten",
    "profile_subheading": "Dies ist optional. Sie koennen Ihr Profil jederzeit spaeter aktualisieren.",
    "display_name_label": "Anzeigename",
    "display_name_placeholder": "Wie sollen wir Sie nennen?",
    "bio_label": "Biografie",
    "bio_placeholder": "Erzaehlen Sie der Community etwas ueber sich und Ihren Mini...",
    "save_success": "Profil erfolgreich gespeichert!",
    "save_error": "Profil konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    "what_you_can_do": "Was Sie Tun Koennen",
    "feature_archive_title": "Archiv Durchsuchen",
    "feature_archive_desc": "Erkunden Sie technische Dokumente, Schaltplaene und Handbuecher fuer Classic Minis.",
    "feature_tools_title": "Werkzeuge Nutzen",
    "feature_tools_desc": "Zugriff auf Rechner, Drehmomentspezifikationen, Farbreferenzen und mehr.",
    "feature_contribute_title": "Beitragen",
    "feature_contribute_desc": "Teilen Sie Ihr Wissen, indem Sie Dokumente einreichen und anderen Enthusiasten helfen.",
    "get_started": "Loslegen",
    "skip_for_now": "Vorerst Ueberspringen"
  },
  "pt": {
    "page_title": "Bem-vindo - Classic Mini DIY",
    "page_description": "Bem-vindo ao Classic Mini DIY. Configure seu perfil e comece.",
    "title": "Bem-vindo!",
    "subtitle": "Estamos felizes que voce esta aqui. Vamos configurar sua conta.",
    "unified_title": "Uma Conta, Dois Sites",
    "unified_description": "Sua conta funciona tanto no classicminidiy.com quanto no theminiexchange.com. Faca login uma vez e estara pronto para ambas as plataformas.",
    "profile_heading": "Configure Seu Perfil",
    "profile_subheading": "Isso e opcional. Voce sempre pode atualizar seu perfil depois.",
    "display_name_label": "Nome de Exibicao",
    "display_name_placeholder": "Como devemos te chamar?",
    "bio_label": "Biografia",
    "bio_placeholder": "Conte a comunidade um pouco sobre voce e seu Mini...",
    "save_success": "Perfil salvo com sucesso!",
    "save_error": "Falha ao salvar o perfil. Tente novamente.",
    "what_you_can_do": "O Que Voce Pode Fazer",
    "feature_archive_title": "Explorar o Arquivo",
    "feature_archive_desc": "Explore documentos tecnicos, diagramas de fiacao e manuais para Classic Minis.",
    "feature_tools_title": "Usar as Ferramentas",
    "feature_tools_desc": "Acesse calculadoras, especificacoes de torque, referencias de cores e mais.",
    "feature_contribute_title": "Contribuir",
    "feature_contribute_desc": "Compartilhe seu conhecimento enviando documentos e ajudando outros entusiastas.",
    "get_started": "Comecar",
    "skip_for_now": "Pular por Enquanto"
  },
  "ru": {
    "page_title": "Dobro pozhalovat - Classic Mini DIY",
    "page_description": "Dobro pozhalovat v Classic Mini DIY. Nastroyte svoy profil i nachnite.",
    "title": "Dobro pozhalovat!",
    "subtitle": "My rady, chto vy zdes. Davayte nastroim vash akkaunt.",
    "unified_title": "Odin Akkaunt, Dva Sayta",
    "unified_description": "Vash akkaunt rabotayet kak na classicminidiy.com, tak i na theminiexchange.com. Voydite odin raz i vy gotovy k rabote na obeikh platformakh.",
    "profile_heading": "Nastroyte Svoy Profil",
    "profile_subheading": "Eto neobyazatelno. Vy vsegda mozhete obnovit svoy profil pozzhe.",
    "display_name_label": "Imya dlya otobrazheniya",
    "display_name_placeholder": "Kak nam vas nazyvat?",
    "bio_label": "Biografiya",
    "bio_placeholder": "Rasskazhite soobshchestvu nemnogo o sebe i vashem Mini...",
    "save_success": "Profil uspeshno sokhranyon!",
    "save_error": "Ne udalos sokhranit profil. Poprobuite snova.",
    "what_you_can_do": "Chto Vy Mozhete Delat",
    "feature_archive_title": "Prosmotr Arkhiva",
    "feature_archive_desc": "Izuchayte tekhnicheskie dokumenty, skhemy provodki i rukovodstva dlya Classic Mini.",
    "feature_tools_title": "Ispolzovat Instrumenty",
    "feature_tools_desc": "Dostup k kalkulyatoram, spetsifikatsiyam momenta, tsvetovym referencam i mnogomu drugomu.",
    "feature_contribute_title": "Vnosit Vklad",
    "feature_contribute_desc": "Delites svoimi znaniyami, otpravlyaya dokumenty i pomogaya drugim entuziastam.",
    "get_started": "Nachat",
    "skip_for_now": "Propustit"
  },
  "ja": {
    "page_title": "ようこそ - Classic Mini DIY",
    "page_description": "Classic Mini DIYへようこそ。プロフィールを設定して始めましょう。",
    "title": "ようこそ!",
    "subtitle": "ご参加いただきありがとうございます。アカウントを設定しましょう。",
    "unified_title": "1つのアカウント、2つのサイト",
    "unified_description": "あなたのアカウントはclassicminidiy.comとtheminiexchange.comの両方で使用できます。一度ログインすれば、両方のプラットフォームですぐに利用できます。",
    "profile_heading": "プロフィールを設定",
    "profile_subheading": "これは任意です。後からいつでもプロフィールを更新できます。",
    "display_name_label": "表示名",
    "display_name_placeholder": "何とお呼びしましょうか？",
    "bio_label": "自己紹介",
    "bio_placeholder": "あなた自身とあなたのミニについてコミュニティに教えてください...",
    "save_success": "プロフィールが正常に保存されました!",
    "save_error": "プロフィールの保存に失敗しました。もう一度お試しください。",
    "what_you_can_do": "できること",
    "feature_archive_title": "アーカイブを閲覧",
    "feature_archive_desc": "Classic Miniの技術文書、配線図、マニュアルを探索できます。",
    "feature_tools_title": "ツールを使用",
    "feature_tools_desc": "計算機、トルク仕様、カラーリファレンスなどにアクセスできます。",
    "feature_contribute_title": "貢献する",
    "feature_contribute_desc": "ドキュメントを提出し、仲間の愛好家を助けることで知識を共有できます。",
    "get_started": "始める",
    "skip_for_now": "後で設定する"
  },
  "zh": {
    "page_title": "欢迎 - Classic Mini DIY",
    "page_description": "欢迎来到Classic Mini DIY。设置您的个人资料并开始使用。",
    "title": "欢迎!",
    "subtitle": "很高兴您的加入。让我们为您设置账户。",
    "unified_title": "一个账户，两个网站",
    "unified_description": "您的账户可以在classicminidiy.com和theminiexchange.com上通用。登录一次即可在两个平台上使用。",
    "profile_heading": "设置您的个人资料",
    "profile_subheading": "这是可选的。您随时可以稍后更新个人资料。",
    "display_name_label": "显示名称",
    "display_name_placeholder": "我们应该怎么称呼您？",
    "bio_label": "个人简介",
    "bio_placeholder": "向社区介绍一下您自己和您的Mini...",
    "save_success": "个人资料保存成功!",
    "save_error": "保存个人资料失败。请重试。",
    "what_you_can_do": "您可以做什么",
    "feature_archive_title": "浏览档案",
    "feature_archive_desc": "探索Classic Mini的技术文档、接线图和手册。",
    "feature_tools_title": "使用工具",
    "feature_tools_desc": "访问计算器、扭矩规格、颜色参考等。",
    "feature_contribute_title": "贡献内容",
    "feature_contribute_desc": "通过提交文档和帮助其他爱好者来分享您的知识。",
    "get_started": "开始使用",
    "skip_for_now": "暂时跳过"
  },
  "ko": {
    "page_title": "환영합니다 - Classic Mini DIY",
    "page_description": "Classic Mini DIY에 오신 것을 환영합니다. 프로필을 설정하고 시작하세요.",
    "title": "환영합니다!",
    "subtitle": "함께해 주셔서 기쁩니다. 계정을 설정해 봅시다.",
    "unified_title": "하나의 계정, 두 개의 사이트",
    "unified_description": "계정은 classicminidiy.com과 theminiexchange.com 모두에서 사용할 수 있습니다. 한 번 로그인하면 두 플랫폼 모두에서 바로 사용할 수 있습니다.",
    "profile_heading": "프로필 설정",
    "profile_subheading": "선택 사항입니다. 나중에 언제든지 프로필을 업데이트할 수 있습니다.",
    "display_name_label": "표시 이름",
    "display_name_placeholder": "어떻게 불러드릴까요?",
    "bio_label": "소개",
    "bio_placeholder": "커뮤니티에 자신과 미니에 대해 소개해 주세요...",
    "save_success": "프로필이 성공적으로 저장되었습니다!",
    "save_error": "프로필 저장에 실패했습니다. 다시 시도해 주세요.",
    "what_you_can_do": "할 수 있는 것들",
    "feature_archive_title": "아카이브 둘러보기",
    "feature_archive_desc": "Classic Mini의 기술 문서, 배선도, 매뉴얼을 탐색하세요.",
    "feature_tools_title": "도구 사용",
    "feature_tools_desc": "계산기, 토크 사양, 색상 참조 등에 접근하세요.",
    "feature_contribute_title": "기여하기",
    "feature_contribute_desc": "문서를 제출하고 동료 애호가들을 도와 지식을 공유하세요.",
    "get_started": "시작하기",
    "skip_for_now": "나중에 하기"
  }
}
</i18n>
