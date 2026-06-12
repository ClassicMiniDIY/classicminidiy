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
  const downloadUrl = computed(() => `/api/models/${props.modelId}/files/${props.fileId}/download`);

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

      const res = await fetch(inlineUrl.value, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) throw new Error('Sign in to preview this model in 3D.');
        if (res.status === 403) throw new Error('Purchase this model to preview it in 3D.');
        throw new Error('Could not load the 3D file.');
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
      errorMsg.value = err?.message || 'Could not load the 3D preview.';
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
      <span class="text-sm opacity-70">Loading 3D preview…</span>
    </div>

    <!-- Too large -->
    <div
      v-else-if="state === 'too-large'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <i class="fas fa-cube text-4xl opacity-40"></i>
      <p class="text-sm opacity-70">
        This file is {{ formatBytes(sizeBytes) }} — too large to preview in the browser (50 MB max).
      </p>
      <a :href="downloadUrl" class="btn btn-primary btn-sm"><i class="fas fa-download mr-1"></i> Download to view</a>
    </div>

    <!-- Unsupported -->
    <div
      v-else-if="state === 'unsupported'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <i class="fas fa-file-circle-question text-4xl opacity-40"></i>
      <p class="text-sm opacity-70">
        .{{ ext }} files can't be previewed in 3D — download to open in your slicer/CAD tool.
      </p>
      <a :href="downloadUrl" class="btn btn-primary btn-sm"><i class="fas fa-download mr-1"></i> Download</a>
    </div>

    <!-- Error -->
    <div
      v-else-if="state === 'error'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <i class="fas fa-triangle-exclamation text-3xl text-warning"></i>
      <p class="text-sm opacity-80">{{ errorMsg }}</p>
      <a :href="downloadUrl" class="btn btn-ghost btn-sm"><i class="fas fa-download mr-1"></i> Download instead</a>
    </div>

    <!-- Controls hint -->
    <div
      v-if="state === 'ready'"
      class="absolute bottom-2 left-1/2 -translate-x-1/2 badge badge-neutral badge-sm gap-1 opacity-70"
    >
      <i class="fas fa-arrows-up-down-left-right text-[0.6rem]"></i> drag to rotate · scroll to zoom
    </div>
  </div>
</template>
