<script lang="ts" setup>
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';
  import { chassisRanges } from '../../../data/models/decoders';

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

      const { capture } = usePostHog();
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
