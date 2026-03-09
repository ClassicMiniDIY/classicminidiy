<script lang="ts" setup>
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';
  import { chassisRanges } from '../../../data/models/decoders';

  const { capture } = usePostHog();

  interface ChassisPosition {
    position: number;
    value: string;
    name: string;
    matched: boolean;
  }

  interface ChassisDecoderResponse {
    success: boolean;
    yearRange: string;
    chassisNumber: string;
    decodedPositions: ChassisPosition[];
    isValid: boolean;
    errors: string[];
    pattern: string;
    rangeData: any;
  }

  const chassisNumber = ref('');
  const yearRange = ref('1959-1969');
  const isLoading = ref(false);
  const decodedResult = ref<ChassisDecoderResponse | null>(null);
  const errorMessage = ref('');

  // Template ref for smooth scrolling to results
  const decodedResultsSection = ref<HTMLElement>();

  const yearRangeOptions = ['1959-1969', '1969-1974', '1974-1980', '1980', '1980-1985', '1985-1990', '1990-on'];

  // Get example chassis number for selected year range
  const exampleChassisNumber = computed(() => {
    const selectedRange = chassisRanges.find((range) => range.title === yearRange.value);
    if (!selectedRange) return '';

    const example = selectedRange.value.PrimaryExample;
    let exampleString = '';

    // Build example from positions 1-11
    for (let i = 1; i <= 11; i++) {
      const key = i.toString() as keyof typeof example;
      if (example[key]) {
        exampleString += example[key];
      }
    }

    // Add numbers and last if they exist
    if (example.numbers) {
      exampleString += example.numbers;
    }
    if (example.last) {
      exampleString += example.last;
    }

    return exampleString;
  });

  async function decodeChassisNumber() {
    if (!chassisNumber.value.trim()) {
      errorMessage.value = $t('form.error_empty_chassis');
      return;
    }

    isLoading.value = true;
    errorMessage.value = '';
    decodedResult.value = null;

    try {
      const response = await $fetch<ChassisDecoderResponse>('/api/decoders/chassis', {
        method: 'PUT',
        body: {
          yearRange: yearRange.value,
          chassisNumber: chassisNumber.value,
        },
      });

      decodedResult.value = response;

      capture('decoder_used', {
        decoder: 'chassis',
        year_range: yearRange.value,
        is_valid: !!response,
      });

      // Smooth scroll to decoded results section
      await nextTick(); // Wait for DOM to update
      if (decodedResultsSection.value) {
        decodedResultsSection.value.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    } catch (error: any) {
      console.error('Error decoding chassis number:', error);
      errorMessage.value = error?.data?.statusMessage || $t('form.error_decode_failed');
    } finally {
      isLoading.value = false;
    }
  }

  function resetForm() {
    chassisNumber.value = '';
    yearRange.value = yearRangeOptions[0] || '';
    decodedResult.value = null;
    errorMessage.value = '';
  }

  function getPositionColorClass(position: number): string {
    if (position === 12) return 'position-numbers';
    if (position === 13) return 'position-last';
    return `position-${position}`;
  }

  useHead({
    title: $t('title'),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: $t('description'),
      },
      {
        key: 'keywords',
        name: 'keywords',
        content: $t('keywords'),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://classicminidiy.com/technical/chassis-decoder',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // WebApplication structured data for decoder tool
  const decoderJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Classic Mini Chassis Number Decoder',
    applicationCategory: 'AutomotiveApplication',
    operatingSystem: 'Web Browser',
    description: $t('description'),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(decoderJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('og_title'),
    ogDescription: $t('og_description'),
    ogUrl: 'https://classicminidiy.com/technical/chassis-decoder',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/chassis-decoder.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('twitter_title'),
    twitterDescription: $t('twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/chassis-decoder.png',
  });
</script>

<template>
  <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.TECH" />
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <breadcrumb class="my-6" :version="BREADCRUMB_VERSIONS.TECH" :page="$t('breadcrumb_title')"></breadcrumb>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div class="col-span-12 md:col-span-7">
            <h1 class="text-3xl font-bold mb-4">{{ $t('main_heading') }}</h1>
            <p class="mb-4">
              {{ $t('description_text') }}
            </p>
          </div>
          <div class="col-span-12 md:col-span-5">
            <NuxtLink :to="'/technical/engine-decoder'" :title="$t('engine_decoder_card.link_title')" class="block">
              <UCard class="hover:shadow-lg transition-shadow">
                <div class="flex items-start space-x-4">
                  <div class="shrink-0">
                    <figure class="w-16 h-16">
                      <picture>
                        <source
                          srcset="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-blueprint-zoom-100.webp"
                          type="image/webp"
                        />
                        <img
                          src="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-blueprint-zoom-100.png"
                          :alt="$t('engine_decoder_card.alt_text')"
                          class="w-full h-full object-cover rounded"
                        />
                      </picture>
                    </figure>
                  </div>
                  <div class="flex-1">
                    <h3 class="text-lg font-semibold">
                      {{ $t('engine_decoder_card.heading') }}
                    </h3>
                    <p class="mt-1">
                      {{ $t('engine_decoder_card.description') }}
                    </p>
                  </div>
                </div>
              </UCard>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Chassis Decoder Form -->
      <div class="col-span-12 md:col-span-8 md:col-start-3">
        <UCard>
          <div class="text-center">
            <h3 class="text-xl font-semibold mb-4">
              {{ $t('form.card_title') }}
            </h3>
            <p class="mb-6">
              {{ $t('form.card_description') }}
            </p>

            <div class="space-y-4 max-w-md mx-auto">
              <!-- Year Range Selection -->
              <UFormField :label="$t('form.year_range_label')">
                <USelect v-model="yearRange" :items="yearRangeOptions" class="w-full" />
              </UFormField>

              <!-- Chassis Number Input -->
              <UFormField :label="$t('form.chassis_number_label')">
                <UInput
                  v-model="chassisNumber"
                  type="text"
                  :placeholder="$t('form.chassis_number_placeholder')"
                  class="w-full"
                  @keyup.enter="decodeChassisNumber"
                />
                <!-- Example for selected year range -->
                <template #help>
                  <div v-if="exampleChassisNumber" class="text-sm opacity-70">
                    <span class="font-medium">{{ $t('form.example_text') }} {{ yearRange }}:</span>
                    <span class="font-mono ml-2 text-primary">{{ exampleChassisNumber }}</span>
                  </div>
                </template>
              </UFormField>

              <!-- Action Buttons -->
              <div class="flex gap-3 justify-center">
                <UButton
                  @click="decodeChassisNumber"
                  :disabled="isLoading || !chassisNumber.trim()"
                  :loading="isLoading"
                  color="primary"
                >
                  {{ isLoading ? $t('form.decoding_button') : $t('form.decode_button') }}
                </UButton>
                <UButton @click="resetForm" variant="ghost">
                  {{ $t('form.reset_button') }}
                </UButton>
              </div>

              <!-- Error Message -->
              <UAlert v-if="errorMessage" color="error" :title="errorMessage" />
            </div>
          </div>
        </UCard>
      </div>

      <!-- Decoded Results -->
      <div v-if="decodedResult" ref="decodedResultsSection" class="col-span-12 md:col-span-10 md:col-start-2">
        <UCard>
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-semibold">
              {{ $t('results.title') }}
            </h3>
            <div>
              <UBadge v-if="decodedResult.isValid" color="success">{{ $t('results.status_decoded') }}</UBadge>
              <UBadge v-else color="error">{{ $t('results.status_invalid') }}</UBadge>
            </div>
          </div>
          <!-- Summary -->
          <div class="mb-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div class="p-4 bg-muted rounded-lg">
                <div class="text-sm opacity-70">
                  {{ $t('results.year_range_stat') }}
                </div>
                <div class="text-lg font-bold">{{ decodedResult.yearRange }}</div>
              </div>
              <div class="p-4 bg-muted rounded-lg">
                <div class="text-sm opacity-70">
                  {{ $t('results.chassis_number_stat') }}
                </div>
                <div class="text-xl font-mono mt-1">
                  <UBadge color="secondary" size="lg">{{ decodedResult.chassisNumber }}</UBadge>
                </div>
              </div>
              <div class="p-4 bg-muted rounded-lg">
                <div class="text-sm opacity-70">
                  {{ $t('results.expected_pattern_stat') }}
                </div>
                <div class="text-lg font-mono font-bold">{{ decodedResult.pattern }}</div>
              </div>
            </div>
          </div>

          <!-- Validation Errors -->
          <div v-if="decodedResult.errors.length > 0" class="mb-6">
            <h4 class="text-lg font-semibold mb-3">
              {{ $t('results.validation_issues_title') }}
            </h4>
            <div class="space-y-2">
              <UAlert v-for="error in decodedResult.errors" :key="error" color="warning" :title="error" />
            </div>
          </div>

          <!-- Decoded Positions -->
          <div>
            <h4 class="text-lg font-semibold mb-4">
              {{ $t('results.decoded_positions_title') }}
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="position in decodedResult.decodedPositions"
                :key="position.position"
                class="flex items-start space-x-3 p-3 rounded-lg"
                :class="position.matched ? 'bg-success/10' : 'bg-error/10'"
              >
                <span class="position text-lg mt-0.5" :class="getPositionColorClass(position.position)"> ● </span>
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">
                      {{ $t('results.position_label') }}
                      {{ position.position }}: <strong>{{ position.value }}</strong>
                    </span>
                    <UBadge v-if="position.matched" color="success" size="sm">✓</UBadge>
                    <UBadge v-else color="error" size="sm">✗</UBadge>
                  </div>
                  <div class="text-md font-semibold mt-1">{{ position.name }}</div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Special Notes -->
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <UCard>
          <h3 class="text-2xl font-semibold mb-4">
            {{ $t('special_notes.title') }}
          </h3>
          <div class="space-y-4">
            <div>
              <h4 class="text-lg font-semibold mb-2">
                {{ $t('special_notes.build_number_title') }}
              </h4>
              <p>
                {{ $t('special_notes.build_number_text') }}
              </p>
            </div>
            <div>
              <h4 class="text-lg font-semibold mb-2">
                {{ $t('special_notes.assembly_plant_title') }}
              </h4>
              <p>
                {{ $t('special_notes.assembly_plant_text') }}
              </p>
            </div>
          </div>
        </UCard>
      </div>

      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <div class="text-center">
          <p>
            {{ $t('attribution.text') }}
            <strong>{{ $t('attribution.mini_mania') }}</strong>
            {{ $t('attribution.technical_articles') }}
            <a
              href="https://www.minimania.com/Mini_Chassis_VIN_and_Commission_Numbers__Part_I__Revised_"
              target="_blank"
              rel="noopener noreferrer"
              class="link link-primary"
            >
              {{ $t('attribution.link_text') }}</a
            >
          </p>
        </div>
      </div>

      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <USeparator :label="$t('ui.support_section')" />
      </div>

      <div class="col-span-12 md:col-span-10 md:col-start-2 pb-10">
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Tech - Mini Chassis Plate Decoder",
    "description": "Decode your Classic Mini's chassis plate to determine the model year, assembly plant, and sequential build number of the car. The chassis plate is also known as the VIN plate, VIN tag, or VIN plate depending on the generation.",
    "keywords": "chassis decoder, Classic Mini VIN, chassis plate, Mini Cooper VIN decoder, chassis number lookup, Mini identification, build number decoder",
    "hero_title": "Chassis Decoder",
    "breadcrumb_title": "Chassis Decoder",
    "og_title": "Tech - Mini Chassis Plate Decoder",
    "og_description": "Decode your Classic Mini's chassis plate to determine the model year, assembly plant, and sequential build number of the car. The chassis plate is also known as the VIN plate, VIN tag, or VIN plate depending on the generation.",
    "twitter_title": "Tech - Mini Chassis Plate Decoder",
    "twitter_description": "Decode your Classic Mini's chassis plate to determine the model year, assembly plant, and sequential build number of the car.",
    "main_heading": "Chassis Plate Decoder",
    "description_text": "The chassis plate is a series of numbers and letters that are stamped on a metal plate that is riveted to the body of the car. This plate is located in different places across all mini generations and is used to identify the model year, assembly plant, and sequential build number of the car. The chassis plate is also known as the VIN plate, VIN tag, or VIN plate depending on the generation.",
    "engine_decoder_card": {
      "link_title": "Link to Engine Plate decoder",
      "heading": "Engine Decoder",
      "description": "Click here to identify your engine using our new engine number decoding table.",
      "alt_text": "Engine Decoder"
    },
    "form": {
      "card_title": "Decode Your Chassis Number",
      "card_description": "Enter your chassis number and select the appropriate year range to decode all the details automatically.",
      "year_range_label": "Year Range",
      "chassis_number_label": "Chassis Number",
      "chassis_number_placeholder": "Enter your chassis number",
      "example_text": "Example for",
      "decode_button": "Decode Chassis",
      "decoding_button": "Decoding...",
      "reset_button": "Reset",
      "error_empty_chassis": "Please enter a chassis number",
      "error_decode_failed": "Failed to decode chassis number. Please try again."
    },
    "results": {
      "title": "Decoded Results",
      "status_decoded": "Decoded",
      "status_invalid": "Invalid",
      "year_range_stat": "Year Range",
      "chassis_number_stat": "Your Chassis Number",
      "expected_pattern_stat": "Expected Pattern",
      "validation_issues_title": "Validation Issues",
      "decoded_positions_title": "Decoded Positions",
      "position_label": "Position"
    },
    "special_notes": {
      "title": "Special Notes",
      "build_number_title": "Note about Build Number",
      "build_number_text": "The first car at Longbridge was number 101, as was the first at Cowley. From then on, each factory continued with their own number sequence regardless of the model; e.g., Saloon, Van, etc. In other words, each model did not start at 101 and maintain its own sequence. Saloons and Vans, etc., are mixed in the number sequence along with the Cooper and Cooper S models",
      "assembly_plant_title": "Note about Assembly Plant",
      "assembly_plant_text": "This seems to be used inconsistently on English-built cars, and it is understood that the car was built at the \"normal\" factory if the letter is left off; e.g., an Austin, Riley or Wolseley at Longbridge may or may not have an \"A\" after the sequence number. Yes, there were Austin Minis built at the Morris plant in Cowley and Morris Minis built at the Austin plant in Longbridge. Note that all English-built Cooper and Cooper S models (Austin and Morris) as well as Riley Elf and Wolseley Hornet models were built at the Longbridge, Austin plant"
    },
    "attribution": {
      "text": "Please note the above details were pulled from",
      "mini_mania": "Mini Mania's",
      "technical_articles": "technical articles. More Details can be found here:",
      "link_text": "Chassis Code Technical Articles"
    },
    "ui": {
      "support_section": "Support"
    }
  },
  "es": {
    "title": "Tech - Decodificador de Placa de Chasis Mini",
    "description": "Decodifica la placa de chasis de tu Classic Mini para determinar el año del modelo, planta de ensamblaje y número de construcción secuencial del auto. La placa de chasis también se conoce como placa VIN, etiqueta VIN o placa VIN dependiendo de la generación.",
    "keywords": "decodificador de chasis, VIN Classic Mini, placa de chasis, decodificador VIN Mini Cooper, búsqueda número de chasis, identificación Mini, decodificador número de construcción",
    "hero_title": "Decodificador de Chasis",
    "breadcrumb_title": "Decodificador de Chasis",
    "og_title": "Tech - Decodificador de Placa de Chasis Mini",
    "og_description": "Decodifica la placa de chasis de tu Classic Mini para determinar el año del modelo, planta de ensamblaje y número de construcción secuencial del auto. La placa de chasis también se conoce como placa VIN, etiqueta VIN o placa VIN dependiendo de la generación.",
    "twitter_title": "Tech - Decodificador de Placa de Chasis Mini",
    "twitter_description": "Decodifica la placa de chasis de tu Classic Mini para determinar el año del modelo, planta de ensamblaje y número de construcción secuencial del auto.",
    "main_heading": "Decodificador de Placa de Chasis",
    "description_text": "La placa de chasis es una serie de números y letras que están estampados en una placa metálica que está remachada al cuerpo del auto. Esta placa está ubicada en diferentes lugares en todas las generaciones de mini y se usa para identificar el año del modelo, planta de ensamblaje y número de construcción secuencial del auto. La placa de chasis también se conoce como placa VIN, etiqueta VIN o placa VIN dependiendo de la generación.",
    "engine_decoder_card": {
      "link_title": "Enlace al decodificador de placa de motor",
      "heading": "Decodificador de Motor",
      "description": "Haz clic aquí para identificar tu motor usando nuestra nueva tabla de decodificación de números de motor.",
      "alt_text": "Decodificador de Motor"
    },
    "form": {
      "card_title": "Decodifica Tu Número de Chasis",
      "card_description": "Ingresa tu número de chasis y selecciona el rango de años apropiado para decodificar todos los detalles automáticamente.",
      "year_range_label": "Rango de Años",
      "chassis_number_label": "Número de Chasis",
      "chassis_number_placeholder": "Ingresa tu número de chasis",
      "example_text": "Ejemplo para",
      "decode_button": "Decodificar Chasis",
      "decoding_button": "Decodificando...",
      "reset_button": "Reiniciar",
      "error_empty_chassis": "Por favor ingresa un número de chasis",
      "error_decode_failed": "Error al decodificar el número de chasis. Por favor intenta de nuevo."
    },
    "results": {
      "title": "Resultados Decodificados",
      "status_decoded": "Decodificado",
      "status_invalid": "Inválido",
      "year_range_stat": "Rango de Años",
      "chassis_number_stat": "Tu Número de Chasis",
      "expected_pattern_stat": "Patrón Esperado",
      "validation_issues_title": "Problemas de Validación",
      "decoded_positions_title": "Posiciones Decodificadas",
      "position_label": "Posición"
    },
    "special_notes": {
      "title": "Notas Especiales",
      "build_number_title": "Nota sobre el Número de Construcción",
      "build_number_text": "El primer auto en Longbridge fue el número 101, al igual que el primero en Cowley. A partir de entonces, cada fábrica continuó con su propia secuencia numérica independientemente del modelo; por ejemplo, Sedán, Furgoneta, etc. En otras palabras, cada modelo no comenzó en 101 y mantuvo su propia secuencia. Los Sedanes y Furgonetas, etc., están mezclados en la secuencia numérica junto con los modelos Cooper y Cooper S",
      "assembly_plant_title": "Nota sobre la Planta de Ensamblaje",
      "assembly_plant_text": "Esto parece usarse de manera inconsistente en los autos construidos en Inglaterra, y se entiende que el auto fue construido en la fábrica \"normal\" si se omite la letra; por ejemplo, un Austin, Riley o Wolseley en Longbridge puede o no tener una \"A\" después del número de secuencia. Sí, hubo Austin Minis construidos en la planta Morris en Cowley y Morris Minis construidos en la planta Austin en Longbridge. Nota que todos los modelos Cooper y Cooper S construidos en Inglaterra (Austin y Morris) así como los modelos Riley Elf y Wolseley Hornet fueron construidos en la planta Austin de Longbridge"
    },
    "attribution": {
      "text": "Por favor nota que los detalles anteriores fueron extraídos de",
      "mini_mania": "Mini Mania's",
      "technical_articles": "artículos técnicos. Más detalles se pueden encontrar aquí:",
      "link_text": "Artículos Técnicos de Códigos de Chasis"
    },
    "ui": {
      "support_section": "Soporte"
    }
  },
  "fr": {
    "title": "Tech - Décodeur de Plaque de Châssis Mini",
    "description": "Décodez la plaque de châssis de votre Classic Mini pour déterminer l'année modèle, l'usine d'assemblage et le numéro de construction séquentiel de la voiture. La plaque de châssis est également connue sous le nom de plaque VIN, étiquette VIN ou plaque VIN selon la génération.",
    "keywords": "décodeur de châssis, VIN Classic Mini, plaque de châssis, décodeur VIN Mini Cooper, recherche numéro de châssis, identification Mini, décodeur numéro de construction",
    "hero_title": "Décodeur de Châssis",
    "breadcrumb_title": "Décodeur de Châssis",
    "og_title": "Tech - Décodeur de Plaque de Châssis Mini",
    "og_description": "Décodez la plaque de châssis de votre Classic Mini pour déterminer l'année modèle, l'usine d'assemblage et le numéro de construction séquentiel de la voiture. La plaque de châssis est également connue sous le nom de plaque VIN, étiquette VIN ou plaque VIN selon la génération.",
    "twitter_title": "Tech - Décodeur de Plaque de Châssis Mini",
    "twitter_description": "Décodez la plaque de châssis de votre Classic Mini pour déterminer l'année modèle, l'usine d'assemblage et le numéro de construction séquentiel de la voiture.",
    "main_heading": "Décodeur de Plaque de Châssis",
    "description_text": "La plaque de châssis est une série de numéros et de lettres qui sont estampés sur une plaque métallique qui est rivetée au corps de la voiture. Cette plaque est située à différents endroits sur toutes les générations de mini et est utilisée pour identifier l'année modèle, l'usine d'assemblage et le numéro de construction séquentiel de la voiture. La plaque de châssis est également connue sous le nom de plaque VIN, étiquette VIN ou plaque VIN selon la génération.",
    "engine_decoder_card": {
      "link_title": "Lien vers le décodeur de plaque moteur",
      "heading": "Décodeur de Moteur",
      "description": "Cliquez ici pour identifier votre moteur en utilisant notre nouvelle table de décodage des numéros de moteur.",
      "alt_text": "Décodeur de Moteur"
    },
    "form": {
      "card_title": "Décodez Votre Numéro de Châssis",
      "card_description": "Entrez votre numéro de châssis et sélectionnez la plage d'années appropriée pour décoder automatiquement tous les détails.",
      "year_range_label": "Plage d'Années",
      "chassis_number_label": "Numéro de Châssis",
      "chassis_number_placeholder": "Entrez votre numéro de châssis",
      "example_text": "Exemple pour",
      "decode_button": "Décoder le Châssis",
      "decoding_button": "Décodage...",
      "reset_button": "Réinitialiser",
      "error_empty_chassis": "Veuillez entrer un numéro de châssis",
      "error_decode_failed": "Échec du décodage du numéro de châssis. Veuillez réessayer."
    },
    "results": {
      "title": "Résultats Décodés",
      "status_decoded": "Décodé",
      "status_invalid": "Invalide",
      "year_range_stat": "Plage d'Années",
      "chassis_number_stat": "Votre Numéro de Châssis",
      "expected_pattern_stat": "Modèle Attendu",
      "validation_issues_title": "Problèmes de Validation",
      "decoded_positions_title": "Positions Décodées",
      "position_label": "Position"
    },
    "special_notes": {
      "title": "Notes Spéciales",
      "build_number_title": "Note sur le Numéro de Construction",
      "build_number_text": "La première voiture à Longbridge était le numéro 101, tout comme la première à Cowley. À partir de là, chaque usine a continué avec sa propre séquence numérique indépendamment du modèle ; par exemple, Berline, Fourgonnette, etc. En d'autres termes, chaque modèle n'a pas commencé à 101 et maintenu sa propre séquence. Les Berlines et Fourgonnettes, etc., sont mélangées dans la séquence numérique avec les modèles Cooper et Cooper S",
      "assembly_plant_title": "Note sur l'Usine d'Assemblage",
      "assembly_plant_text": "Cela semble être utilisé de manière incohérente sur les voitures construites en Angleterre, et il est entendu que la voiture a été construite à l'usine \"normale\" si la lettre est omise ; par exemple, une Austin, Riley ou Wolseley à Longbridge peut ou peut ne pas avoir un \"A\" après le numéro de séquence. Oui, il y avait des Austin Minis construites à l'usine Morris de Cowley et des Morris Minis construites à l'usine Austin de Longbridge. Notez que tous les modèles Cooper et Cooper S construits en Angleterre (Austin et Morris) ainsi que les modèles Riley Elf et Wolseley Hornet ont été construits à l'usine Austin de Longbridge"
    },
    "attribution": {
      "text": "Veuillez noter que les détails ci-dessus ont été tirés de",
      "mini_mania": "Mini Mania's",
      "technical_articles": "articles techniques. Plus de détails peuvent être trouvés ici :",
      "link_text": "Articles Techniques des Codes de Châssis"
    },
    "ui": {
      "support_section": "Support"
    }
  },
  "it": {
    "title": "Tech - Decodificatore Piastra Telaio Mini",
    "description": "Decodifica la piastra del telaio della tua Classic Mini per determinare l'anno del modello, stabilimento di assemblaggio e numero di costruzione sequenziale dell'auto. La piastra del telaio è anche conosciuta come piastra VIN, etichetta VIN o piastra VIN a seconda della generazione.",
    "keywords": "decodificatore telaio, VIN Classic Mini, piastra telaio, decodificatore VIN Mini Cooper, ricerca numero telaio, identificazione Mini, decodificatore numero costruzione",
    "hero_title": "Decodificatore Telaio",
    "breadcrumb_title": "Decodificatore Telaio",
    "og_title": "Tech - Decodificatore Piastra Telaio Mini",
    "og_description": "Decodifica la piastra del telaio della tua Classic Mini per determinare l'anno del modello, stabilimento di assemblaggio e numero di costruzione sequenziale dell'auto.",
    "twitter_title": "Tech - Decodificatore Piastra Telaio Mini",
    "twitter_description": "Decodifica la piastra del telaio della tua Classic Mini per determinare l'anno del modello, stabilimento di assemblaggio e numero di costruzione sequenziale dell'auto.",
    "main_heading": "Decodificatore Piastra Telaio",
    "description_text": "La piastra del telaio è una serie di numeri e lettere che sono stampati su una piastra metallica che è rivettata al corpo dell'auto. Questa piastra si trova in luoghi diversi in tutte le generazioni di mini ed è utilizzata per identificare l'anno del modello, lo stabilimento di assemblaggio e il numero di costruzione sequenziale dell'auto. La piastra del telaio è anche conosciuta come piastra VIN, etichetta VIN o piastra VIN a seconda della generazione.",
    "engine_decoder_card": {
      "link_title": "Link al decodificatore piastra motore",
      "heading": "Decodificatore Motore",
      "description": "Clicca qui per identificare il tuo motore usando la nostra nuova tabella di decodifica dei numeri motore.",
      "alt_text": "Decodificatore Motore"
    },
    "form": {
      "card_title": "Decodifica il Tuo Numero di Telaio",
      "card_description": "Inserisci il tuo numero di telaio e seleziona l'intervallo di anni appropriato per decodificare automaticamente tutti i dettagli.",
      "year_range_label": "Intervallo Anni",
      "chassis_number_label": "Numero Telaio",
      "chassis_number_placeholder": "Inserisci il tuo numero di telaio",
      "example_text": "Esempio per",
      "decode_button": "Decodifica Telaio",
      "decoding_button": "Decodifica...",
      "reset_button": "Reimposta",
      "error_empty_chassis": "Inserisci un numero di telaio",
      "error_decode_failed": "Errore nella decodifica del numero di telaio. Riprova."
    },
    "results": {
      "title": "Risultati Decodificati",
      "status_decoded": "Decodificato",
      "status_invalid": "Non Valido",
      "year_range_stat": "Intervallo Anni",
      "chassis_number_stat": "Il Tuo Numero di Telaio",
      "expected_pattern_stat": "Schema Previsto",
      "validation_issues_title": "Problemi di Validazione",
      "decoded_positions_title": "Posizioni Decodificate",
      "position_label": "Posizione"
    },
    "special_notes": {
      "title": "Note Speciali",
      "build_number_title": "Nota sul Numero di Costruzione",
      "build_number_text": "La prima auto a Longbridge era il numero 101, così come la prima a Cowley. Da allora, ogni fabbrica ha continuato con la propria sequenza numerica indipendentemente dal modello; ad esempio, Berlina, Furgone, ecc. In altre parole, ogni modello non ha iniziato da 101 e mantenuto la propria sequenza. Berline e Furgoni, ecc., sono mescolati nella sequenza numerica insieme ai modelli Cooper e Cooper S",
      "assembly_plant_title": "Nota sullo Stabilimento di Assemblaggio",
      "assembly_plant_text": "Questo sembra essere usato in modo incoerente sulle auto costruite in Inghilterra, ed è inteso che l'auto è stata costruita nella fabbrica \"normale\" se la lettera è omessa; ad esempio, un'Austin, Riley o Wolseley a Longbridge può o non può avere una \"A\" dopo il numero di sequenza. Sì, c'erano Austin Mini costruite nello stabilimento Morris a Cowley e Morris Mini costruite nello stabilimento Austin a Longbridge. Nota che tutti i modelli Cooper e Cooper S costruiti in Inghilterra (Austin e Morris) così come i modelli Riley Elf e Wolseley Hornet sono stati costruiti nello stabilimento Austin di Longbridge"
    },
    "attribution": {
      "text": "Si prega di notare che i dettagli sopra sono stati presi da",
      "mini_mania": "Mini Mania's",
      "technical_articles": "articoli tecnici. Maggiori dettagli possono essere trovati qui:",
      "link_text": "Articoli Tecnici Codici Telaio"
    },
    "ui": {
      "support_section": "Supporto"
    }
  },
  "de": {
    "title": "Tech - Mini Fahrgestellplatte Decoder",
    "description": "Dekodieren Sie die Fahrgestellplatte Ihres Classic Mini, um das Modelljahr, Montagewerk und die sequenzielle Baunummer des Autos zu bestimmen. Die Fahrgestellplatte ist auch als VIN-Platte, VIN-Etikett oder VIN-Platte bekannt, je nach Generation.",
    "keywords": "Fahrgestell-Decoder, Classic Mini VIN, Fahrgestellplatte, Mini Cooper VIN-Decoder, Fahrgestellnummer-Suche, Mini-Identifikation, Baunummer-Decoder",
    "hero_title": "Fahrgestell-Decoder",
    "breadcrumb_title": "Fahrgestell-Decoder",
    "og_title": "Tech - Mini Fahrgestellplatte Decoder",
    "og_description": "Dekodieren Sie die Fahrgestellplatte Ihres Classic Mini, um das Modelljahr, Montagewerk und die sequenzielle Baunummer des Autos zu bestimmen.",
    "twitter_title": "Tech - Mini Fahrgestellplatte Decoder",
    "twitter_description": "Dekodieren Sie die Fahrgestellplatte Ihres Classic Mini, um das Modelljahr, Montagewerk und die sequenzielle Baunummer des Autos zu bestimmen.",
    "main_heading": "Fahrgestellplatte Decoder",
    "description_text": "Die Fahrgestellplatte ist eine Reihe von Zahlen und Buchstaben, die auf eine Metallplatte gestempelt sind, die an die Karosserie des Autos genietet ist. Diese Platte befindet sich an verschiedenen Stellen bei allen Mini-Generationen und wird verwendet, um das Modelljahr, das Montagewerk und die sequenzielle Baunummer des Autos zu identifizieren. Die Fahrgestellplatte ist auch als VIN-Platte, VIN-Etikett oder VIN-Platte bekannt, je nach Generation.",
    "engine_decoder_card": {
      "link_title": "Link zum Motorplatte Decoder",
      "heading": "Motor-Decoder",
      "description": "Klicken Sie hier, um Ihren Motor mit unserer neuen Motornummer-Dekodierungstabelle zu identifizieren.",
      "alt_text": "Motor-Decoder"
    },
    "form": {
      "card_title": "Dekodieren Sie Ihre Fahrgestellnummer",
      "card_description": "Geben Sie Ihre Fahrgestellnummer ein und wählen Sie den entsprechenden Jahresbereich aus, um alle Details automatisch zu dekodieren.",
      "year_range_label": "Jahresbereich",
      "chassis_number_label": "Fahrgestellnummer",
      "chassis_number_placeholder": "Geben Sie Ihre Fahrgestellnummer ein",
      "example_text": "Beispiel für",
      "decode_button": "Fahrgestell Dekodieren",
      "decoding_button": "Dekodierung...",
      "reset_button": "Zurücksetzen",
      "error_empty_chassis": "Bitte geben Sie eine Fahrgestellnummer ein",
      "error_decode_failed": "Fehler beim Dekodieren der Fahrgestellnummer. Bitte versuchen Sie es erneut."
    },
    "results": {
      "title": "Dekodierte Ergebnisse",
      "status_decoded": "Dekodiert",
      "status_invalid": "Ungültig",
      "year_range_stat": "Jahresbereich",
      "chassis_number_stat": "Ihre Fahrgestellnummer",
      "expected_pattern_stat": "Erwartetes Muster",
      "validation_issues_title": "Validierungsprobleme",
      "decoded_positions_title": "Dekodierte Positionen",
      "position_label": "Position"
    },
    "special_notes": {
      "title": "Besondere Hinweise",
      "build_number_title": "Hinweis zur Baunummer",
      "build_number_text": "Das erste Auto in Longbridge war Nummer 101, ebenso wie das erste in Cowley. Von da an setzte jedes Werk seine eigene Zahlenfolge unabhängig vom Modell fort; z.B. Limousine, Transporter, etc. Mit anderen Worten, jedes Modell begann nicht bei 101 und behielt seine eigene Sequenz bei. Limousinen und Transporter, etc., sind in der Zahlenfolge zusammen mit den Cooper und Cooper S Modellen gemischt",
      "assembly_plant_title": "Hinweis zum Montagewerk",
      "assembly_plant_text": "Dies scheint bei in England gebauten Autos inkonsistent verwendet zu werden, und es wird verstanden, dass das Auto im \"normalen\" Werk gebaut wurde, wenn der Buchstabe weggelassen wird; z.B. ein Austin, Riley oder Wolseley in Longbridge kann nach der Sequenznummer ein \"A\" haben oder auch nicht. Ja, es gab Austin Minis, die im Morris-Werk in Cowley gebaut wurden, und Morris Minis, die im Austin-Werk in Longbridge gebaut wurden. Beachten Sie, dass alle in England gebauten Cooper und Cooper S Modelle (Austin und Morris) sowie Riley Elf und Wolseley Hornet Modelle im Austin-Werk in Longbridge gebaut wurden"
    },
    "attribution": {
      "text": "Bitte beachten Sie, dass die obigen Details von",
      "mini_mania": "Mini Mania's",
      "technical_articles": "technischen Artikeln stammen. Weitere Details finden Sie hier:",
      "link_text": "Technische Artikel zu Fahrgestell-Codes"
    },
    "ui": {
      "support_section": "Support"
    }
  },
  "pt": {
    "title": "Tech - Decodificador de Placa de Chassi Mini",
    "description": "Decodifique a placa de chassi do seu Classic Mini para determinar o ano do modelo, fábrica de montagem e número de construção sequencial do carro. A placa de chassi também é conhecida como placa VIN, etiqueta VIN ou placa VIN dependendo da geração.",
    "keywords": "decodificador de chassi, VIN Classic Mini, placa de chassi, decodificador VIN Mini Cooper, pesquisa número de chassi, identificação Mini, decodificador número de construção",
    "hero_title": "Decodificador de Chassi",
    "breadcrumb_title": "Decodificador de Chassi",
    "og_title": "Tech - Decodificador de Placa de Chassi Mini",
    "og_description": "Decodifique a placa de chassi do seu Classic Mini para determinar o ano do modelo, fábrica de montagem e número de construção sequencial do carro. A placa de chassi também é conhecida como placa VIN, etiqueta VIN ou placa VIN dependendo da geração.",
    "twitter_title": "Tech - Decodificador de Placa de Chassi Mini",
    "twitter_description": "Decodifique a placa de chassi do seu Classic Mini para determinar o ano do modelo, fábrica de montagem e número de construção sequencial do carro.",
    "main_heading": "Decodificador de Placa de Chassi",
    "description_text": "A placa de chassi é uma série de números e letras estampados em uma placa metálica rebitada à carroceria do carro. Esta placa está localizada em diferentes lugares em todas as gerações de Mini e é usada para identificar o ano do modelo, a fábrica de montagem e o número de construção sequencial do carro. A placa de chassi também é conhecida como placa VIN, etiqueta VIN ou placa VIN dependendo da geração.",
    "engine_decoder_card": {
      "link_title": "Link para o decodificador de placa de motor",
      "heading": "Decodificador de Motor",
      "description": "Clique aqui para identificar o seu motor usando nossa nova tabela de decodificação de números de motor.",
      "alt_text": "Decodificador de Motor"
    },
    "form": {
      "card_title": "Decodifique Seu Número de Chassi",
      "card_description": "Insira o número do chassi e selecione o intervalo de anos apropriado para decodificar todos os detalhes automaticamente.",
      "year_range_label": "Intervalo de Anos",
      "chassis_number_label": "Número de Chassi",
      "chassis_number_placeholder": "Insira o número do seu chassi",
      "example_text": "Exemplo para",
      "decode_button": "Decodificar Chassi",
      "decoding_button": "Decodificando...",
      "reset_button": "Redefinir",
      "error_empty_chassis": "Por favor, insira um número de chassi",
      "error_decode_failed": "Falha ao decodificar o número de chassi. Por favor, tente novamente."
    },
    "results": {
      "title": "Resultados Decodificados",
      "status_decoded": "Decodificado",
      "status_invalid": "Inválido",
      "year_range_stat": "Intervalo de Anos",
      "chassis_number_stat": "Seu Número de Chassi",
      "expected_pattern_stat": "Padrão Esperado",
      "validation_issues_title": "Problemas de Validação",
      "decoded_positions_title": "Posições Decodificadas",
      "position_label": "Posição"
    },
    "special_notes": {
      "title": "Notas Especiais",
      "build_number_title": "Nota sobre o Número de Construção",
      "build_number_text": "O primeiro carro em Longbridge foi o número 101, assim como o primeiro em Cowley. A partir daí, cada fábrica continuou com sua própria sequência numérica independentemente do modelo; por exemplo, Sedan, Furgão, etc. Em outras palavras, cada modelo não começou no 101 e manteve sua própria sequência. Sedans e Furgões, etc., estão misturados na sequência numérica junto com os modelos Cooper e Cooper S.",
      "assembly_plant_title": "Nota sobre a Fábrica de Montagem",
      "assembly_plant_text": "Isso parece ser usado de forma inconsistente em carros fabricados na Inglaterra, e entende-se que o carro foi construído na fábrica \"normal\" se a letra for omitida; por exemplo, um Austin, Riley ou Wolseley em Longbridge pode ou não ter um \"A\" após o número de sequência. Sim, havia Austin Minis construídos na fábrica Morris em Cowley e Morris Minis construídos na fábrica Austin em Longbridge. Observe que todos os modelos Cooper e Cooper S fabricados na Inglaterra (Austin e Morris), bem como os modelos Riley Elf e Wolseley Hornet, foram construídos na fábrica Austin de Longbridge."
    },
    "attribution": {
      "text": "Observe que os detalhes acima foram retirados dos",
      "mini_mania": "Mini Mania's",
      "technical_articles": "artigos técnicos. Mais detalhes podem ser encontrados aqui:",
      "link_text": "Artigos Técnicos sobre Códigos de Chassi"
    },
    "ui": {
      "support_section": "Suporte"
    }
  },
  "ru": {
    "title": "Tech - Декодер таблички шасси Mini",
    "description": "Расшифруйте табличку шасси вашего Classic Mini, чтобы определить год выпуска модели, завод-изготовитель и порядковый номер сборки автомобиля. Табличка шасси также известна как табличка VIN, этикетка VIN или пластина VIN в зависимости от поколения.",
    "keywords": "декодер шасси, VIN Classic Mini, табличка шасси, декодер VIN Mini Cooper, поиск по номеру шасси, идентификация Mini, декодер номера сборки",
    "hero_title": "Декодер шасси",
    "breadcrumb_title": "Декодер шасси",
    "og_title": "Tech - Декодер таблички шасси Mini",
    "og_description": "Расшифруйте табличку шасси вашего Classic Mini, чтобы определить год выпуска модели, завод-изготовитель и порядковый номер сборки автомобиля. Табличка шасси также известна как табличка VIN, этикетка VIN или пластина VIN в зависимости от поколения.",
    "twitter_title": "Tech - Декодер таблички шасси Mini",
    "twitter_description": "Расшифруйте табличку шасси вашего Classic Mini, чтобы определить год выпуска модели, завод-изготовитель и порядковый номер сборки автомобиля.",
    "main_heading": "Декодер таблички шасси",
    "description_text": "Табличка шасси — это последовательность цифр и букв, нанесённых на металлическую пластину, заклёпанную к кузову автомобиля. Эта пластина расположена в разных местах в зависимости от поколения Mini и используется для определения года выпуска модели, завода-изготовителя и порядкового номера сборки. Табличка шасси также известна как табличка VIN, этикетка VIN или пластина VIN в зависимости от поколения.",
    "engine_decoder_card": {
      "link_title": "Ссылка на декодер таблички двигателя",
      "heading": "Декодер двигателя",
      "description": "Нажмите здесь, чтобы идентифицировать ваш двигатель с помощью нашей новой таблицы декодирования номеров двигателей.",
      "alt_text": "Декодер двигателя"
    },
    "form": {
      "card_title": "Декодируйте номер шасси",
      "card_description": "Введите номер шасси и выберите подходящий диапазон годов, чтобы автоматически декодировать все детали.",
      "year_range_label": "Диапазон годов",
      "chassis_number_label": "Номер шасси",
      "chassis_number_placeholder": "Введите номер шасси",
      "example_text": "Пример для",
      "decode_button": "Декодировать шасси",
      "decoding_button": "Декодирование...",
      "reset_button": "Сбросить",
      "error_empty_chassis": "Пожалуйста, введите номер шасси",
      "error_decode_failed": "Не удалось декодировать номер шасси. Пожалуйста, попробуйте снова."
    },
    "results": {
      "title": "Результаты декодирования",
      "status_decoded": "Декодировано",
      "status_invalid": "Недействительно",
      "year_range_stat": "Диапазон годов",
      "chassis_number_stat": "Ваш номер шасси",
      "expected_pattern_stat": "Ожидаемый шаблон",
      "validation_issues_title": "Проблемы валидации",
      "decoded_positions_title": "Декодированные позиции",
      "position_label": "Позиция"
    },
    "special_notes": {
      "title": "Особые примечания",
      "build_number_title": "Примечание о номере сборки",
      "build_number_text": "Первый автомобиль на заводе в Лонгбридже получил номер 101, как и первый на заводе в Кавли. С тех пор каждый завод продолжил собственную числовую последовательность независимо от модели; например, седаны, фургоны и т. д. Иными словами, каждая модель не начинала с номера 101 и не вела собственную отдельную нумерацию. Седаны и фургоны и т. д. перемешаны в числовой последовательности вместе с моделями Cooper и Cooper S.",
      "assembly_plant_title": "Примечание о заводе-изготовителе",
      "assembly_plant_text": "Этот признак, по всей видимости, использовался непоследовательно на автомобилях британской сборки. Считается, что если буква отсутствует, автомобиль был собран на «основном» заводе; например, Austin, Riley или Wolseley из Лонгбриджа может иметь или не иметь букву «A» после порядкового номера. Да, существовали Austin Mini, собранные на заводе Morris в Кавли, и Morris Mini, собранные на заводе Austin в Лонгбридже. Обратите внимание, что все модели Cooper и Cooper S британской сборки (Austin и Morris), а также модели Riley Elf и Wolseley Hornet были собраны на заводе Austin в Лонгбридже."
    },
    "attribution": {
      "text": "Обратите внимание, что приведённые выше сведения взяты из технических статей",
      "mini_mania": "Mini Mania's",
      "technical_articles": "Дополнительные сведения можно найти здесь:",
      "link_text": "Технические статьи по кодам шасси"
    },
    "ui": {
      "support_section": "Поддержка"
    }
  },
  "ja": {
    "title": "Tech - ミニ シャシープレート デコーダー",
    "description": "クラシックミニのシャシープレートをデコードして、モデルイヤー、組立工場、車両の連番ビルド番号を確認できます。シャシープレートは世代によってVINプレート、VINタグとも呼ばれます。",
    "keywords": "シャシーデコーダー, クラシックミニ VIN, シャシープレート, ミニクーパー VINデコーダー, シャシー番号検索, ミニ識別, ビルド番号デコーダー",
    "hero_title": "シャシーデコーダー",
    "breadcrumb_title": "シャシーデコーダー",
    "og_title": "Tech - ミニ シャシープレート デコーダー",
    "og_description": "クラシックミニのシャシープレートをデコードして、モデルイヤー、組立工場、車両の連番ビルド番号を確認できます。シャシープレートは世代によってVINプレート、VINタグとも呼ばれます。",
    "twitter_title": "Tech - ミニ シャシープレート デコーダー",
    "twitter_description": "クラシックミニのシャシープレートをデコードして、モデルイヤー、組立工場、車両の連番ビルド番号を確認できます。",
    "main_heading": "シャシープレート デコーダー",
    "description_text": "シャシープレートは、車体にリベットで固定された金属プレートに刻印された一連の数字とアルファベットです。このプレートはミニの各世代によって異なる場所に取り付けられており、モデルイヤー、組立工場、連番ビルド番号を識別するために使用されます。シャシープレートは世代によってVINプレート、VINタグとも呼ばれます。",
    "engine_decoder_card": {
      "link_title": "エンジンプレートデコーダーへのリンク",
      "heading": "エンジンデコーダー",
      "description": "こちらをクリックして、新しいエンジン番号デコードテーブルでエンジンを識別してください。",
      "alt_text": "エンジンデコーダー"
    },
    "form": {
      "card_title": "シャシー番号をデコードする",
      "card_description": "シャシー番号を入力し、適切な年式範囲を選択すると、すべての詳細が自動的にデコードされます。",
      "year_range_label": "年式範囲",
      "chassis_number_label": "シャシー番号",
      "chassis_number_placeholder": "シャシー番号を入力してください",
      "example_text": "例（年式範囲：",
      "decode_button": "シャシーをデコード",
      "decoding_button": "デコード中...",
      "reset_button": "リセット",
      "error_empty_chassis": "シャシー番号を入力してください",
      "error_decode_failed": "シャシー番号のデコードに失敗しました。もう一度お試しください。"
    },
    "results": {
      "title": "デコード結果",
      "status_decoded": "デコード済み",
      "status_invalid": "無効",
      "year_range_stat": "年式範囲",
      "chassis_number_stat": "入力したシャシー番号",
      "expected_pattern_stat": "期待されるパターン",
      "validation_issues_title": "バリデーションエラー",
      "decoded_positions_title": "デコードされた各桁の意味",
      "position_label": "桁"
    },
    "special_notes": {
      "title": "特記事項",
      "build_number_title": "ビルド番号について",
      "build_number_text": "ロングブリッジの最初の車は番号101から始まり、コウリーの最初の車も同様でした。それ以降、各工場はモデルに関係なく独自の番号シーケンスを継続しました。たとえば、サルーン、バンなど。つまり、各モデルが101から始まり独自のシーケンスを維持したわけではありません。サルーンやバンなどは、CooperおよびCooper Sモデルと混在して番号が付けられています。",
      "assembly_plant_title": "組立工場について",
      "assembly_plant_text": "英国製の車ではこの表記が一貫して使用されていないようです。アルファベットが省略されている場合は「通常の」工場で製造されたと解釈されます。たとえば、ロングブリッジのAustin、Riley、Wolseleyには、シーケンス番号の後に「A」が付く場合と付かない場合があります。コウリーのMorris工場でAustin Miniが製造され、ロングブリッジのAustin工場でMorris Miniが製造されたケースも存在します。英国製のCooperおよびCooper S（AustinおよびMorris）、Riley Elf、Wolseley HornetはすべてロングブリッジのAustin工場で製造されました。"
    },
    "attribution": {
      "text": "上記の情報は",
      "mini_mania": "Mini Mania's",
      "technical_articles": "の技術記事から引用しています。詳細はこちらをご覧ください：",
      "link_text": "シャシーコード技術記事"
    },
    "ui": {
      "support_section": "サポート"
    }
  },
  "zh": {
    "title": "Tech - 迷你底盘铭牌解码器",
    "description": "解码您的经典迷你的底盘铭牌，以确定车辆的生产年份、装配工厂和顺序生产编号。底盘铭牌也被称为VIN铭牌、VIN标签或VIN板，具体名称取决于车辆的生产年代。",
    "keywords": "底盘解码器, 经典迷你VIN, 底盘铭牌, 迷你库珀VIN解码器, 底盘号查询, 迷你识别, 生产编号解码器",
    "hero_title": "底盘解码器",
    "breadcrumb_title": "底盘解码器",
    "og_title": "Tech - 迷你底盘铭牌解码器",
    "og_description": "解码您的经典迷你的底盘铭牌，以确定车辆的生产年份、装配工厂和顺序生产编号。底盘铭牌也被称为VIN铭牌、VIN标签或VIN板，具体名称取决于车辆的生产年代。",
    "twitter_title": "Tech - 迷你底盘铭牌解码器",
    "twitter_description": "解码您的经典迷你的底盘铭牌，以确定车辆的生产年份、装配工厂和顺序生产编号。",
    "main_heading": "底盘铭牌解码器",
    "description_text": "底盘铭牌是由一系列数字和字母组成的标识，铆接在车身上的金属板上。该铭牌在各个迷你车型代际中位置各有不同，用于识别车辆的生产年份、装配工厂以及顺序生产编号。底盘铭牌也被称为VIN铭牌、VIN标签或VIN板，具体名称取决于车辆的生产年代。",
    "engine_decoder_card": {
      "link_title": "跳转到发动机铭牌解码器",
      "heading": "发动机解码器",
      "description": "点击此处，使用我们最新的发动机编号解码表来识别您的发动机。",
      "alt_text": "发动机解码器"
    },
    "form": {
      "card_title": "解码您的底盘号",
      "card_description": "输入底盘号并选择对应的年份范围，即可自动解码所有详情。",
      "year_range_label": "年份范围",
      "chassis_number_label": "底盘号",
      "chassis_number_placeholder": "请输入您的底盘号",
      "example_text": "示例（年份范围：",
      "decode_button": "解码底盘",
      "decoding_button": "解码中...",
      "reset_button": "重置",
      "error_empty_chassis": "请输入底盘号",
      "error_decode_failed": "底盘号解码失败，请重试。"
    },
    "results": {
      "title": "解码结果",
      "status_decoded": "已解码",
      "status_invalid": "无效",
      "year_range_stat": "年份范围",
      "chassis_number_stat": "您的底盘号",
      "expected_pattern_stat": "预期格式",
      "validation_issues_title": "验证问题",
      "decoded_positions_title": "各位含义",
      "position_label": "位置"
    },
    "special_notes": {
      "title": "特别说明",
      "build_number_title": "关于生产编号",
      "build_number_text": "朗布里奇工厂的第一辆车编号为101，考利工厂的第一辆车同样如此。此后，每个工厂无论车型（例如轿车、厢式货车等）均沿用各自独立的编号序列。换言之，每种车型并不从101开始独立编号。轿车和厢式货车等车型的编号与Cooper及Cooper S车型混排。",
      "assembly_plant_title": "关于装配工厂",
      "assembly_plant_text": "该字母在英国制造的车辆上使用不一致。通常认为，若序列号后省略字母，则表示该车在「默认」工厂生产；例如，朗布里奇的Austin、Riley或Wolseley车型可能在序列号后有「A」，也可能没有。确实存在在考利Morris工厂生产的Austin Mini，以及在朗布里奇Austin工厂生产的Morris Mini。需要注意的是，所有英国制造的Cooper和Cooper S车型（包括Austin和Morris），以及Riley Elf和Wolseley Hornet车型，均在朗布里奇的Austin工厂生产。"
    },
    "attribution": {
      "text": "以上详细信息来源于",
      "mini_mania": "Mini Mania's",
      "technical_articles": "技术文章。更多详情请参阅：",
      "link_text": "底盘代码技术文章"
    },
    "ui": {
      "support_section": "支持"
    }
  },
  "ko": {
    "title": "Tech - 미니 섀시 플레이트 디코더",
    "description": "클래식 미니의 섀시 플레이트를 디코딩하여 모델 연도, 조립 공장 및 차량의 순차 생산 번호를 확인하세요. 섀시 플레이트는 세대에 따라 VIN 플레이트, VIN 태그 또는 VIN 판이라고도 불립니다.",
    "keywords": "섀시 디코더, 클래식 미니 VIN, 섀시 플레이트, 미니 쿠퍼 VIN 디코더, 섀시 번호 조회, 미니 식별, 생산 번호 디코더",
    "hero_title": "섀시 디코더",
    "breadcrumb_title": "섀시 디코더",
    "og_title": "Tech - 미니 섀시 플레이트 디코더",
    "og_description": "클래식 미니의 섀시 플레이트를 디코딩하여 모델 연도, 조립 공장 및 차량의 순차 생산 번호를 확인하세요. 섀시 플레이트는 세대에 따라 VIN 플레이트, VIN 태그 또는 VIN 판이라고도 불립니다.",
    "twitter_title": "Tech - 미니 섀시 플레이트 디코더",
    "twitter_description": "클래식 미니의 섀시 플레이트를 디코딩하여 모델 연도, 조립 공장 및 차량의 순차 생산 번호를 확인하세요.",
    "main_heading": "섀시 플레이트 디코더",
    "description_text": "섀시 플레이트는 차체에 리벳으로 고정된 금속 판에 각인된 일련의 숫자와 문자로 구성되어 있습니다. 이 플레이트는 미니의 세대별로 다른 위치에 부착되어 있으며, 모델 연도, 조립 공장 및 순차 생산 번호를 식별하는 데 사용됩니다. 섀시 플레이트는 세대에 따라 VIN 플레이트, VIN 태그 또는 VIN 판이라고도 불립니다.",
    "engine_decoder_card": {
      "link_title": "엔진 플레이트 디코더 링크",
      "heading": "엔진 디코더",
      "description": "새로운 엔진 번호 디코딩 표를 사용하여 엔진을 식별하려면 여기를 클릭하세요.",
      "alt_text": "엔진 디코더"
    },
    "form": {
      "card_title": "섀시 번호 디코딩",
      "card_description": "섀시 번호를 입력하고 적절한 연도 범위를 선택하면 모든 세부 정보가 자동으로 디코딩됩니다.",
      "year_range_label": "연도 범위",
      "chassis_number_label": "섀시 번호",
      "chassis_number_placeholder": "섀시 번호를 입력하세요",
      "example_text": "예시 (연도 범위:",
      "decode_button": "섀시 디코딩",
      "decoding_button": "디코딩 중...",
      "reset_button": "초기화",
      "error_empty_chassis": "섀시 번호를 입력해 주세요",
      "error_decode_failed": "섀시 번호 디코딩에 실패했습니다. 다시 시도해 주세요."
    },
    "results": {
      "title": "디코딩 결과",
      "status_decoded": "디코딩됨",
      "status_invalid": "유효하지 않음",
      "year_range_stat": "연도 범위",
      "chassis_number_stat": "입력한 섀시 번호",
      "expected_pattern_stat": "예상 패턴",
      "validation_issues_title": "유효성 검사 문제",
      "decoded_positions_title": "디코딩된 위치",
      "position_label": "위치"
    },
    "special_notes": {
      "title": "특별 참고사항",
      "build_number_title": "생산 번호 관련 참고사항",
      "build_number_text": "롱브리지의 첫 번째 차량은 101번이었으며, 코울리의 첫 번째 차량도 마찬가지였습니다. 이후 각 공장은 모델 종류(예: 세단, 밴 등)에 관계없이 자체 번호 순서를 계속 사용했습니다. 즉, 각 모델이 101번부터 시작하여 독자적인 번호 순서를 유지한 것이 아닙니다. 세단, 밴 등의 차량이 Cooper 및 Cooper S 모델과 함께 번호 순서에 혼재되어 있습니다.",
      "assembly_plant_title": "조립 공장 관련 참고사항",
      "assembly_plant_text": "이 표기는 영국산 차량에서 일관되지 않게 사용된 것으로 보이며, 알파벳이 생략된 경우 해당 차량이 '기본' 공장에서 생산된 것으로 이해됩니다. 예를 들어 롱브리지의 Austin, Riley 또는 Wolseley는 순서 번호 뒤에 'A'가 있을 수도 있고 없을 수도 있습니다. 실제로 코울리의 Morris 공장에서 생산된 Austin Mini와 롱브리지의 Austin 공장에서 생산된 Morris Mini가 존재했습니다. 영국산 Cooper 및 Cooper S 모델(Austin 및 Morris)과 Riley Elf, Wolseley Hornet 모델은 모두 롱브리지의 Austin 공장에서 생산되었습니다."
    },
    "attribution": {
      "text": "위 내용은",
      "mini_mania": "Mini Mania's",
      "technical_articles": "기술 문서에서 발췌한 것입니다. 자세한 내용은 여기에서 확인하세요:",
      "link_text": "섀시 코드 기술 문서"
    },
    "ui": {
      "support_section": "지원"
    }
  }
}
</i18n>

<style lang="scss">
  .position {
    &.position-1 {
      color: red;
    }
    &.position-2 {
      color: green;
    }
    &.position-3 {
      color: rgb(49, 66, 140);
    }
    &.position-4 {
      color: brown;
    }
    &.position-5 {
      color: orange;
    }
    &.position-6 {
      color: tomato;
    }
    &.position-7 {
      color: royalblue;
    }
    &.position-8 {
      color: teal;
    }
    &.position-9 {
      color: peru;
    }
    &.position-10 {
      color: saddlebrown;
    }
    &.position-11 {
      color: salmon;
    }
    &.position-numbers {
      color: purple;
    }
    &.position-last {
      color: tan;
    }
  }
</style>
