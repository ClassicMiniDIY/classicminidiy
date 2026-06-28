<template>
  <div v-if="hasHeritageInfo" class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <h2 class="card-title flex items-center gap-2">
        <i class="fas fa-file-lines text-2xl"></i>
        {{ t('title') }}
      </h2>

      <div class="grid md:grid-cols-2 gap-4 mt-4">
        <!-- VIN Number -->
        <div v-if="listing.vin_number" class="space-y-1">
          <div class="text-sm text-base-content/70">{{ t('vinNumber') }}</div>
          <div class="font-medium font-mono">{{ listing.vin_number }}</div>
        </div>

        <!-- Chassis Number -->
        <div v-if="listing.chassis_number" class="space-y-1">
          <div class="text-sm text-base-content/70">{{ t('chassisNumber') }}</div>
          <div class="font-medium font-mono">{{ listing.chassis_number }}</div>
        </div>

        <!-- Build Date -->
        <div v-if="listing.build_date" class="space-y-1">
          <div class="text-sm text-base-content/70">{{ t('buildDate') }}</div>
          <div class="font-medium">{{ formatDate(listing.build_date) }}</div>
        </div>

        <!-- Original Color -->
        <div v-if="listing.original_color" class="space-y-1">
          <div class="text-sm text-base-content/70">{{ t('originalFactoryColor') }}</div>
          <div class="font-medium">{{ listing.original_color }}</div>
        </div>

        <!-- Previous Owners -->
        <div
          v-if="listing.previous_owners_count !== null && listing.previous_owners_count !== undefined"
          class="space-y-1"
        >
          <div class="text-sm text-base-content/70">{{ t('previousOwners') }}</div>
          <div class="font-medium">{{ listing.previous_owners_count }}</div>
        </div>

        <!-- Restoration Status -->
        <div v-if="listing.restoration_status" class="space-y-1">
          <div class="text-sm text-base-content/70">{{ t('restorationStatus') }}</div>
          <div>
            <span class="badge badge-outline">{{ formatRestorationStatus(listing.restoration_status) }}</span>
          </div>
        </div>

        <!-- Last Restoration Date -->
        <div v-if="listing.last_restoration_date" class="space-y-1">
          <div class="text-sm text-base-content/70">{{ t('lastRestoration') }}</div>
          <div class="font-medium">{{ formatDate(listing.last_restoration_date) }}</div>
        </div>
      </div>

      <!-- Badges Section (Matching Numbers and Service History - Heritage Cert shown in sidebar) -->
      <div
        v-if="listing.matching_numbers || listing.has_service_history"
        class="flex flex-wrap gap-2 mt-4 pt-4 border-t border-base-300"
      >
        <div v-if="listing.matching_numbers" class="badge badge-success gap-2">
          <i class="fas fa-circle-check"></i>
          {{ t('matchingNumbers') }}
        </div>
        <div v-if="listing.has_service_history" class="badge badge-info gap-2">
          <i class="fas fa-file-circle-check"></i>
          {{ t('serviceHistoryAvailable') }}
        </div>
      </div>

      <!-- Heritage Certificate Details (only show details text, cert badge is in sidebar) -->
      <div v-if="listing.heritage_cert_details" class="mt-4 pt-4 border-t border-base-300">
        <div class="text-sm text-base-content/70 mb-2">{{ t('heritageCertDetails') }}</div>
        <p class="text-sm whitespace-pre-line">{{ listing.heritage_cert_details }}</p>
      </div>

      <!-- Restoration Details -->
      <div v-if="listing.restoration_details" class="mt-4 pt-4 border-t border-base-300">
        <div class="text-sm text-base-content/70 mb-2">{{ t('restorationWork') }}</div>
        <p class="text-sm whitespace-pre-line">{{ listing.restoration_details }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';
  import { RESTORATION_STATUS, getSpecLabel } from '~/utils/miniSpecs';

  const { t } = useI18n();

  interface Props {
    listing: ListingWithPhotos;
  }

  const props = defineProps<Props>();

  // Check if listing has any heritage information to display
  // Note: has_heritage_cert and heritage_cert_number are shown in the sidebar price card
  const hasHeritageInfo = computed(() => {
    return !!(
      props.listing.vin_number ||
      props.listing.chassis_number ||
      props.listing.build_date ||
      props.listing.original_color ||
      props.listing.previous_owners_count !== null ||
      props.listing.restoration_status ||
      props.listing.last_restoration_date ||
      props.listing.matching_numbers ||
      props.listing.has_service_history ||
      props.listing.heritage_cert_details ||
      props.listing.restoration_details
    );
  });

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      // Pin to UTC so SSR (UTC) and client (local TZ) render identically — no
      // hydration mismatch.
      timeZone: 'UTC',
    }).format(date);
  };

  const formatRestorationStatus = (status: string): string => {
    return getSpecLabel(RESTORATION_STATUS, status);
  };
</script>

<i18n lang="json">
{
  "en": {
    "title": "Heritage & Provenance",
    "vinNumber": "VIN Number",
    "chassisNumber": "Chassis Number",
    "buildDate": "Build Date",
    "originalFactoryColor": "Original Factory Color",
    "previousOwners": "Previous Owners",
    "restorationStatus": "Restoration Status",
    "lastRestoration": "Last Restoration",
    "matchingNumbers": "Matching Numbers",
    "serviceHistoryAvailable": "Service History Available",
    "heritageCertDetails": "Heritage Certificate Details",
    "restorationWork": "Restoration Work"
  },
  "es": {
    "title": "Patrimonio y procedencia",
    "vinNumber": "Número VIN",
    "chassisNumber": "Número de chasis",
    "buildDate": "Fecha de fabricación",
    "originalFactoryColor": "Color de fábrica original",
    "previousOwners": "Propietarios anteriores",
    "restorationStatus": "Estado de restauración",
    "lastRestoration": "Última restauración",
    "matchingNumbers": "Números coincidentes",
    "serviceHistoryAvailable": "Historial de servicio disponible",
    "heritageCertDetails": "Detalles del certificado de patrimonio",
    "restorationWork": "Trabajo de restauración"
  },
  "fr": {
    "title": "Patrimoine et provenance",
    "vinNumber": "Numéro VIN",
    "chassisNumber": "Numéro de châssis",
    "buildDate": "Date de fabrication",
    "originalFactoryColor": "Couleur d'usine d'origine",
    "previousOwners": "Propriétaires précédents",
    "restorationStatus": "État de la restauration",
    "lastRestoration": "Dernière restauration",
    "matchingNumbers": "Numéros concordants",
    "serviceHistoryAvailable": "Historique d'entretien disponible",
    "heritageCertDetails": "Détails du certificat patrimonial",
    "restorationWork": "Travaux de restauration"
  },
  "de": {
    "title": "Herkunft & Provenienz",
    "vinNumber": "VIN-Nummer",
    "chassisNumber": "Fahrgestellnummer",
    "buildDate": "Baudatum",
    "originalFactoryColor": "Originale Werksfarbe",
    "previousOwners": "Vorbesitzer",
    "restorationStatus": "Restaurierungsstatus",
    "lastRestoration": "Letzte Restaurierung",
    "matchingNumbers": "Übereinstimmende Nummern",
    "serviceHistoryAvailable": "Serviceheft verfügbar",
    "heritageCertDetails": "Details zum Herkunftszertifikat",
    "restorationWork": "Restaurierungsarbeiten"
  },
  "it": {
    "title": "Patrimonio e provenienza",
    "vinNumber": "Numero VIN",
    "chassisNumber": "Numero di telaio",
    "buildDate": "Data di costruzione",
    "originalFactoryColor": "Colore originale di fabbrica",
    "previousOwners": "Proprietari precedenti",
    "restorationStatus": "Stato del restauro",
    "lastRestoration": "Ultimo restauro",
    "matchingNumbers": "Numeri corrispondenti",
    "serviceHistoryAvailable": "Storico di manutenzione disponibile",
    "heritageCertDetails": "Dettagli del certificato di patrimonio",
    "restorationWork": "Lavori di restauro"
  },
  "pt": {
    "title": "Patrimônio e procedência",
    "vinNumber": "Número VIN",
    "chassisNumber": "Número do chassi",
    "buildDate": "Data de fabricação",
    "originalFactoryColor": "Cor original de fábrica",
    "previousOwners": "Proprietários anteriores",
    "restorationStatus": "Estado da restauração",
    "lastRestoration": "Última restauração",
    "matchingNumbers": "Números correspondentes",
    "serviceHistoryAvailable": "Histórico de manutenção disponível",
    "heritageCertDetails": "Detalhes do certificado de patrimônio",
    "restorationWork": "Trabalho de restauração"
  },
  "ru": {
    "title": "История и происхождение",
    "vinNumber": "Номер VIN",
    "chassisNumber": "Номер шасси",
    "buildDate": "Дата выпуска",
    "originalFactoryColor": "Оригинальный заводской цвет",
    "previousOwners": "Прежние владельцы",
    "restorationStatus": "Статус реставрации",
    "lastRestoration": "Последняя реставрация",
    "matchingNumbers": "Совпадающие номера",
    "serviceHistoryAvailable": "Доступна история обслуживания",
    "heritageCertDetails": "Сведения о сертификате происхождения",
    "restorationWork": "Реставрационные работы"
  },
  "ja": {
    "title": "由来と来歴",
    "vinNumber": "VIN番号",
    "chassisNumber": "シャシー番号",
    "buildDate": "製造日",
    "originalFactoryColor": "オリジナルの工場出荷時カラー",
    "previousOwners": "前所有者",
    "restorationStatus": "レストア状態",
    "lastRestoration": "最終レストア",
    "matchingNumbers": "マッチングナンバー",
    "serviceHistoryAvailable": "整備履歴あり",
    "heritageCertDetails": "ヘリテージ証明書の詳細",
    "restorationWork": "レストア作業"
  },
  "zh": {
    "title": "传承与来历",
    "vinNumber": "VIN 编号",
    "chassisNumber": "底盘编号",
    "buildDate": "制造日期",
    "originalFactoryColor": "原厂出厂颜色",
    "previousOwners": "前任车主",
    "restorationStatus": "修复状态",
    "lastRestoration": "最近一次修复",
    "matchingNumbers": "匹配编号",
    "serviceHistoryAvailable": "提供维修记录",
    "heritageCertDetails": "传承证书详情",
    "restorationWork": "修复工作"
  },
  "ko": {
    "title": "유래 및 내력",
    "vinNumber": "VIN 번호",
    "chassisNumber": "섀시 번호",
    "buildDate": "제작일",
    "originalFactoryColor": "공장 출고 시 원본 색상",
    "previousOwners": "이전 소유자",
    "restorationStatus": "복원 상태",
    "lastRestoration": "마지막 복원",
    "matchingNumbers": "일치 번호",
    "serviceHistoryAvailable": "정비 이력 제공",
    "heritageCertDetails": "헤리티지 인증서 세부 정보",
    "restorationWork": "복원 작업"
  }
}
</i18n>
