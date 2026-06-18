<template>
  <div class="relative w-full h-full min-h-[400px] bg-base-200 rounded-lg overflow-hidden">
    <!-- Map Container -->
    <div ref="mapContainer" class="w-full h-full"></div>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="absolute inset-0 bg-base-100/80 flex items-center justify-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="absolute inset-0 bg-base-100 flex items-center justify-center p-6">
      <div class="alert alert-error">
        <i class="fas fa-triangle-exclamation"></i>
        <div>
          <div class="font-semibold">{{ t('mapError') }}</div>
          <div class="text-sm">{{ error }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import mapboxgl from 'mapbox-gl';
  import 'mapbox-gl/dist/mapbox-gl.css';

  const { t } = useI18n();

  interface Listing {
    id: string;
    title: string;
    slug: string;
    price: number;
    currency?: string;
    location: string;
    latitude: number;
    longitude: number;
    photos?: Array<{ storage_path: string }>;
  }

  interface Props {
    listings: Listing[];
    center?: [number, number]; // [longitude, latitude]
    zoom?: number;
  }

  const props = withDefaults(defineProps<Props>(), {
    center: () => [-98.5795, 39.8283], // Geographic center of USA
    zoom: 4,
  });

  const emit = defineEmits<{
    markerClick: [listing: Listing];
  }>();

  const config = useRuntimeConfig();
  const mapContainer = ref<HTMLElement | null>(null);
  const map = ref<mapboxgl.Map | null>(null);
  const popup = ref<mapboxgl.Popup | null>(null);
  const isLoading = ref(true);
  const error = ref('');

  // Store listings data for lookup when clicking markers
  const listingsMap = ref<Map<string, Listing>>(new Map());

  onMounted(() => {
    initMap();
  });

  onBeforeUnmount(() => {
    // Clean up popup
    if (popup.value) {
      popup.value.remove();
      popup.value = null;
    }

    // Clean up map
    if (map.value) {
      map.value.remove();
      map.value = null;
    }
  });

  const initMap = () => {
    if (!mapContainer.value) {
      error.value = t('errorContainerNotFound');
      isLoading.value = false;
      return;
    }

    const accessToken = config.public.mapboxAccessToken;

    if (!accessToken) {
      error.value = t('errorNoToken');
      isLoading.value = false;
      return;
    }

    try {
      mapboxgl.accessToken = accessToken;

      map.value = new mapboxgl.Map({
        container: mapContainer.value,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: props.center,
        zoom: props.zoom,
      });

      // Add navigation controls
      map.value.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add fullscreen control
      map.value.addControl(new mapboxgl.FullscreenControl(), 'top-right');

      map.value.on('load', () => {
        isLoading.value = false;
        setupClusterSource();
        setupClusterLayers();
        setupEventHandlers();
        updateListings();
      });

      map.value.on('error', (e) => {
        console.error('Mapbox error:', e);
        error.value = t('errorLoadFailed');
        isLoading.value = false;
      });
    } catch (err) {
      console.error('Error initializing map:', err);
      error.value = t('errorInitFailed');
      isLoading.value = false;
    }
  };

  const setupClusterSource = () => {
    if (!map.value) return;

    // Add a GeoJSON source with clustering enabled
    map.value.addSource('listings', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
      cluster: true,
      clusterMaxZoom: 14, // Max zoom to cluster points
      clusterRadius: 50, // Radius of each cluster when clustering points (in pixels)
    });
  };

  const setupClusterLayers = () => {
    if (!map.value) return;

    // Cluster circles layer - sized by point count
    map.value.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'listings',
      filter: ['has', 'point_count'],
      paint: {
        // Size circles by cluster count
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 25, 50, 30, 100, 35],
        // Color clusters by count
        'circle-color': ['step', ['get', 'point_count'], '#ef4444', 10, '#dc2626', 50, '#b91c1c', 100, '#991b1b'],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    });

    // Cluster count labels
    map.value.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'listings',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 14,
      },
      paint: {
        'text-color': '#ffffff',
      },
    });

    // Individual point circles
    map.value.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'listings',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 12,
        'circle-color': '#ef4444',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    });

    // Inner dot for individual points
    map.value.addLayer({
      id: 'unclustered-point-inner',
      type: 'circle',
      source: 'listings',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 4,
        'circle-color': '#ffffff',
      },
    });
  };

  const setupEventHandlers = () => {
    if (!map.value) return;

    // Click on cluster to zoom in
    map.value.on('click', 'clusters', (e) => {
      const features = map.value!.queryRenderedFeatures(e.point, {
        layers: ['clusters'],
      });

      const feature = features[0];
      if (!feature) return;

      const clusterId = feature.properties?.cluster_id;
      const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      const source = map.value!.getSource('listings') as mapboxgl.GeoJSONSource;

      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return;

        map.value!.easeTo({
          center: coordinates,
          zoom: zoom,
        });
      });
    });

    // Click on individual point to show popup and navigate
    map.value.on('click', 'unclustered-point', (e) => {
      const feature = e.features?.[0];
      if (!feature) return;

      const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      const listingId = feature.properties?.id;
      const listing = listingsMap.value.get(listingId);

      if (!listing) return;

      // Ensure popup appears over the marker when near map edges
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      // Remove existing popup
      if (popup.value) {
        popup.value.remove();
      }

      // Create popup content
      // Format price with currency symbol
      const currencySymbols: Record<string, string> = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        JPY: '¥',
        AUD: 'A$',
        CAD: 'C$',
        CHF: 'CHF ',
        CNY: '¥',
        HKD: 'HK$',
        NZD: 'NZ$',
        SEK: 'kr ',
        KRW: '₩',
        SGD: 'S$',
        NOK: 'kr ',
        MXN: 'MX$',
      };
      const currency = listing.currency || 'USD';
      const symbol = currencySymbols[currency] || '$';
      const formattedPrice = `${symbol}${listing.price.toLocaleString()}`;

      const popupContent = `
        <div style="padding: 8px; min-width: 180px;">
          <h3 style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #1f2937;">${escapeHtml(listing.title)}</h3>
          <p style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${escapeHtml(listing.location)}</p>
          <p style="font-size: 14px; font-weight: 700; color: #ef4444; margin-bottom: 8px;">${escapeHtml(formattedPrice)}</p>
          <a href="/exchange/listings/${escapeHtml(listing.slug)}" style="display: inline-block; padding: 6px 12px; background: #ef4444; color: white; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500;">${escapeHtml(t('viewListing'))}</a>
        </div>
      `;

      popup.value = new mapboxgl.Popup({ closeButton: true, closeOnClick: true })
        .setLngLat(coordinates)
        .setHTML(popupContent)
        .addTo(map.value! as unknown as mapboxgl.Map);
    });

    // Change cursor on hover
    map.value.on('mouseenter', 'clusters', () => {
      map.value!.getCanvas().style.cursor = 'pointer';
    });

    map.value.on('mouseleave', 'clusters', () => {
      map.value!.getCanvas().style.cursor = '';
    });

    map.value.on('mouseenter', 'unclustered-point', () => {
      map.value!.getCanvas().style.cursor = 'pointer';
    });

    map.value.on('mouseleave', 'unclustered-point', () => {
      map.value!.getCanvas().style.cursor = '';
    });
  };

  const updateListings = () => {
    if (!map.value) return;

    // Filter listings with valid coordinates
    const validListings = props.listings.filter(
      (listing) =>
        listing.latitude &&
        listing.longitude &&
        !isNaN(listing.latitude) &&
        !isNaN(listing.longitude) &&
        listing.latitude >= -90 &&
        listing.latitude <= 90 &&
        listing.longitude >= -180 &&
        listing.longitude <= 180
    );

    // Build listings lookup map
    listingsMap.value.clear();
    validListings.forEach((listing) => {
      listingsMap.value.set(listing.id, listing);
    });

    // Convert listings to GeoJSON features
    const features: GeoJSON.Feature[] = validListings.map((listing) => ({
      type: 'Feature',
      properties: {
        id: listing.id,
        title: listing.title,
        slug: listing.slug,
        price: listing.price,
        location: listing.location,
        currency: listing.currency || 'USD',
      },
      geometry: {
        type: 'Point',
        coordinates: [listing.longitude, listing.latitude],
      },
    }));

    // Update the source data
    const source = map.value.getSource('listings') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features,
      });
    }

    // Fit map to bounds if we have listings
    if (validListings.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      validListings.forEach((listing) => {
        bounds.extend([listing.longitude, listing.latitude]);
      });
      map.value.fitBounds(bounds, {
        padding: 50,
        maxZoom: 12,
      });
    } else if (validListings.length === 1 && validListings[0]) {
      map.value.setCenter([validListings[0].longitude, validListings[0].latitude]);
      map.value.setZoom(10);
    }
  };

  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Watch for changes to listings and update the source
  watch(
    () => props.listings,
    () => {
      if (map.value && map.value.loaded()) {
        updateListings();
      }
    },
    { deep: true }
  );
</script>

<style scoped>
  @reference "~/assets/css/main.css";

  /* Mapbox requires fixed positioning context */
  :deep(.mapboxgl-map) {
    font-family: inherit;
  }

  :deep(.mapboxgl-popup-content) {
    @apply bg-base-100 rounded-lg shadow-lg;
    padding: 0;
  }

  :deep(.mapboxgl-popup-tip) {
    @apply border-base-100;
  }
</style>

<i18n lang="json">
{
  "en": { "mapError": "Map Error", "viewListing": "View Listing", "errorContainerNotFound": "Map container not found", "errorNoToken": "Mapbox access token not configured. Please set NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN in .env", "errorLoadFailed": "Failed to load map", "errorInitFailed": "Failed to initialize map" },
  "es": { "mapError": "Error del mapa", "viewListing": "Ver anuncio", "errorContainerNotFound": "No se encontró el contenedor del mapa", "errorNoToken": "El token de acceso de Mapbox no está configurado. Configura NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN en .env", "errorLoadFailed": "No se pudo cargar el mapa", "errorInitFailed": "No se pudo inicializar el mapa" },
  "fr": { "mapError": "Erreur de carte", "viewListing": "Voir l'annonce", "errorContainerNotFound": "Conteneur de carte introuvable", "errorNoToken": "Le jeton d'accès Mapbox n'est pas configuré. Veuillez définir NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN dans .env", "errorLoadFailed": "Échec du chargement de la carte", "errorInitFailed": "Échec de l'initialisation de la carte" },
  "de": { "mapError": "Kartenfehler", "viewListing": "Anzeige ansehen", "errorContainerNotFound": "Kartencontainer nicht gefunden", "errorNoToken": "Mapbox-Zugriffstoken nicht konfiguriert. Bitte setze NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN in .env", "errorLoadFailed": "Karte konnte nicht geladen werden", "errorInitFailed": "Karte konnte nicht initialisiert werden" },
  "it": { "mapError": "Errore della mappa", "viewListing": "Vedi annuncio", "errorContainerNotFound": "Contenitore della mappa non trovato", "errorNoToken": "Token di accesso Mapbox non configurato. Imposta NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN in .env", "errorLoadFailed": "Impossibile caricare la mappa", "errorInitFailed": "Impossibile inizializzare la mappa" },
  "pt": { "mapError": "Erro do mapa", "viewListing": "Ver anúncio", "errorContainerNotFound": "Contêiner do mapa não encontrado", "errorNoToken": "Token de acesso do Mapbox não configurado. Defina NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN no .env", "errorLoadFailed": "Falha ao carregar o mapa", "errorInitFailed": "Falha ao inicializar o mapa" },
  "ru": { "mapError": "Ошибка карты", "viewListing": "Посмотреть объявление", "errorContainerNotFound": "Контейнер карты не найден", "errorNoToken": "Токен доступа Mapbox не настроен. Укажите NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN в .env", "errorLoadFailed": "Не удалось загрузить карту", "errorInitFailed": "Не удалось инициализировать карту" },
  "ja": { "mapError": "地図エラー", "viewListing": "出品を見る", "errorContainerNotFound": "地図コンテナが見つかりません", "errorNoToken": "Mapbox アクセストークンが設定されていません。.env に NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN を設定してください", "errorLoadFailed": "地図の読み込みに失敗しました", "errorInitFailed": "地図の初期化に失敗しました" },
  "zh": { "mapError": "地图错误", "viewListing": "查看刊登", "errorContainerNotFound": "未找到地图容器", "errorNoToken": "未配置 Mapbox 访问令牌。请在 .env 中设置 NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "errorLoadFailed": "地图加载失败", "errorInitFailed": "地图初始化失败" },
  "ko": { "mapError": "지도 오류", "viewListing": "매물 보기", "errorContainerNotFound": "지도 컨테이너를 찾을 수 없습니다", "errorNoToken": "Mapbox 액세스 토큰이 구성되지 않았습니다. .env에 NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN을 설정하세요", "errorLoadFailed": "지도를 불러오지 못했습니다", "errorInitFailed": "지도를 초기화하지 못했습니다" }
}
</i18n>
