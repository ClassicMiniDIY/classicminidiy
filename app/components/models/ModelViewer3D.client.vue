<script setup lang="ts">
  /**
   * Client-only three.js viewer for renderable model files (keystone §5 / PR 6).
   * Loads STL / 3MF / OBJ up to 50 MB via the entitlement-gated download route
   * (`?disposition=inline` → 302 to a presigned S3 GET; S3 CORS allows the site
   * origin). three.js and its loaders are dynamic-imported on mount so the heavy
   * geometry stack is code-split out of the initial bundle and never runs on the
   * server. Everything is disposed on unmount.
   */
  import { MODEL_VIEWER_MAX_BYTES, VIEWER_EXTS, formatBytes } from '~~/data/models/model-library';

  const { t } = useI18n();

  const props = defineProps<{
    modelId: string;
    fileId: string;
    fileExt: string;
    fileName: string;
    sizeBytes: number;
  }>();

  type State = 'idle' | 'loading' | 'ready' | 'error' | 'too-large' | 'unsupported';
  const state = ref<State>('idle');
  const errorMsg = ref('');
  const container = ref<HTMLDivElement | null>(null);

  const ext = computed(() => props.fileExt.toLowerCase());
  const inlineUrl = computed(() => `/api/models/${props.modelId}/files/${props.fileId}/download?disposition=inline`);

  const supabase = useSupabase();
  const { downloadFile } = useModelCheckout();
  function triggerDownload() {
    return downloadFile(props.modelId, props.fileId);
  }

  // three.js handles kept outside reactivity to avoid proxying the WebGL graph.
  let cleanup: (() => void) | null = null;

  async function init() {
    if (!VIEWER_EXTS.has(ext.value)) {
      state.value = 'unsupported';
      return;
    }
    if (props.sizeBytes > MODEL_VIEWER_MAX_BYTES) {
      state.value = 'too-large';
      return;
    }

    state.value = 'loading';
    try {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

      // Session is in localStorage, so send the access token explicitly (a bare
      // fetch wouldn't authenticate and the route would 401).
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      const res = await fetch(inlineUrl.value, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error(t('errSignIn'));
        if (res.status === 403) throw new Error(t('errPurchase'));
        throw new Error(t('errLoad'));
      }
      const buffer = await res.arrayBuffer();

      // Parse to a three Object3D by format.
      let object: any;
      if (ext.value === 'stl') {
        const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
        const geometry = new STLLoader().parse(buffer);
        geometry.computeVertexNormals();
        object = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({ color: 0xc7ccd1, metalness: 0.1, roughness: 0.8 })
        );
      } else if (ext.value === '3mf') {
        const { ThreeMFLoader } = await import('three/examples/jsm/loaders/3MFLoader.js');
        object = new ThreeMFLoader().parse(buffer);
      } else {
        const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
        object = new OBJLoader().parse(new TextDecoder().decode(buffer));
        object.traverse((child: any) => {
          if (
            child.isMesh &&
            (!child.material || (Array.isArray(child.material) === false && !child.material.isMeshStandardMaterial))
          ) {
            child.material = new THREE.MeshStandardMaterial({ color: 0xc7ccd1, metalness: 0.1, roughness: 0.8 });
          }
        });
      }

      const el = container.value;
      if (!el) return;

      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(1, 1, 1);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.4);
      fill.position.set(-1, 0.5, -1);
      scene.add(fill);

      // Center + scale-fit the object.
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      scene.add(object);

      const camera = new THREE.PerspectiveCamera(45, el.clientWidth / Math.max(1, el.clientHeight), 0.1, maxDim * 100);
      camera.position.set(maxDim * 1.4, maxDim * 1.1, maxDim * 1.8);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      el.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.target.set(0, 0, 0);

      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        if (!el.clientWidth || !el.clientHeight) return;
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(el.clientWidth, el.clientHeight);
      };
      const ro = new ResizeObserver(onResize);
      ro.observe(el);

      cleanup = () => {
        cancelAnimationFrame(frame);
        ro.disconnect();
        controls.dispose();
        scene.traverse((child: any) => {
          if (child.geometry) child.geometry.dispose?.();
          const mat = child.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
          else mat?.dispose?.();
        });
        renderer.dispose();
        renderer.domElement.remove();
      };

      state.value = 'ready';
    } catch (err: any) {
      errorMsg.value = err?.message || t('errLoad');
      state.value = 'error';
    }
  }

  onMounted(init);
  onBeforeUnmount(() => cleanup?.());
</script>

<template>
  <div
    class="relative w-full rounded-xl overflow-hidden border border-base-300 bg-gradient-to-b from-base-200 to-base-300"
    style="aspect-ratio: 4 / 3"
  >
    <div ref="container" class="absolute inset-0" :class="{ 'opacity-0': state !== 'ready' }"></div>

    <!-- Loading -->
    <div
      v-if="state === 'loading' || state === 'idle'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3"
    >
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <span class="text-sm opacity-70">{{ t('loading') }}</span>
    </div>

    <!-- Too large -->
    <div
      v-else-if="state === 'too-large'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <i class="fas fa-cube text-4xl opacity-40"></i>
      <p class="text-sm opacity-70">
        {{ t('tooLarge', { size: formatBytes(sizeBytes) }) }}
      </p>
      <button type="button" class="btn btn-primary btn-sm" @click="triggerDownload"><i class="fas fa-download mr-1"></i> {{ t('downloadToView') }}</button>
    </div>

    <!-- Unsupported -->
    <div
      v-else-if="state === 'unsupported'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <i class="fas fa-file-circle-question text-4xl opacity-40"></i>
      <p class="text-sm opacity-70">
        {{ t('unsupported', { ext }) }}
      </p>
      <button type="button" class="btn btn-primary btn-sm" @click="triggerDownload"><i class="fas fa-download mr-1"></i> {{ t('download') }}</button>
    </div>

    <!-- Error -->
    <div
      v-else-if="state === 'error'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <i class="fas fa-triangle-exclamation text-3xl text-warning"></i>
      <p class="text-sm opacity-80">{{ errorMsg }}</p>
      <button type="button" class="btn btn-ghost btn-sm" @click="triggerDownload"><i class="fas fa-download mr-1"></i> {{ t('downloadInstead') }}</button>
    </div>

    <!-- Controls hint -->
    <div
      v-if="state === 'ready'"
      class="absolute bottom-2 left-1/2 -translate-x-1/2 badge badge-neutral badge-sm gap-1 opacity-70"
    >
      <i class="fas fa-arrows-up-down-left-right text-[0.6rem]"></i> {{ t('controlsHint') }}
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "loading": "Loading 3D preview…",
    "tooLarge": "This file is {size} — too large to preview in the browser (50 MB max).",
    "downloadToView": "Download to view",
    "unsupported": ".{ext} files can't be previewed in 3D — download to open in your slicer/CAD tool.",
    "download": "Download",
    "downloadInstead": "Download instead",
    "controlsHint": "drag to rotate · scroll to zoom",
    "errSignIn": "Sign in to preview this model in 3D.",
    "errPurchase": "Purchase this model to preview it in 3D.",
    "errLoad": "Could not load the 3D file."
  },
  "es": {
    "loading": "Cargando vista previa 3D…",
    "tooLarge": "Este archivo pesa {size} — demasiado grande para la vista previa en el navegador (máx. 50 MB).",
    "downloadToView": "Descargar para ver",
    "unsupported": "Los archivos .{ext} no se pueden previsualizar en 3D — descárgalo para abrirlo en tu slicer/CAD.",
    "download": "Descargar",
    "downloadInstead": "Descargar en su lugar",
    "controlsHint": "arrastra para rotar · desplaza para hacer zoom",
    "errSignIn": "Inicia sesión para previsualizar este modelo en 3D.",
    "errPurchase": "Adquiere este modelo para previsualizarlo en 3D.",
    "errLoad": "No se pudo cargar el archivo 3D."
  },
  "fr": {
    "loading": "Chargement de l'aperçu 3D…",
    "tooLarge": "Ce fichier fait {size} — trop volumineux pour un aperçu dans le navigateur (50 Mo max).",
    "downloadToView": "Télécharger pour voir",
    "unsupported": "Les fichiers .{ext} ne peuvent pas être prévisualisés en 3D — téléchargez-les pour les ouvrir dans votre slicer/CAO.",
    "download": "Télécharger",
    "downloadInstead": "Télécharger à la place",
    "controlsHint": "glisser pour pivoter · défiler pour zoomer",
    "errSignIn": "Connectez-vous pour prévisualiser ce modèle en 3D.",
    "errPurchase": "Achetez ce modèle pour le prévisualiser en 3D.",
    "errLoad": "Impossible de charger le fichier 3D."
  },
  "de": {
    "loading": "3D-Vorschau wird geladen…",
    "tooLarge": "Diese Datei ist {size} — zu groß für die Browser-Vorschau (max. 50 MB).",
    "downloadToView": "Herunterladen zum Anzeigen",
    "unsupported": ".{ext}-Dateien können nicht in 3D vorgeschaut werden — lade sie herunter, um sie im Slicer/CAD zu öffnen.",
    "download": "Herunterladen",
    "downloadInstead": "Stattdessen herunterladen",
    "controlsHint": "ziehen zum Drehen · scrollen zum Zoomen",
    "errSignIn": "Melde dich an, um dieses Modell in 3D vorzuschauen.",
    "errPurchase": "Kaufe dieses Modell, um es in 3D vorzuschauen.",
    "errLoad": "Die 3D-Datei konnte nicht geladen werden."
  },
  "it": {
    "loading": "Caricamento anteprima 3D…",
    "tooLarge": "Questo file è {size} — troppo grande per l'anteprima nel browser (max 50 MB).",
    "downloadToView": "Scarica per visualizzare",
    "unsupported": "I file .{ext} non possono essere visualizzati in 3D — scaricali per aprirli nel tuo slicer/CAD.",
    "download": "Scarica",
    "downloadInstead": "Scarica invece",
    "controlsHint": "trascina per ruotare · scorri per lo zoom",
    "errSignIn": "Accedi per visualizzare l'anteprima 3D di questo modello.",
    "errPurchase": "Acquista questo modello per visualizzare l'anteprima 3D.",
    "errLoad": "Impossibile caricare il file 3D."
  },
  "pt": {
    "loading": "Carregando pré-visualização 3D…",
    "tooLarge": "Este arquivo tem {size} — grande demais para pré-visualizar no navegador (máx. 50 MB).",
    "downloadToView": "Baixar para ver",
    "unsupported": "Arquivos .{ext} não podem ser pré-visualizados em 3D — baixe para abrir no seu slicer/CAD.",
    "download": "Baixar",
    "downloadInstead": "Baixar em vez disso",
    "controlsHint": "arrastar para girar · rolar para zoom",
    "errSignIn": "Faça login para pré-visualizar este modelo em 3D.",
    "errPurchase": "Compre este modelo para pré-visualizá-lo em 3D.",
    "errLoad": "Não foi possível carregar o arquivo 3D."
  },
  "ru": {
    "loading": "Загрузка 3D-превью…",
    "tooLarge": "Файл занимает {size} — слишком большой для предпросмотра в браузере (макс. 50 МБ).",
    "downloadToView": "Скачать для просмотра",
    "unsupported": "Файлы .{ext} нельзя просматривать в 3D — скачайте файл и откройте в слайсере/САПР.",
    "download": "Скачать",
    "downloadInstead": "Скачать вместо этого",
    "controlsHint": "перетащите для вращения · прокрутите для масштаба",
    "errSignIn": "Войдите в аккаунт для 3D-предпросмотра модели.",
    "errPurchase": "Приобретите модель для 3D-предпросмотра.",
    "errLoad": "Не удалось загрузить 3D-файл."
  },
  "ja": {
    "loading": "3Dプレビューを読み込み中…",
    "tooLarge": "このファイルは {size} です — ブラウザでのプレビューには大きすぎます（最大 50 MB）。",
    "downloadToView": "ダウンロードして表示",
    "unsupported": ".{ext} ファイルは3Dプレビュー非対応です — スライサー/CADで開くにはダウンロードしてください。",
    "download": "ダウンロード",
    "downloadInstead": "代わりにダウンロード",
    "controlsHint": "ドラッグで回転・スクロールでズーム",
    "errSignIn": "このモデルを3Dプレビューするにはサインインしてください。",
    "errPurchase": "このモデルを3Dプレビューするには購入してください。",
    "errLoad": "3Dファイルを読み込めませんでした。"
  },
  "zh": {
    "loading": "正在加载 3D 预览…",
    "tooLarge": "此文件大小为 {size}，超出浏览器预览限制（最大 50 MB）。",
    "downloadToView": "下载后查看",
    "unsupported": ".{ext} 文件无法在线 3D 预览，请下载后在切片软件/CAD 中打开。",
    "download": "下载",
    "downloadInstead": "改为下载",
    "controlsHint": "拖动旋转 · 滚轮缩放",
    "errSignIn": "请登录以 3D 预览此模型。",
    "errPurchase": "请购买此模型以 3D 预览。",
    "errLoad": "无法加载 3D 文件。"
  },
  "ko": {
    "loading": "3D 미리보기 로딩 중…",
    "tooLarge": "파일 크기가 {size}입니다 — 브라우저 미리보기 용량 초과(최대 50 MB).",
    "downloadToView": "다운로드하여 보기",
    "unsupported": ".{ext} 파일은 3D 미리보기를 지원하지 않습니다 — 슬라이서/CAD에서 열려면 다운로드하세요.",
    "download": "다운로드",
    "downloadInstead": "대신 다운로드",
    "controlsHint": "드래그하여 회전 · 스크롤하여 확대/축소",
    "errSignIn": "이 모델을 3D로 미리보려면 로그인하세요.",
    "errPurchase": "이 모델을 3D로 미리보려면 구매하세요.",
    "errLoad": "3D 파일을 불러올 수 없습니다."
  }
}
</i18n>
