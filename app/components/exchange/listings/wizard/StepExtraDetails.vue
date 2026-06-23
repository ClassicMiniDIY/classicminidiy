<template>
  <div class="space-y-8">
    <!-- Explanation Banner -->
    <div class="alert alert-success">
      <i class="fas fa-lightbulb text-xl"></i>
      <div>
        <p class="font-medium">{{ t('banner.title') }}</p>
        <p class="text-sm">{{ t('banner.body') }}</p>
      </div>
    </div>

    <!-- Vehicle Extra Details -->
    <template v-if="category === 'vehicle'">
      <!-- Heritage & Provenance -->
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" />
        <div class="collapse-title text-lg font-medium">
          <i class="fas fa-file-lines inline mr-2"></i>
          {{ t('heritage.section') }}
        </div>
        <div class="collapse-content">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('heritage.vin') }}</legend>
              <input
                v-model="form.vinNumber"
                type="text"
                class="input input-bordered w-full"
                :placeholder="t('heritage.vinPlaceholder')"
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('heritage.engineNumber') }}</legend>
              <input
                v-model="form.engineNumber"
                type="text"
                class="input input-bordered w-full"
                :placeholder="t('heritage.engineNumberPlaceholder')"
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('heritage.buildDate') }}</legend>
              <input
                v-model="form.buildDate"
                type="text"
                class="input input-bordered w-full"
                :placeholder="t('heritage.buildDatePlaceholder')"
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('heritage.originalColor') }}</legend>
              <input
                v-model="form.originalColor"
                type="text"
                class="input input-bordered w-full"
                :placeholder="t('heritage.originalColorPlaceholder')"
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('heritage.previousOwners') }}</legend>
              <input
                v-model.number="form.previousOwnersCount"
                type="number"
                class="input input-bordered w-full"
                :placeholder="t('heritage.previousOwnersPlaceholder')"
                min="0"
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('heritage.restorationStatus') }}</legend>
              <select v-model="form.restorationStatus" class="select select-bordered w-full">
                <option value="">{{ t('common.select') }}</option>
                <option v-for="status in RESTORATION_STATUS" :key="status.value" :value="status.value">
                  {{ status.label }}
                </option>
              </select>
            </fieldset>

            <fieldset class="fieldset md:col-span-2">
              <legend class="fieldset-legend">{{ t('heritage.certificate') }}</legend>
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input v-model="form.hasHeritageCert" type="checkbox" class="checkbox checkbox-primary" />
                  <span>{{ t('heritage.hasCert') }}</span>
                </label>
              </div>
              <input
                v-if="form.hasHeritageCert"
                v-model="form.heritageCertNumber"
                type="text"
                class="input input-bordered w-full mt-2"
                :placeholder="t('heritage.certNumberPlaceholder')"
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('heritage.matchingNumbers') }}</legend>
              <select v-model="form.matchingNumbers" class="select select-bordered w-full">
                <option :value="null">{{ t('common.unknown') }}</option>
                <option :value="true">{{ t('heritage.matchingYes') }}</option>
                <option :value="false">{{ t('heritage.matchingNo') }}</option>
              </select>
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('heritage.serviceHistory') }}</legend>
              <select v-model="form.hasServiceHistory" class="select select-bordered w-full">
                <option :value="null">{{ t('common.unknown') }}</option>
                <option :value="true">{{ t('heritage.serviceYes') }}</option>
                <option :value="false">{{ t('heritage.serviceNo') }}</option>
              </select>
            </fieldset>

            <fieldset class="fieldset md:col-span-2">
              <legend class="fieldset-legend">{{ t('heritage.restorationDetails') }}</legend>
              <textarea
                v-model="form.restorationDetails"
                class="textarea textarea-bordered w-full h-24"
                :placeholder="t('heritage.restorationDetailsPlaceholder')"
              ></textarea>
            </fieldset>
          </div>
        </div>
      </div>

      <!-- Engine & Mechanical -->
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" />
        <div class="collapse-title text-lg font-medium">
          <i class="fas fa-gear inline mr-2"></i>
          {{ t('engine.section') }}
        </div>
        <div class="collapse-content">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('engine.engineSize') }}</legend>
              <select v-model="form.engineSize" class="select select-bordered w-full">
                <option value="">{{ t('common.select') }}</option>
                <option value="848cc">848cc</option>
                <option value="998cc">998cc</option>
                <option value="1098cc">1098cc</option>
                <option value="1275cc">1275cc</option>
                <option value="other">{{ t('common.other') }}</option>
              </select>
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('engine.gearboxType') }}</legend>
              <select v-model="form.gearboxType" class="select select-bordered w-full">
                <option value="">{{ t('common.select') }}</option>
                <option value="magic_wand">{{ t('engine.gearboxMagicWand') }}</option>
                <option value="3_synchro_remote">{{ t('engine.gearbox3Synchro') }}</option>
                <option value="4_synchro_remote">{{ t('engine.gearbox4Synchro') }}</option>
                <option value="rod_change">{{ t('engine.gearboxRodChange') }}</option>
                <option value="automatic">{{ t('engine.gearboxAutomatic') }}</option>
              </select>
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('engine.carbType') }}</legend>
              <select v-model="form.carbType" class="select select-bordered w-full">
                <option value="">{{ t('common.select') }}</option>
                <option value="single_su">{{ t('engine.carbSingleSu') }}</option>
                <option value="twin_su">{{ t('engine.carbTwinSu') }}</option>
                <option value="weber">{{ t('engine.carbWeber') }}</option>
                <option value="stromberg">{{ t('engine.carbStromberg') }}</option>
                <option value="fuel_injection">{{ t('engine.carbFuelInjection') }}</option>
                <option value="other">{{ t('common.other') }}</option>
              </select>
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('engine.brakeType') }}</legend>
              <select v-model="form.brakeType" class="select select-bordered w-full">
                <option value="">{{ t('common.select') }}</option>
                <option value="standard_drum">{{ t('engine.brakeDrums') }}</option>
                <option value="disc_front">{{ t('engine.brakeFrontDisc') }}</option>
                <option value="four_wheel_disc">{{ t('engine.brakeFourWheelDisc') }}</option>
              </select>
            </fieldset>
          </div>
        </div>
      </div>

      <!-- Exterior & Body -->
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" />
        <div class="collapse-title text-lg font-medium">
          <i class="fas fa-paintbrush inline mr-2"></i>
          {{ t('exterior.section') }}
        </div>
        <div class="collapse-content">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('exterior.roofColor') }}</legend>
              <input
                v-model="form.roofColor"
                type="text"
                class="input input-bordered w-full"
                :placeholder="t('exterior.roofColorPlaceholder')"
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('exterior.wheelType') }}</legend>
              <select v-model="form.wheelType" class="select select-bordered w-full">
                <option value="">{{ t('common.select') }}</option>
                <option value="standard">{{ t('exterior.wheelStandard') }}</option>
                <option value="minilite">{{ t('exterior.wheelMinilite') }}</option>
                <option value="cooper_s">{{ t('exterior.wheelCooperS') }}</option>
                <option value="revolution">{{ t('exterior.wheelRevolution') }}</option>
                <option value="rose_petal">{{ t('exterior.wheelRosePetal') }}</option>
                <option value="other">{{ t('common.other') }}</option>
              </select>
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('exterior.windowType') }}</legend>
              <select v-model="form.windowType" class="select select-bordered w-full">
                <option value="">{{ t('common.select') }}</option>
                <option value="sliding">{{ t('exterior.windowSliding') }}</option>
                <option value="wind_up">{{ t('exterior.windowWindUp') }}</option>
              </select>
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('exterior.additionalFeatures') }}</legend>
              <div class="flex flex-wrap gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input v-model="form.hasStripes" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
                  <span class="text-sm">{{ t('exterior.racingStripes') }}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input v-model="form.hasSunroof" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
                  <span class="text-sm">{{ t('exterior.sunroof') }}</span>
                </label>
              </div>
            </fieldset>
          </div>
        </div>
      </div>

      <!-- Modifications & Condition -->
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" />
        <div class="collapse-title text-lg font-medium">
          <i class="fas fa-screwdriver-wrench inline mr-2"></i>
          {{ t('mods.section') }}
        </div>
        <div class="collapse-content">
          <div class="space-y-4 pt-4">
            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('mods.engineMods') }}</legend>
              <textarea
                v-model="form.engineMods"
                class="textarea textarea-bordered w-full h-20"
                :placeholder="t('mods.engineModsPlaceholder')"
              ></textarea>
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('mods.suspensionMods') }}</legend>
              <textarea
                v-model="form.suspensionMods"
                class="textarea textarea-bordered w-full h-20"
                :placeholder="t('mods.suspensionModsPlaceholder')"
              ></textarea>
            </fieldset>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('mods.rustCondition') }}</legend>
                <select v-model="form.rustCondition" class="select select-bordered w-full">
                  <option value="">{{ t('common.select') }}</option>
                  <option value="none_visible">{{ t('mods.rustNone') }}</option>
                  <option value="minor_surface">{{ t('mods.rustMinor') }}</option>
                  <option value="moderate">{{ t('mods.rustModerate') }}</option>
                  <option value="significant">{{ t('mods.rustSignificant') }}</option>
                </select>
              </fieldset>

              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('mods.undersideCondition') }}</legend>
                <select v-model="form.undersideCondition" class="select select-bordered w-full">
                  <option value="">{{ t('common.select') }}</option>
                  <option value="excellent">{{ t('mods.undersideExcellent') }}</option>
                  <option value="good">{{ t('mods.undersideGood') }}</option>
                  <option value="fair">{{ t('mods.undersideFair') }}</option>
                  <option value="needs_work">{{ t('mods.undersidePoor') }}</option>
                </select>
              </fieldset>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Parts Extra Details -->
    <template v-if="category === 'parts'">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('parts.partNumber') }}</legend>
          <input
            v-model="form.partNumber"
            type="text"
            class="input input-bordered w-full"
            :placeholder="t('parts.partNumberPlaceholder')"
          />
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('parts.oemOrAftermarket') }}</legend>
          <select v-model="form.oemOrAftermarket" class="select select-bordered w-full">
            <option value="">{{ t('common.select') }}</option>
            <option value="oem">{{ t('parts.oemGenuine') }}</option>
            <option value="aftermarket">{{ t('parts.aftermarket') }}</option>
            <option value="reproduction">{{ t('parts.reproduction') }}</option>
          </select>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('parts.quantityAvailable') }}</legend>
          <input v-model.number="form.quantityAvailable" type="number" class="input input-bordered w-full" min="1" />
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('parts.fitsModels') }}</legend>
          <input
            v-model="fitsModelsInput"
            type="text"
            class="input input-bordered w-full"
            :placeholder="t('parts.fitsModelsPlaceholder')"
            @blur="parseFitsModels"
          />
        </fieldset>
      </div>
    </template>

    <!-- Engine Extra Details -->
    <template v-if="category === 'engine'">
      <p class="text-base-content/70">{{ t('engineCategory.intro') }}</p>
      <ul class="list-disc list-inside text-base-content/70 space-y-1">
        <li>{{ t('engineCategory.sizeType') }}</li>
        <li>{{ t('engineCategory.rebuilds') }}</li>
        <li>{{ t('engineCategory.donorVehicle') }}</li>
        <li>{{ t('engineCategory.runningCondition') }}</li>
        <li>{{ t('engineCategory.included') }}</li>
      </ul>
    </template>

    <!-- Shipping (for parts and engines) -->
    <template v-if="category === 'parts' || category === 'engine'">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">{{ t('shipping.section') }}</legend>
        <div class="space-y-4">
          <!-- Shipping toggle -->
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.shippingAvailable" type="checkbox" class="checkbox checkbox-primary" />
            <span>{{ t('shipping.available') }}</span>
          </label>

          <!-- Expanded shipping options (shown when shipping enabled) -->
          <template v-if="form.shippingAvailable">
            <!-- Ships To -->
            <div>
              <label class="text-sm font-medium mb-2 block">{{ t('shipping.shipsTo') }}</label>
              <div class="flex flex-wrap gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    v-model="form.shipsTo"
                    type="radio"
                    value="domestic_only"
                    class="radio radio-sm radio-primary"
                  />
                  <span class="text-sm">{{ t('shipping.domesticOnly') }}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    v-model="form.shipsTo"
                    type="radio"
                    value="international"
                    class="radio radio-sm radio-primary"
                  />
                  <span class="text-sm">{{ t('shipping.international') }}</span>
                </label>
              </div>
            </div>
          </template>

          <!-- Pickup Only notice -->
          <p v-if="!form.shippingAvailable" class="text-sm text-base-content/60">
            {{ t('shipping.pickupOnlyNotice') }}
          </p>
        </div>
      </fieldset>
    </template>

    <!-- Navigation -->
    <div class="flex justify-between pt-4">
      <button type="button" class="btn btn-ghost" @click="$emit('back')">
        <i class="fas fa-arrow-left"></i>
        {{ t('nav.back') }}
      </button>
      <div class="flex gap-2">
        <button type="button" class="btn btn-outline" @click="$emit('save-draft')" :disabled="savingDraft">
          <span v-if="savingDraft" class="loading loading-spinner loading-sm"></span>
          <i v-else class="fas fa-bookmark"></i>
          {{ t('nav.saveDraft') }}
        </button>
        <button type="button" class="btn btn-primary" @click="$emit('next')">
          {{ t('nav.continueToReview') }}
          <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { RESTORATION_STATUS } from '~/utils/miniSpecs';

  const { t } = useI18n();

  const props = defineProps<{
    modelValue: any;
    category: 'vehicle' | 'engine' | 'parts' | '';
    savingDraft?: boolean;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: any];
    next: [];
    back: [];
    'save-draft': [];
  }>();

  const form = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value),
  });

  // Helper for fits models input
  const fitsModelsInput = ref(props.modelValue.fitsModels?.join(', ') || '');

  const parseFitsModels = () => {
    const models = fitsModelsInput.value
      .split(',')
      .map((m: string) => m.trim())
      .filter(Boolean);
    form.value.fitsModels = models;
  };
</script>

<i18n lang="json">
{
  "en": {
    "banner": { "title": "Complete listings sell faster!", "body": "Listings with detailed specifications, heritage information, and modification details get 3x more views and sell 40% faster on average." },
    "common": { "select": "Select...", "unknown": "Unknown", "other": "Other" },
    "heritage": { "section": "Heritage & Provenance", "vin": "VIN / Chassis Number", "vinPlaceholder": "e.g., SAXXN...", "engineNumber": "Engine Number", "engineNumberPlaceholder": "e.g., 12H...", "buildDate": "Build Date", "buildDatePlaceholder": "e.g., March 1967 or 15/06/1972", "originalColor": "Original Color", "originalColorPlaceholder": "e.g., Old English White", "previousOwners": "Previous Owners", "previousOwnersPlaceholder": "e.g., 3", "restorationStatus": "Restoration Status", "certificate": "Heritage Certificate", "hasCert": "I have a BMIHT Heritage Certificate", "certNumberPlaceholder": "Certificate number...", "matchingNumbers": "Matching Numbers", "matchingYes": "Yes - Matching Numbers", "matchingNo": "No - Numbers Don't Match", "serviceHistory": "Service History", "serviceYes": "Yes - Full or Partial History", "serviceNo": "No Service History", "restorationDetails": "Restoration Details", "restorationDetailsPlaceholder": "Describe any restoration work, when it was done, and by whom..." },
    "engine": { "section": "Engine & Mechanical", "engineSize": "Engine Size", "gearboxType": "Gearbox Type", "gearboxMagicWand": "Magic Wand (Remote)", "gearbox3Synchro": "3-Synchro Remote", "gearbox4Synchro": "4-Synchro Remote", "gearboxRodChange": "Rod Change", "gearboxAutomatic": "Automatic", "carbType": "Carburettor Type", "carbSingleSu": "Single SU", "carbTwinSu": "Twin SU", "carbWeber": "Weber", "carbStromberg": "Stromberg", "carbFuelInjection": "Fuel Injection", "brakeType": "Brake Type", "brakeDrums": "Drums All Round", "brakeFrontDisc": "Front Disc / Rear Drum", "brakeFourWheelDisc": "4-Wheel Disc" },
    "exterior": { "section": "Exterior & Body", "roofColor": "Roof Color", "roofColorPlaceholder": "e.g., Black, White, Body Color", "wheelType": "Wheel Type", "wheelStandard": "Standard Steel", "wheelMinilite": "Minilite", "wheelCooperS": "Cooper S", "wheelRevolution": "Revolution", "wheelRosePetal": "Rose Petal", "windowType": "Window Type", "windowSliding": "Sliding Windows", "windowWindUp": "Winding Windows", "additionalFeatures": "Additional Features", "racingStripes": "Racing Stripes", "sunroof": "Sunroof" },
    "mods": { "section": "Modifications & Condition", "engineMods": "Engine Modifications", "engineModsPlaceholder": "e.g., Big bore kit, ported head, performance cam...", "suspensionMods": "Suspension Modifications", "suspensionModsPlaceholder": "e.g., Lowered, adjustable platform, uprated springs...", "rustCondition": "Rust Condition", "rustNone": "None Visible", "rustMinor": "Minor Surface Rust", "rustModerate": "Moderate - Some Repair Needed", "rustSignificant": "Significant - Major Repair Needed", "undersideCondition": "Underside Condition", "undersideExcellent": "Excellent - No Issues", "undersideGood": "Good - Minor Wear", "undersideFair": "Fair - Some Repairs Needed", "undersidePoor": "Poor - Significant Work Needed" },
    "parts": { "partNumber": "Part Number", "partNumberPlaceholder": "e.g., AHH5594", "oemOrAftermarket": "OEM / Aftermarket", "oemGenuine": "OEM / Genuine", "aftermarket": "Aftermarket", "reproduction": "Reproduction", "quantityAvailable": "Quantity Available", "fitsModels": "Fits Models", "fitsModelsPlaceholder": "e.g., Mk1, Mk2, Cooper S (comma separated)" },
    "engineCategory": { "intro": "All the details you need are covered in the description field. Make sure to include:", "sizeType": "Engine size and type", "rebuilds": "Any rebuilds or modifications", "donorVehicle": "What vehicle it came from", "runningCondition": "Running condition", "included": "What's included (carb, manifold, etc.)" },
    "shipping": { "section": "Shipping", "available": "Shipping Available", "shipsTo": "Ships To", "domesticOnly": "Domestic Only", "international": "International", "pickupOnlyNotice": "Listing will be shown as \"Pickup Only\"" },
    "nav": { "back": "Back", "saveDraft": "Save Draft", "continueToReview": "Continue to Review" }
  },
  "es": {
    "banner": { "title": "¡Los anuncios completos se venden más rápido!", "body": "Los anuncios con especificaciones detalladas, información de procedencia y detalles de modificaciones reciben 3 veces más visitas y se venden un 40 % más rápido de media." },
    "common": { "select": "Seleccionar...", "unknown": "Desconocido", "other": "Otro" },
    "heritage": { "section": "Historia y procedencia", "vin": "Número de bastidor / VIN", "vinPlaceholder": "p. ej., SAXXN...", "engineNumber": "Número de motor", "engineNumberPlaceholder": "p. ej., 12H...", "buildDate": "Fecha de fabricación", "buildDatePlaceholder": "p. ej., marzo de 1967 o 15/06/1972", "originalColor": "Color original", "originalColorPlaceholder": "p. ej., Old English White", "previousOwners": "Propietarios anteriores", "previousOwnersPlaceholder": "p. ej., 3", "restorationStatus": "Estado de restauración", "certificate": "Certificado de procedencia", "hasCert": "Tengo un certificado de procedencia BMIHT", "certNumberPlaceholder": "Número de certificado...", "matchingNumbers": "Números coincidentes", "matchingYes": "Sí - Números coincidentes", "matchingNo": "No - Los números no coinciden", "serviceHistory": "Historial de mantenimiento", "serviceYes": "Sí - Historial completo o parcial", "serviceNo": "Sin historial de mantenimiento", "restorationDetails": "Detalles de la restauración", "restorationDetailsPlaceholder": "Describe los trabajos de restauración, cuándo se hicieron y por quién..." },
    "engine": { "section": "Motor y mecánica", "engineSize": "Cilindrada", "gearboxType": "Tipo de caja de cambios", "gearboxMagicWand": "Magic Wand (remota)", "gearbox3Synchro": "Remota de 3 sincros", "gearbox4Synchro": "Remota de 4 sincros", "gearboxRodChange": "Rod Change", "gearboxAutomatic": "Automática", "carbType": "Tipo de carburador", "carbSingleSu": "SU simple", "carbTwinSu": "SU doble", "carbWeber": "Weber", "carbStromberg": "Stromberg", "carbFuelInjection": "Inyección de combustible", "brakeType": "Tipo de frenos", "brakeDrums": "Tambores en las cuatro ruedas", "brakeFrontDisc": "Disco delantero / Tambor trasero", "brakeFourWheelDisc": "Discos en las cuatro ruedas" },
    "exterior": { "section": "Exterior y carrocería", "roofColor": "Color del techo", "roofColorPlaceholder": "p. ej., negro, blanco, color de carrocería", "wheelType": "Tipo de llanta", "wheelStandard": "Acero estándar", "wheelMinilite": "Minilite", "wheelCooperS": "Cooper S", "wheelRevolution": "Revolution", "wheelRosePetal": "Rose Petal", "windowType": "Tipo de ventanilla", "windowSliding": "Ventanillas correderas", "windowWindUp": "Ventanillas elevables", "additionalFeatures": "Características adicionales", "racingStripes": "Franjas de competición", "sunroof": "Techo solar" },
    "mods": { "section": "Modificaciones y estado", "engineMods": "Modificaciones del motor", "engineModsPlaceholder": "p. ej., kit big bore, culata trabajada, árbol de levas de competición...", "suspensionMods": "Modificaciones de suspensión", "suspensionModsPlaceholder": "p. ej., rebajada, plataforma ajustable, muelles reforzados...", "rustCondition": "Estado del óxido", "rustNone": "Sin óxido visible", "rustMinor": "Óxido superficial leve", "rustModerate": "Moderado - Requiere alguna reparación", "rustSignificant": "Importante - Requiere reparación mayor", "undersideCondition": "Estado de los bajos", "undersideExcellent": "Excelente - Sin problemas", "undersideGood": "Bueno - Desgaste menor", "undersideFair": "Aceptable - Requiere algunas reparaciones", "undersidePoor": "Malo - Requiere trabajo importante" },
    "parts": { "partNumber": "Número de pieza", "partNumberPlaceholder": "p. ej., AHH5594", "oemOrAftermarket": "OEM / Aftermarket", "oemGenuine": "OEM / Original", "aftermarket": "Aftermarket", "reproduction": "Reproducción", "quantityAvailable": "Cantidad disponible", "fitsModels": "Modelos compatibles", "fitsModelsPlaceholder": "p. ej., Mk1, Mk2, Cooper S (separados por comas)" },
    "engineCategory": { "intro": "Todos los detalles que necesitas se cubren en el campo de descripción. Asegúrate de incluir:", "sizeType": "Cilindrada y tipo de motor", "rebuilds": "Reconstrucciones o modificaciones", "donorVehicle": "De qué vehículo proviene", "runningCondition": "Estado de funcionamiento", "included": "Qué se incluye (carburador, colector, etc.)" },
    "shipping": { "section": "Envío", "available": "Envío disponible", "shipsTo": "Envía a", "domesticOnly": "Solo nacional", "international": "Internacional", "pickupOnlyNotice": "El anuncio se mostrará como \"Solo recogida\"" },
    "nav": { "back": "Atrás", "saveDraft": "Guardar borrador", "continueToReview": "Continuar a revisión" }
  },
  "fr": {
    "banner": { "title": "Les annonces complètes se vendent plus vite !", "body": "Les annonces avec des spécifications détaillées, des informations de provenance et des détails de modification reçoivent 3 fois plus de vues et se vendent 40 % plus vite en moyenne." },
    "common": { "select": "Sélectionner...", "unknown": "Inconnu", "other": "Autre" },
    "heritage": { "section": "Histoire et provenance", "vin": "Numéro de châssis / VIN", "vinPlaceholder": "ex. SAXXN...", "engineNumber": "Numéro de moteur", "engineNumberPlaceholder": "ex. 12H...", "buildDate": "Date de fabrication", "buildDatePlaceholder": "ex. mars 1967 ou 15/06/1972", "originalColor": "Couleur d'origine", "originalColorPlaceholder": "ex. Old English White", "previousOwners": "Propriétaires précédents", "previousOwnersPlaceholder": "ex. 3", "restorationStatus": "État de restauration", "certificate": "Certificat de provenance", "hasCert": "Je possède un certificat de provenance BMIHT", "certNumberPlaceholder": "Numéro de certificat...", "matchingNumbers": "Numéros concordants", "matchingYes": "Oui - Numéros concordants", "matchingNo": "Non - Les numéros ne concordent pas", "serviceHistory": "Historique d'entretien", "serviceYes": "Oui - Historique complet ou partiel", "serviceNo": "Aucun historique d'entretien", "restorationDetails": "Détails de la restauration", "restorationDetailsPlaceholder": "Décrivez les travaux de restauration, quand ils ont été réalisés et par qui..." },
    "engine": { "section": "Moteur et mécanique", "engineSize": "Cylindrée", "gearboxType": "Type de boîte de vitesses", "gearboxMagicWand": "Magic Wand (déportée)", "gearbox3Synchro": "Déportée 3 synchros", "gearbox4Synchro": "Déportée 4 synchros", "gearboxRodChange": "Rod Change", "gearboxAutomatic": "Automatique", "carbType": "Type de carburateur", "carbSingleSu": "SU simple", "carbTwinSu": "Double SU", "carbWeber": "Weber", "carbStromberg": "Stromberg", "carbFuelInjection": "Injection", "brakeType": "Type de freins", "brakeDrums": "Tambours aux quatre roues", "brakeFrontDisc": "Disque avant / Tambour arrière", "brakeFourWheelDisc": "Disques aux quatre roues" },
    "exterior": { "section": "Extérieur et carrosserie", "roofColor": "Couleur du toit", "roofColorPlaceholder": "ex. noir, blanc, couleur carrosserie", "wheelType": "Type de jante", "wheelStandard": "Acier standard", "wheelMinilite": "Minilite", "wheelCooperS": "Cooper S", "wheelRevolution": "Revolution", "wheelRosePetal": "Rose Petal", "windowType": "Type de vitre", "windowSliding": "Vitres coulissantes", "windowWindUp": "Vitres à manivelle", "additionalFeatures": "Caractéristiques supplémentaires", "racingStripes": "Bandes de course", "sunroof": "Toit ouvrant" },
    "mods": { "section": "Modifications et état", "engineMods": "Modifications moteur", "engineModsPlaceholder": "ex. kit big bore, culasse retravaillée, arbre à cames sport...", "suspensionMods": "Modifications de suspension", "suspensionModsPlaceholder": "ex. rabaissée, plateforme réglable, ressorts renforcés...", "rustCondition": "État de la corrosion", "rustNone": "Aucune visible", "rustMinor": "Corrosion de surface légère", "rustModerate": "Modérée - Réparation à prévoir", "rustSignificant": "Importante - Réparation majeure nécessaire", "undersideCondition": "État du dessous de caisse", "undersideExcellent": "Excellent - Aucun problème", "undersideGood": "Bon - Usure mineure", "undersideFair": "Correct - Quelques réparations nécessaires", "undersidePoor": "Mauvais - Travaux importants nécessaires" },
    "parts": { "partNumber": "Référence de pièce", "partNumberPlaceholder": "ex. AHH5594", "oemOrAftermarket": "OEM / Adaptable", "oemGenuine": "OEM / D'origine", "aftermarket": "Adaptable", "reproduction": "Reproduction", "quantityAvailable": "Quantité disponible", "fitsModels": "Modèles compatibles", "fitsModelsPlaceholder": "ex. Mk1, Mk2, Cooper S (séparés par des virgules)" },
    "engineCategory": { "intro": "Tous les détails nécessaires sont couverts dans le champ de description. Veillez à inclure :", "sizeType": "Cylindrée et type de moteur", "rebuilds": "Toute réfection ou modification", "donorVehicle": "De quel véhicule il provient", "runningCondition": "État de fonctionnement", "included": "Ce qui est inclus (carburateur, collecteur, etc.)" },
    "shipping": { "section": "Expédition", "available": "Expédition disponible", "shipsTo": "Expédie vers", "domesticOnly": "National uniquement", "international": "International", "pickupOnlyNotice": "L'annonce sera affichée comme \"Retrait uniquement\"" },
    "nav": { "back": "Retour", "saveDraft": "Enregistrer le brouillon", "continueToReview": "Continuer vers la vérification" }
  },
  "de": {
    "banner": { "title": "Vollständige Anzeigen verkaufen sich schneller!", "body": "Anzeigen mit detaillierten Spezifikationen, Herkunftsangaben und Modifikationsdetails erhalten 3-mal mehr Aufrufe und verkaufen sich im Durchschnitt 40 % schneller." },
    "common": { "select": "Auswählen...", "unknown": "Unbekannt", "other": "Sonstiges" },
    "heritage": { "section": "Geschichte & Herkunft", "vin": "Fahrgestellnummer / VIN", "vinPlaceholder": "z. B. SAXXN...", "engineNumber": "Motornummer", "engineNumberPlaceholder": "z. B. 12H...", "buildDate": "Baudatum", "buildDatePlaceholder": "z. B. März 1967 oder 15.06.1972", "originalColor": "Originalfarbe", "originalColorPlaceholder": "z. B. Old English White", "previousOwners": "Vorbesitzer", "previousOwnersPlaceholder": "z. B. 3", "restorationStatus": "Restaurierungsstatus", "certificate": "Heritage-Zertifikat", "hasCert": "Ich habe ein BMIHT-Heritage-Zertifikat", "certNumberPlaceholder": "Zertifikatsnummer...", "matchingNumbers": "Übereinstimmende Nummern", "matchingYes": "Ja - Übereinstimmende Nummern", "matchingNo": "Nein - Nummern stimmen nicht überein", "serviceHistory": "Wartungshistorie", "serviceYes": "Ja - Vollständige oder teilweise Historie", "serviceNo": "Keine Wartungshistorie", "restorationDetails": "Restaurierungsdetails", "restorationDetailsPlaceholder": "Beschreiben Sie etwaige Restaurierungsarbeiten, wann und von wem sie durchgeführt wurden..." },
    "engine": { "section": "Motor & Mechanik", "engineSize": "Hubraum", "gearboxType": "Getriebetyp", "gearboxMagicWand": "Magic Wand (entfernt)", "gearbox3Synchro": "3-Synchro entfernt", "gearbox4Synchro": "4-Synchro entfernt", "gearboxRodChange": "Rod Change", "gearboxAutomatic": "Automatik", "carbType": "Vergasertyp", "carbSingleSu": "Einzel-SU", "carbTwinSu": "Doppel-SU", "carbWeber": "Weber", "carbStromberg": "Stromberg", "carbFuelInjection": "Einspritzung", "brakeType": "Bremstyp", "brakeDrums": "Trommeln rundum", "brakeFrontDisc": "Scheibe vorn / Trommel hinten", "brakeFourWheelDisc": "Scheiben rundum" },
    "exterior": { "section": "Außen & Karosserie", "roofColor": "Dachfarbe", "roofColorPlaceholder": "z. B. Schwarz, Weiß, Karosseriefarbe", "wheelType": "Felgentyp", "wheelStandard": "Standard-Stahl", "wheelMinilite": "Minilite", "wheelCooperS": "Cooper S", "wheelRevolution": "Revolution", "wheelRosePetal": "Rose Petal", "windowType": "Fenstertyp", "windowSliding": "Schiebefenster", "windowWindUp": "Kurbelfenster", "additionalFeatures": "Zusätzliche Ausstattung", "racingStripes": "Rennstreifen", "sunroof": "Schiebedach" },
    "mods": { "section": "Modifikationen & Zustand", "engineMods": "Motormodifikationen", "engineModsPlaceholder": "z. B. Big-Bore-Kit, bearbeiteter Kopf, Sport-Nockenwelle...", "suspensionMods": "Fahrwerksmodifikationen", "suspensionModsPlaceholder": "z. B. tiefergelegt, verstellbares Fahrwerk, verstärkte Federn...", "rustCondition": "Rostzustand", "rustNone": "Nicht sichtbar", "rustMinor": "Leichter Oberflächenrost", "rustModerate": "Mäßig - Reparatur erforderlich", "rustSignificant": "Erheblich - Größere Reparatur erforderlich", "undersideCondition": "Zustand der Unterseite", "undersideExcellent": "Ausgezeichnet - Keine Probleme", "undersideGood": "Gut - Geringer Verschleiß", "undersideFair": "Mäßig - Einige Reparaturen erforderlich", "undersidePoor": "Schlecht - Erhebliche Arbeiten erforderlich" },
    "parts": { "partNumber": "Teilenummer", "partNumberPlaceholder": "z. B. AHH5594", "oemOrAftermarket": "OEM / Zubehör", "oemGenuine": "OEM / Original", "aftermarket": "Zubehör", "reproduction": "Nachbau", "quantityAvailable": "Verfügbare Menge", "fitsModels": "Passende Modelle", "fitsModelsPlaceholder": "z. B. Mk1, Mk2, Cooper S (durch Kommas getrennt)" },
    "engineCategory": { "intro": "Alle benötigten Angaben werden im Beschreibungsfeld abgedeckt. Bitte unbedingt angeben:", "sizeType": "Hubraum und Motortyp", "rebuilds": "Etwaige Überholungen oder Modifikationen", "donorVehicle": "Aus welchem Fahrzeug er stammt", "runningCondition": "Laufzustand", "included": "Was enthalten ist (Vergaser, Krümmer usw.)" },
    "shipping": { "section": "Versand", "available": "Versand verfügbar", "shipsTo": "Versand nach", "domesticOnly": "Nur Inland", "international": "International", "pickupOnlyNotice": "Anzeige wird als \"Nur Abholung\" angezeigt" },
    "nav": { "back": "Zurück", "saveDraft": "Entwurf speichern", "continueToReview": "Weiter zur Überprüfung" }
  },
  "it": {
    "banner": { "title": "Gli annunci completi si vendono più velocemente!", "body": "Gli annunci con specifiche dettagliate, informazioni sulla provenienza e dettagli sulle modifiche ricevono 3 volte più visualizzazioni e si vendono in media il 40 % più velocemente." },
    "common": { "select": "Seleziona...", "unknown": "Sconosciuto", "other": "Altro" },
    "heritage": { "section": "Storia e provenienza", "vin": "Numero di telaio / VIN", "vinPlaceholder": "es. SAXXN...", "engineNumber": "Numero motore", "engineNumberPlaceholder": "es. 12H...", "buildDate": "Data di produzione", "buildDatePlaceholder": "es. marzo 1967 o 15/06/1972", "originalColor": "Colore originale", "originalColorPlaceholder": "es. Old English White", "previousOwners": "Proprietari precedenti", "previousOwnersPlaceholder": "es. 3", "restorationStatus": "Stato del restauro", "certificate": "Certificato di provenienza", "hasCert": "Possiedo un certificato di provenienza BMIHT", "certNumberPlaceholder": "Numero del certificato...", "matchingNumbers": "Numeri corrispondenti", "matchingYes": "Sì - Numeri corrispondenti", "matchingNo": "No - I numeri non corrispondono", "serviceHistory": "Storico tagliandi", "serviceYes": "Sì - Storico completo o parziale", "serviceNo": "Nessuno storico tagliandi", "restorationDetails": "Dettagli del restauro", "restorationDetailsPlaceholder": "Descrivi gli interventi di restauro, quando sono stati eseguiti e da chi..." },
    "engine": { "section": "Motore e meccanica", "engineSize": "Cilindrata", "gearboxType": "Tipo di cambio", "gearboxMagicWand": "Magic Wand (remoto)", "gearbox3Synchro": "Remoto 3 sincro", "gearbox4Synchro": "Remoto 4 sincro", "gearboxRodChange": "Rod Change", "gearboxAutomatic": "Automatico", "carbType": "Tipo di carburatore", "carbSingleSu": "SU singolo", "carbTwinSu": "Doppio SU", "carbWeber": "Weber", "carbStromberg": "Stromberg", "carbFuelInjection": "Iniezione", "brakeType": "Tipo di freni", "brakeDrums": "Tamburi su tutte le ruote", "brakeFrontDisc": "Disco anteriore / Tamburo posteriore", "brakeFourWheelDisc": "Dischi su tutte le ruote" },
    "exterior": { "section": "Esterni e carrozzeria", "roofColor": "Colore del tetto", "roofColorPlaceholder": "es. nero, bianco, colore carrozzeria", "wheelType": "Tipo di cerchi", "wheelStandard": "Acciaio standard", "wheelMinilite": "Minilite", "wheelCooperS": "Cooper S", "wheelRevolution": "Revolution", "wheelRosePetal": "Rose Petal", "windowType": "Tipo di finestrini", "windowSliding": "Finestrini scorrevoli", "windowWindUp": "Finestrini a manovella", "additionalFeatures": "Caratteristiche aggiuntive", "racingStripes": "Strisce racing", "sunroof": "Tetto apribile" },
    "mods": { "section": "Modifiche e condizioni", "engineMods": "Modifiche al motore", "engineModsPlaceholder": "es. kit big bore, testa lavorata, albero a camme sportivo...", "suspensionMods": "Modifiche alle sospensioni", "suspensionModsPlaceholder": "es. abbassata, piattaforma regolabile, molle maggiorate...", "rustCondition": "Condizioni della ruggine", "rustNone": "Nessuna visibile", "rustMinor": "Ruggine superficiale leggera", "rustModerate": "Moderata - Necessaria qualche riparazione", "rustSignificant": "Significativa - Necessaria riparazione importante", "undersideCondition": "Condizioni del sottoscocca", "undersideExcellent": "Eccellente - Nessun problema", "undersideGood": "Buono - Usura minima", "undersideFair": "Discreto - Necessarie alcune riparazioni", "undersidePoor": "Scarso - Necessari lavori importanti" },
    "parts": { "partNumber": "Codice ricambio", "partNumberPlaceholder": "es. AHH5594", "oemOrAftermarket": "OEM / Aftermarket", "oemGenuine": "OEM / Originale", "aftermarket": "Aftermarket", "reproduction": "Riproduzione", "quantityAvailable": "Quantità disponibile", "fitsModels": "Modelli compatibili", "fitsModelsPlaceholder": "es. Mk1, Mk2, Cooper S (separati da virgole)" },
    "engineCategory": { "intro": "Tutti i dettagli necessari sono coperti nel campo descrizione. Assicurati di includere:", "sizeType": "Cilindrata e tipo di motore", "rebuilds": "Eventuali revisioni o modifiche", "donorVehicle": "Da quale veicolo proviene", "runningCondition": "Condizioni di funzionamento", "included": "Cosa è incluso (carburatore, collettore, ecc.)" },
    "shipping": { "section": "Spedizione", "available": "Spedizione disponibile", "shipsTo": "Spedisce a", "domesticOnly": "Solo nazionale", "international": "Internazionale", "pickupOnlyNotice": "L'annuncio sarà mostrato come \"Solo ritiro\"" },
    "nav": { "back": "Indietro", "saveDraft": "Salva bozza", "continueToReview": "Continua alla revisione" }
  },
  "pt": {
    "banner": { "title": "Anúncios completos vendem mais rápido!", "body": "Anúncios com especificações detalhadas, informações de procedência e detalhes de modificações recebem 3x mais visualizações e vendem 40 % mais rápido em média." },
    "common": { "select": "Selecionar...", "unknown": "Desconhecido", "other": "Outro" },
    "heritage": { "section": "História e procedência", "vin": "Número de chassi / VIN", "vinPlaceholder": "ex.: SAXXN...", "engineNumber": "Número do motor", "engineNumberPlaceholder": "ex.: 12H...", "buildDate": "Data de fabricação", "buildDatePlaceholder": "ex.: março de 1967 ou 15/06/1972", "originalColor": "Cor original", "originalColorPlaceholder": "ex.: Old English White", "previousOwners": "Proprietários anteriores", "previousOwnersPlaceholder": "ex.: 3", "restorationStatus": "Estado de restauração", "certificate": "Certificado de procedência", "hasCert": "Tenho um certificado de procedência BMIHT", "certNumberPlaceholder": "Número do certificado...", "matchingNumbers": "Números correspondentes", "matchingYes": "Sim - Números correspondentes", "matchingNo": "Não - Os números não correspondem", "serviceHistory": "Histórico de manutenção", "serviceYes": "Sim - Histórico completo ou parcial", "serviceNo": "Sem histórico de manutenção", "restorationDetails": "Detalhes da restauração", "restorationDetailsPlaceholder": "Descreva os trabalhos de restauração, quando foram feitos e por quem..." },
    "engine": { "section": "Motor e mecânica", "engineSize": "Cilindrada", "gearboxType": "Tipo de câmbio", "gearboxMagicWand": "Magic Wand (remoto)", "gearbox3Synchro": "Remoto 3 sincros", "gearbox4Synchro": "Remoto 4 sincros", "gearboxRodChange": "Rod Change", "gearboxAutomatic": "Automático", "carbType": "Tipo de carburador", "carbSingleSu": "SU simples", "carbTwinSu": "SU duplo", "carbWeber": "Weber", "carbStromberg": "Stromberg", "carbFuelInjection": "Injeção eletrônica", "brakeType": "Tipo de freios", "brakeDrums": "Tambores nas quatro rodas", "brakeFrontDisc": "Disco dianteiro / Tambor traseiro", "brakeFourWheelDisc": "Discos nas quatro rodas" },
    "exterior": { "section": "Exterior e carroceria", "roofColor": "Cor do teto", "roofColorPlaceholder": "ex.: preto, branco, cor da carroceria", "wheelType": "Tipo de roda", "wheelStandard": "Aço padrão", "wheelMinilite": "Minilite", "wheelCooperS": "Cooper S", "wheelRevolution": "Revolution", "wheelRosePetal": "Rose Petal", "windowType": "Tipo de vidro", "windowSliding": "Vidros corrediços", "windowWindUp": "Vidros de manivela", "additionalFeatures": "Características adicionais", "racingStripes": "Faixas esportivas", "sunroof": "Teto solar" },
    "mods": { "section": "Modificações e estado", "engineMods": "Modificações do motor", "engineModsPlaceholder": "ex.: kit big bore, cabeçote trabalhado, comando esportivo...", "suspensionMods": "Modificações da suspensão", "suspensionModsPlaceholder": "ex.: rebaixada, plataforma ajustável, molas reforçadas...", "rustCondition": "Estado da ferrugem", "rustNone": "Nenhuma visível", "rustMinor": "Ferrugem superficial leve", "rustModerate": "Moderada - Necessita alguns reparos", "rustSignificant": "Significativa - Necessita reparo importante", "undersideCondition": "Estado do assoalho", "undersideExcellent": "Excelente - Sem problemas", "undersideGood": "Bom - Desgaste leve", "undersideFair": "Razoável - Necessita alguns reparos", "undersidePoor": "Ruim - Necessita trabalho importante" },
    "parts": { "partNumber": "Número da peça", "partNumberPlaceholder": "ex.: AHH5594", "oemOrAftermarket": "OEM / Aftermarket", "oemGenuine": "OEM / Genuína", "aftermarket": "Aftermarket", "reproduction": "Reprodução", "quantityAvailable": "Quantidade disponível", "fitsModels": "Modelos compatíveis", "fitsModelsPlaceholder": "ex.: Mk1, Mk2, Cooper S (separados por vírgulas)" },
    "engineCategory": { "intro": "Todos os detalhes necessários são cobertos no campo de descrição. Certifique-se de incluir:", "sizeType": "Cilindrada e tipo de motor", "rebuilds": "Quaisquer reconstruções ou modificações", "donorVehicle": "De qual veículo veio", "runningCondition": "Estado de funcionamento", "included": "O que está incluído (carburador, coletor, etc.)" },
    "shipping": { "section": "Envio", "available": "Envio disponível", "shipsTo": "Envia para", "domesticOnly": "Apenas nacional", "international": "Internacional", "pickupOnlyNotice": "O anúncio será exibido como \"Apenas retirada\"" },
    "nav": { "back": "Voltar", "saveDraft": "Salvar rascunho", "continueToReview": "Continuar para revisão" }
  },
  "ru": {
    "banner": { "title": "Полные объявления продаются быстрее!", "body": "Объявления с подробными характеристиками, сведениями о происхождении и деталями модификаций получают в 3 раза больше просмотров и продаются в среднем на 40 % быстрее." },
    "common": { "select": "Выбрать...", "unknown": "Неизвестно", "other": "Другое" },
    "heritage": { "section": "История и происхождение", "vin": "Номер шасси / VIN", "vinPlaceholder": "напр., SAXXN...", "engineNumber": "Номер двигателя", "engineNumberPlaceholder": "напр., 12H...", "buildDate": "Дата выпуска", "buildDatePlaceholder": "напр., март 1967 или 15.06.1972", "originalColor": "Оригинальный цвет", "originalColorPlaceholder": "напр., Old English White", "previousOwners": "Предыдущие владельцы", "previousOwnersPlaceholder": "напр., 3", "restorationStatus": "Статус реставрации", "certificate": "Сертификат происхождения", "hasCert": "У меня есть сертификат происхождения BMIHT", "certNumberPlaceholder": "Номер сертификата...", "matchingNumbers": "Совпадающие номера", "matchingYes": "Да - Номера совпадают", "matchingNo": "Нет - Номера не совпадают", "serviceHistory": "История обслуживания", "serviceYes": "Да - Полная или частичная история", "serviceNo": "Истории обслуживания нет", "restorationDetails": "Детали реставрации", "restorationDetailsPlaceholder": "Опишите любые реставрационные работы, когда и кем они были выполнены..." },
    "engine": { "section": "Двигатель и механика", "engineSize": "Объём двигателя", "gearboxType": "Тип коробки передач", "gearboxMagicWand": "Magic Wand (выносная)", "gearbox3Synchro": "Выносная, 3 синхро", "gearbox4Synchro": "Выносная, 4 синхро", "gearboxRodChange": "Rod Change", "gearboxAutomatic": "Автоматическая", "carbType": "Тип карбюратора", "carbSingleSu": "Одинарный SU", "carbTwinSu": "Двойной SU", "carbWeber": "Weber", "carbStromberg": "Stromberg", "carbFuelInjection": "Впрыск топлива", "brakeType": "Тип тормозов", "brakeDrums": "Барабанные по кругу", "brakeFrontDisc": "Диск спереди / барабан сзади", "brakeFourWheelDisc": "Дисковые по кругу" },
    "exterior": { "section": "Кузов и экстерьер", "roofColor": "Цвет крыши", "roofColorPlaceholder": "напр., чёрный, белый, цвет кузова", "wheelType": "Тип дисков", "wheelStandard": "Стандартные стальные", "wheelMinilite": "Minilite", "wheelCooperS": "Cooper S", "wheelRevolution": "Revolution", "wheelRosePetal": "Rose Petal", "windowType": "Тип окон", "windowSliding": "Сдвижные окна", "windowWindUp": "Подъёмные окна", "additionalFeatures": "Дополнительные особенности", "racingStripes": "Гоночные полосы", "sunroof": "Люк" },
    "mods": { "section": "Модификации и состояние", "engineMods": "Модификации двигателя", "engineModsPlaceholder": "напр., расточка, доработанная головка, спортивный распредвал...", "suspensionMods": "Модификации подвески", "suspensionModsPlaceholder": "напр., занижена, регулируемая платформа, усиленные пружины...", "rustCondition": "Состояние коррозии", "rustNone": "Не видна", "rustMinor": "Незначительная поверхностная коррозия", "rustModerate": "Умеренная - требуется ремонт", "rustSignificant": "Значительная - требуется серьёзный ремонт", "undersideCondition": "Состояние днища", "undersideExcellent": "Отличное - без проблем", "undersideGood": "Хорошее - незначительный износ", "undersideFair": "Удовлетворительное - требуется ремонт", "undersidePoor": "Плохое - требуется серьёзная работа" },
    "parts": { "partNumber": "Номер детали", "partNumberPlaceholder": "напр., AHH5594", "oemOrAftermarket": "OEM / Неоригинальная", "oemGenuine": "OEM / Оригинальная", "aftermarket": "Неоригинальная", "reproduction": "Реплика", "quantityAvailable": "Доступное количество", "fitsModels": "Подходит для моделей", "fitsModelsPlaceholder": "напр., Mk1, Mk2, Cooper S (через запятую)" },
    "engineCategory": { "intro": "Все необходимые детали указываются в поле описания. Обязательно укажите:", "sizeType": "Объём и тип двигателя", "rebuilds": "Любые ремонты или модификации", "donorVehicle": "С какого автомобиля снят", "runningCondition": "Рабочее состояние", "included": "Что входит в комплект (карбюратор, коллектор и т. д.)" },
    "shipping": { "section": "Доставка", "available": "Доставка доступна", "shipsTo": "Доставка в", "domesticOnly": "Только по стране", "international": "Международная", "pickupOnlyNotice": "Объявление будет отображаться как \"Только самовывоз\"" },
    "nav": { "back": "Назад", "saveDraft": "Сохранить черновик", "continueToReview": "Перейти к проверке" }
  },
  "ja": {
    "banner": { "title": "詳しい出品ほど早く売れます！", "body": "詳細な仕様、来歴情報、改造内容を記載した出品は閲覧数が3倍になり、平均40%早く売れます。" },
    "common": { "select": "選択...", "unknown": "不明", "other": "その他" },
    "heritage": { "section": "来歴・由来", "vin": "車台番号 / VIN", "vinPlaceholder": "例: SAXXN...", "engineNumber": "エンジン番号", "engineNumberPlaceholder": "例: 12H...", "buildDate": "製造日", "buildDatePlaceholder": "例: 1967年3月 または 1972/06/15", "originalColor": "オリジナルカラー", "originalColorPlaceholder": "例: Old English White", "previousOwners": "前オーナー数", "previousOwnersPlaceholder": "例: 3", "restorationStatus": "レストア状況", "certificate": "ヘリテージ証明書", "hasCert": "BMIHTヘリテージ証明書を所有しています", "certNumberPlaceholder": "証明書番号...", "matchingNumbers": "マッチングナンバー", "matchingYes": "はい - マッチングナンバー", "matchingNo": "いいえ - 番号が一致しない", "serviceHistory": "整備履歴", "serviceYes": "はい - 全部または一部の履歴あり", "serviceNo": "整備履歴なし", "restorationDetails": "レストア内容", "restorationDetailsPlaceholder": "レストア作業の内容、実施時期、実施者などを記入してください..." },
    "engine": { "section": "エンジン・機関", "engineSize": "排気量", "gearboxType": "ギアボックスの種類", "gearboxMagicWand": "マジックワンド（リモート）", "gearbox3Synchro": "3シンクロ・リモート", "gearbox4Synchro": "4シンクロ・リモート", "gearboxRodChange": "ロッドチェンジ", "gearboxAutomatic": "オートマチック", "carbType": "キャブレターの種類", "carbSingleSu": "シングルSU", "carbTwinSu": "ツインSU", "carbWeber": "ウェーバー", "carbStromberg": "ストロンバーグ", "carbFuelInjection": "燃料噴射", "brakeType": "ブレーキの種類", "brakeDrums": "4輪ドラム", "brakeFrontDisc": "前ディスク / 後ドラム", "brakeFourWheelDisc": "4輪ディスク" },
    "exterior": { "section": "外装・ボディ", "roofColor": "ルーフの色", "roofColorPlaceholder": "例: 黒、白、ボディ同色", "wheelType": "ホイールの種類", "wheelStandard": "標準スチール", "wheelMinilite": "ミニライト", "wheelCooperS": "クーパーS", "wheelRevolution": "レボリューション", "wheelRosePetal": "ローズペタル", "windowType": "ウィンドウの種類", "windowSliding": "スライドウィンドウ", "windowWindUp": "巻き上げウィンドウ", "additionalFeatures": "追加機能", "racingStripes": "レーシングストライプ", "sunroof": "サンルーフ" },
    "mods": { "section": "改造・状態", "engineMods": "エンジン改造", "engineModsPlaceholder": "例: ビッグボアキット、ポート加工ヘッド、ハイカム...", "suspensionMods": "サスペンション改造", "suspensionModsPlaceholder": "例: ローダウン、車高調、強化スプリング...", "rustCondition": "サビの状態", "rustNone": "目立つサビなし", "rustMinor": "軽度の表面サビ", "rustModerate": "中程度 - 一部修理が必要", "rustSignificant": "重度 - 大規模な修理が必要", "undersideCondition": "下回りの状態", "undersideExcellent": "極上 - 問題なし", "undersideGood": "良好 - 軽微な摩耗", "undersideFair": "普通 - 一部修理が必要", "undersidePoor": "不良 - 大規模な作業が必要" },
    "parts": { "partNumber": "部品番号", "partNumberPlaceholder": "例: AHH5594", "oemOrAftermarket": "OEM / 社外品", "oemGenuine": "OEM / 純正", "aftermarket": "社外品", "reproduction": "リプロダクション", "quantityAvailable": "在庫数", "fitsModels": "適合モデル", "fitsModelsPlaceholder": "例: Mk1, Mk2, Cooper S（カンマ区切り）" },
    "engineCategory": { "intro": "必要な詳細はすべて説明欄でカバーされます。以下を必ず記載してください：", "sizeType": "排気量とエンジンタイプ", "rebuilds": "オーバーホールや改造の有無", "donorVehicle": "どの車両から取り外したか", "runningCondition": "稼働状態", "included": "付属品（キャブ、マニホールドなど）" },
    "shipping": { "section": "配送", "available": "配送可能", "shipsTo": "配送先", "domesticOnly": "国内のみ", "international": "海外対応", "pickupOnlyNotice": "出品は「引き取りのみ」と表示されます" },
    "nav": { "back": "戻る", "saveDraft": "下書きを保存", "continueToReview": "確認へ進む" }
  },
  "zh": {
    "banner": { "title": "信息完整的刊登卖得更快！", "body": "包含详细规格、来历信息和改装细节的刊登平均获得 3 倍的浏览量，并且成交速度快 40%。" },
    "common": { "select": "请选择...", "unknown": "未知", "other": "其他" },
    "heritage": { "section": "来历与出处", "vin": "车架号 / VIN", "vinPlaceholder": "例如：SAXXN...", "engineNumber": "发动机号", "engineNumberPlaceholder": "例如：12H...", "buildDate": "出厂日期", "buildDatePlaceholder": "例如：1967 年 3 月 或 1972/06/15", "originalColor": "原厂颜色", "originalColorPlaceholder": "例如：Old English White", "previousOwners": "前任车主数", "previousOwnersPlaceholder": "例如：3", "restorationStatus": "修复状态", "certificate": "来历证书", "hasCert": "我持有 BMIHT 来历证书", "certNumberPlaceholder": "证书编号...", "matchingNumbers": "号码匹配", "matchingYes": "是 - 号码匹配", "matchingNo": "否 - 号码不匹配", "serviceHistory": "保养记录", "serviceYes": "是 - 完整或部分记录", "serviceNo": "无保养记录", "restorationDetails": "修复详情", "restorationDetailsPlaceholder": "请描述任何修复工作、完成时间以及由谁完成..." },
    "engine": { "section": "发动机与机械", "engineSize": "排量", "gearboxType": "变速箱类型", "gearboxMagicWand": "Magic Wand（远程换挡）", "gearbox3Synchro": "3 同步远程", "gearbox4Synchro": "4 同步远程", "gearboxRodChange": "Rod Change", "gearboxAutomatic": "自动", "carbType": "化油器类型", "carbSingleSu": "单 SU", "carbTwinSu": "双 SU", "carbWeber": "Weber", "carbStromberg": "Stromberg", "carbFuelInjection": "燃油喷射", "brakeType": "制动器类型", "brakeDrums": "四轮鼓刹", "brakeFrontDisc": "前盘 / 后鼓", "brakeFourWheelDisc": "四轮盘刹" },
    "exterior": { "section": "外观与车身", "roofColor": "车顶颜色", "roofColorPlaceholder": "例如：黑色、白色、车身同色", "wheelType": "轮毂类型", "wheelStandard": "标准钢轮", "wheelMinilite": "Minilite", "wheelCooperS": "Cooper S", "wheelRevolution": "Revolution", "wheelRosePetal": "Rose Petal", "windowType": "车窗类型", "windowSliding": "推拉窗", "windowWindUp": "升降窗", "additionalFeatures": "附加配置", "racingStripes": "赛车条纹", "sunroof": "天窗" },
    "mods": { "section": "改装与状况", "engineMods": "发动机改装", "engineModsPlaceholder": "例如：缸径加大套件、气道加工缸盖、高性能凸轮轴...", "suspensionMods": "悬挂改装", "suspensionModsPlaceholder": "例如：降低、可调平台、加强弹簧...", "rustCondition": "锈蚀状况", "rustNone": "无可见锈蚀", "rustMinor": "轻微表面锈蚀", "rustModerate": "中度 - 需部分修复", "rustSignificant": "严重 - 需大修", "undersideCondition": "底盘状况", "undersideExcellent": "极佳 - 无问题", "undersideGood": "良好 - 轻微磨损", "undersideFair": "一般 - 需部分修复", "undersidePoor": "较差 - 需大量修复" },
    "parts": { "partNumber": "零件号", "partNumberPlaceholder": "例如：AHH5594", "oemOrAftermarket": "原厂 / 副厂", "oemGenuine": "原厂 / 正品", "aftermarket": "副厂", "reproduction": "复刻件", "quantityAvailable": "可售数量", "fitsModels": "适配车型", "fitsModelsPlaceholder": "例如：Mk1, Mk2, Cooper S（用逗号分隔）" },
    "engineCategory": { "intro": "所有需要的细节都在描述栏中说明。请务必包含：", "sizeType": "排量与发动机类型", "rebuilds": "任何翻新或改装", "donorVehicle": "来自哪辆车", "runningCondition": "运行状况", "included": "包含的物品（化油器、歧管等）" },
    "shipping": { "section": "运输", "available": "可运输", "shipsTo": "运送至", "domesticOnly": "仅限国内", "international": "国际", "pickupOnlyNotice": "刊登将显示为\"仅限自取\"" },
    "nav": { "back": "返回", "saveDraft": "保存草稿", "continueToReview": "继续到审核" }
  },
  "ko": {
    "banner": { "title": "정보가 완전한 매물이 더 빨리 팔립니다!", "body": "상세 사양, 내력 정보, 개조 내역이 포함된 매물은 조회수가 3배 많고 평균 40% 더 빨리 판매됩니다." },
    "common": { "select": "선택...", "unknown": "알 수 없음", "other": "기타" },
    "heritage": { "section": "내력 및 출처", "vin": "차대번호 / VIN", "vinPlaceholder": "예: SAXXN...", "engineNumber": "엔진 번호", "engineNumberPlaceholder": "예: 12H...", "buildDate": "제작일", "buildDatePlaceholder": "예: 1967년 3월 또는 1972/06/15", "originalColor": "원래 색상", "originalColorPlaceholder": "예: Old English White", "previousOwners": "이전 소유자 수", "previousOwnersPlaceholder": "예: 3", "restorationStatus": "복원 상태", "certificate": "내력 인증서", "hasCert": "BMIHT 내력 인증서를 보유하고 있습니다", "certNumberPlaceholder": "인증서 번호...", "matchingNumbers": "넘버 일치", "matchingYes": "예 - 넘버 일치", "matchingNo": "아니요 - 넘버 불일치", "serviceHistory": "정비 이력", "serviceYes": "예 - 전체 또는 일부 이력", "serviceNo": "정비 이력 없음", "restorationDetails": "복원 상세", "restorationDetailsPlaceholder": "복원 작업 내용, 시기, 작업자 등을 설명해 주세요..." },
    "engine": { "section": "엔진 및 기계", "engineSize": "배기량", "gearboxType": "변속기 종류", "gearboxMagicWand": "매직 완드 (리모트)", "gearbox3Synchro": "3싱크로 리모트", "gearbox4Synchro": "4싱크로 리모트", "gearboxRodChange": "로드 체인지", "gearboxAutomatic": "자동", "carbType": "기화기 종류", "carbSingleSu": "싱글 SU", "carbTwinSu": "트윈 SU", "carbWeber": "웨버", "carbStromberg": "스트롬버그", "carbFuelInjection": "연료 분사", "brakeType": "브레이크 종류", "brakeDrums": "4륜 드럼", "brakeFrontDisc": "전륜 디스크 / 후륜 드럼", "brakeFourWheelDisc": "4륜 디스크" },
    "exterior": { "section": "외관 및 차체", "roofColor": "지붕 색상", "roofColorPlaceholder": "예: 검정, 흰색, 차체 동일색", "wheelType": "휠 종류", "wheelStandard": "표준 스틸", "wheelMinilite": "미니라이트", "wheelCooperS": "쿠퍼 S", "wheelRevolution": "레볼루션", "wheelRosePetal": "로즈 페탈", "windowType": "창문 종류", "windowSliding": "슬라이딩 창", "windowWindUp": "수동 창", "additionalFeatures": "추가 기능", "racingStripes": "레이싱 스트라이프", "sunroof": "선루프" },
    "mods": { "section": "개조 및 상태", "engineMods": "엔진 개조", "engineModsPlaceholder": "예: 빅 보어 키트, 포트 가공 헤드, 고성능 캠...", "suspensionMods": "서스펜션 개조", "suspensionModsPlaceholder": "예: 차고 낮춤, 조절식 플랫폼, 강화 스프링...", "rustCondition": "부식 상태", "rustNone": "보이는 부식 없음", "rustMinor": "경미한 표면 부식", "rustModerate": "보통 - 일부 수리 필요", "rustSignificant": "심각 - 대규모 수리 필요", "undersideCondition": "하부 상태", "undersideExcellent": "우수 - 문제 없음", "undersideGood": "양호 - 경미한 마모", "undersideFair": "보통 - 일부 수리 필요", "undersidePoor": "불량 - 대규모 작업 필요" },
    "parts": { "partNumber": "부품 번호", "partNumberPlaceholder": "예: AHH5594", "oemOrAftermarket": "OEM / 애프터마켓", "oemGenuine": "OEM / 정품", "aftermarket": "애프터마켓", "reproduction": "재생산품", "quantityAvailable": "재고 수량", "fitsModels": "호환 모델", "fitsModelsPlaceholder": "예: Mk1, Mk2, Cooper S (쉼표로 구분)" },
    "engineCategory": { "intro": "필요한 모든 정보는 설명란에서 다룹니다. 다음을 반드시 포함하세요:", "sizeType": "배기량 및 엔진 종류", "rebuilds": "오버홀 또는 개조 여부", "donorVehicle": "어떤 차량에서 탈거했는지", "runningCondition": "작동 상태", "included": "포함 품목 (기화기, 매니폴드 등)" },
    "shipping": { "section": "배송", "available": "배송 가능", "shipsTo": "배송 지역", "domesticOnly": "국내만", "international": "해외", "pickupOnlyNotice": "매물은 \"직접 수령만 가능\"으로 표시됩니다" },
    "nav": { "back": "뒤로", "saveDraft": "임시저장", "continueToReview": "검토로 계속" }
  }
}
</i18n>
