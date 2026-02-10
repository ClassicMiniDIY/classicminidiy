<script lang="ts" setup>
  declare const URL: {
    createObjectURL(file: File): string;
    revokeObjectURL(url: string): void;
  };

  const props = defineProps({
    uuid: {
      type: String,
      default: '',
    },
    newWheel: {
      type: Boolean,
      default: false,
    },
  });

  import type { IWheelsData } from '../../data/models/wheels';
  import { humanFileSize } from '../../data/models/helper-utils';

  const { t } = useI18n();

  // Reactive state
  const wheel = ref();
  const pageLoad = ref(true);
  const pageError = ref();
  const loading = ref(false);
  const hasError = ref(false);
  const errorMessage = ref('');
  const hasSuccess = ref(false);
  const detailsValid = ref(false);
  const imagesValid = ref(false);
  const contactValid = ref(false);
  const step = ref(1);
  const { capture } = usePostHog();

  // Track field interactions
  const touchedFields = ref(new Set());

  // Form fields
  const name = ref('');
  const type = ref('');
  const width = ref('');
  const size = ref('');
  const offset = ref('');
  const notes = ref('');
  const userName = ref('');
  const emailAddress = ref('');
  const referral = ref('');
  const dropFiles = ref<File[]>([]);
  const fileInput = ref<HTMLInputElement | null>(null);
  const fileError = ref('');
  const termsAgreed = ref(false);

  // Available wheel sizes
  const wheelSizes = ['10', '12', '13'];

  // Stepper items for display
  const stepperItems = computed(() => [
    t('stepper.wheel_details'),
    t('stepper.images'),
    t('stepper.contact_info'),
    t('stepper.review'),
    t('stepper.submitted'),
  ]);

  // Wheel size options for USelect
  const wheelSizeOptions = wheelSizes.map((size) => ({
    label: `${size}"`,
    value: size,
  }));

  // Form validation
  const validateEmail = (value: string) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(value) || 'Please enter a valid email address';
  };

  const handleFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    fileError.value = '';

    if (input.files) {
      const files = Array.from(input.files);

      // Validate file types and sizes
      const validFiles: File[] = [];
      const maxSize = 3 * 1024 * 1024; // 3MB
      const allowedTypes = ['image/jpeg', 'image/png'];

      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          fileError.value = `Invalid file type: ${file.name}. Only JPG and PNG files are allowed.`;
          continue;
        }

        if (file.size > maxSize) {
          fileError.value = `File too large: ${file.name}. Maximum size is 3MB.`;
          continue;
        }

        validFiles.push(file);
      }

      if (validFiles.length > 5) {
        fileError.value = 'Maximum 5 files allowed.';
        dropFiles.value = validFiles.slice(0, 5);
      } else {
        dropFiles.value = validFiles;
      }
    }
  };

  // Load existing wheel data if editing
  if (!props.newWheel && props.uuid) {
    try {
      const { data, error } = await useFetch(`/api/wheels/wheel`, {
        query: {
          uuid: props.uuid,
        },
        server: true,
        default: () => ({}) as IWheelsData,
      });

      if (error.value) {
        pageError.value = error.value;
        errorMessage.value = t('errors.load_failed');
      } else {
        wheel.value = data.value;
        // Pre-populate form fields with existing data
        if (wheel.value) {
          name.value = wheel.value.name || '';
          type.value = wheel.value.type || '';
          width.value = wheel.value.width || '';
          size.value = wheel.value.size || '';
          offset.value = wheel.value.offset || '';
          notes.value = wheel.value.notes || '';
        }
      }
    } catch (error) {
      pageError.value = error;
      errorMessage.value = t('errors.load_failed');
    } finally {
      pageLoad.value = false;
    }
  } else {
    pageLoad.value = false;
  }

  // Reset form to initial state
  function resetForm() {
    name.value = '';
    type.value = '';
    width.value = '';
    size.value = '';
    offset.value = '';
    notes.value = '';
    userName.value = '';
    emailAddress.value = '';
    referral.value = '';
    dropFiles.value = [];
    step.value = 1;
    hasError.value = false;
    errorMessage.value = '';
    hasSuccess.value = false;
    touchedFields.value = new Set();
  }

  // Store wheel details
  async function storeWheelDetails() {
    const details: IWheelsData = {
      uuid: props.uuid,
      name: name.value,
      type: type.value,
      width: width.value,
      size: size.value,
      offset: offset.value,
      notes: notes.value,
      userName: userName.value,
      emailAddress: emailAddress.value,
      referral: referral.value,
      newWheel: props.newWheel,
    };

    return await useFetch('/api/wheels/save/details', {
      method: 'POST',
      body: details,
      headers: { 'cache-control': 'no-cache' },
    }).catch((err) => {
      console.error('Error saving wheel details:', err);
      throw new Error('Failed to save wheel details');
    });
  }

  // Store wheel images
  async function storeWheelImages(uuid: string) {
    if (!uuid || uuid === '') {
      throw new Error('No UUID provided for image upload');
    }

    const formData = new FormData();
    dropFiles.value.forEach((file, i) => {
      formData.append(`file${i}`, file);
    });

    return await useFetch('/api/wheels/save/images', {
      method: 'POST',
      body: formData,
      query: { uuid },
      headers: { 'cache-control': 'no-cache' },
    }).catch((err) => {
      console.error('Error uploading images:', err);
      throw new Error('Failed to upload images');
    });
  }

  // Check if we can move to the next step
  const canProceedToNextStep = computed(() => {
    if (step.value === 1) return detailsValid.value;
    if (step.value === 2) return imagesValid.value;
    if (step.value === 3) return contactValid.value;
    return true;
  });

  // Mark field as touched when user interacts with it and tabs out
  const markFieldAsTouched = (fieldName: string) => {
    touchedFields.value.add(fieldName);
  };

  // Check if a field has been touched
  const isFieldTouched = (fieldName: string) => {
    return touchedFields.value.has(fieldName);
  };

  // Form validation state
  const validateForm = () => {
    // For wheel details: name, width, and size are required for new wheels
    // For updates, we're more lenient as they might just be adding images or notes
    detailsValid.value = props.newWheel ? !!name.value.trim() && !!width.value && !!size.value : true; // For updates, always allow to proceed to next step

    // Images are required for new wheels, optional for updates
    imagesValid.value = !props.newWheel || dropFiles.value.length > 0;

    // Contact info is always required
    contactValid.value =
      !!userName.value.trim() && !!emailAddress.value.trim() && validateEmail(emailAddress.value) === true;
  };

  // Submit form handler
  const submitForm = async () => {
    try {
      loading.value = true;
      hasError.value = false;
      errorMessage.value = '';

      if (props.newWheel) {
        // For new wheels, save details first, then images
        const { data: detailsResponse } = await storeWheelDetails();
        if (detailsResponse.value?.uuid && dropFiles.value.length > 0) {
          await storeWheelImages(detailsResponse.value.uuid);
        }
      } else {
        // For existing wheels, save details (updates) first, then any new images
        await storeWheelDetails();
        if (dropFiles.value.length > 0) {
          await storeWheelImages(props.uuid);
        }
      }

      hasSuccess.value = true;
      step.value++;
      capture('form_submitted', {
        form: 'wheel_submission',
        wheel_name: name.value,
        wheel_width: width.value,
        wheel_size: size.value,
        is_new: props.newWheel,
      });
    } catch (error) {
      hasError.value = true;
      errorMessage.value = error instanceof Error ? error.message : 'An error occurred during submission';
      console.error('Submission error:', error);
    } finally {
      loading.value = false;
    }
  };

  // Watch form fields for changes
  watch([name, width, size, userName, emailAddress, dropFiles], validateForm, { deep: true });

  // Handle next step click
  const handleNextStep = () => {
    validateForm(); // Re-validate before proceeding
    if (canProceedToNextStep.value) {
      step.value++;
      capture('form_step_changed', {
        form: 'wheel_submission',
        step: step.value,
      });
    } else {
      console.error('Cannot proceed to next step. Validation failed.', {
        detailsValid: detailsValid.value,
        imagesValid: imagesValid.value,
        contactValid: contactValid.value,
      });
    }
  };

  // Initial validation on mount
  onMounted(() => {
    validateForm();
  });
</script>

<template>
  <div class="container mx-auto px-4 py-6">
    <!-- Stepper -->
    <div class="flex justify-between items-center mb-8">
      <div v-for="(stepItem, index) in stepperItems" :key="index" class="flex flex-col items-center flex-1">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
          :class="step >= index + 1 ? 'bg-primary text-white' : 'bg-muted text-muted'"
        >
          {{ index + 1 }}
        </div>
        <span
          class="text-xs mt-1 text-center hidden sm:block"
          :class="step >= index + 1 ? 'text-primary font-medium' : 'text-muted'"
        >
          {{ stepItem }}
        </span>
        <div v-if="index < stepperItems.length - 1" class="hidden sm:block absolute" />
      </div>
    </div>

    <!-- Step 1: Wheel Details -->
    <div v-if="step === 1">
      <USkeleton v-if="pageLoad" class="w-full h-32" />
      <UAlert v-else-if="pageError" color="error">
        <template #description>
          <div class="flex items-center justify-between">
            <span>{{ errorMessage || t('errors.unable_to_load') }}</span>
            <UButton size="sm" color="primary" class="ml-4" @click="resetForm">
              {{ t('errors.start_over') }}
            </UButton>
          </div>
        </template>
      </UAlert>
      <UCard v-else-if="wheel || newWheel">
        <template #header>
          <h2 class="font-semibold text-lg">
            {{ newWheel ? t('step1.title_new') : t('step1.title_update') }}
          </h2>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Wheel Name -->
          <div class="w-full">
            <p v-if="!newWheel && wheel" class="text-sm text-muted mb-1">
              {{ t('step1.current_name') }}
              <span class="font-semibold">{{ wheel.name || t('step1.no_data') }}</span>
            </p>
            <label class="flex items-center gap-1 mb-1">
              <span class="text-sm font-medium">{{ t('step1.wheel_name') }}</span>
              <span v-if="newWheel" class="text-error">*</span>
            </label>
            <UInput
              v-model="name"
              :placeholder="t('step1.wheel_name_placeholder')"
              icon="i-fa6-solid-file-lines"
              :color="isFieldTouched('name') && newWheel && !name.trim() ? 'error' : undefined"
              @blur="markFieldAsTouched('name')"
            />
            <p v-if="isFieldTouched('name') && newWheel && !name.trim()" class="text-sm text-error mt-1">
              {{ t('step1.wheel_name_required') }}
            </p>
          </div>

          <!-- Wheel Type -->
          <div class="w-full">
            <p v-if="!newWheel && wheel" class="text-sm text-muted mb-1">
              {{ t('step1.current_type') }}
              <span class="font-semibold">{{ wheel.type || t('step1.no_data') }}</span>
            </p>
            <label class="text-sm font-medium mb-1 block">{{ t('step1.wheel_material_type') }}</label>
            <UInput v-model="type" :placeholder="t('step1.wheel_material_placeholder')" icon="i-fa6-solid-cube" />
          </div>

          <!-- Wheel Width -->
          <div class="w-full">
            <p v-if="!newWheel && wheel" class="text-sm text-muted mb-1">
              {{ t('step1.current_width') }}
              <span class="font-semibold">{{ wheel.width || t('step1.no_data') }}</span>
            </p>
            <label class="flex items-center gap-1 mb-1">
              <span class="text-sm font-medium">{{ t('step1.wheel_width') }}</span>
              <span v-if="newWheel" class="text-error">*</span>
            </label>
            <UInput
              type="number"
              v-model="width"
              :placeholder="t('step1.wheel_width_placeholder')"
              icon="i-fa6-solid-right-left"
              :color="isFieldTouched('width') && newWheel && !width ? 'error' : undefined"
              @blur="markFieldAsTouched('width')"
            />
            <p v-if="isFieldTouched('width') && newWheel && !width" class="text-sm text-error mt-1">
              {{ t('step1.width_required') }}
            </p>
          </div>

          <!-- Wheel Size -->
          <div class="w-full">
            <p v-if="!newWheel && wheel" class="text-sm text-muted mb-1">
              {{ t('step1.current_size') }}
              <span class="font-semibold">{{ wheel.size || t('step1.no_data') }}</span>
            </p>
            <label class="flex items-center gap-1 mb-1">
              <span class="text-sm font-medium">{{ t('step1.wheel_size') }}</span>
              <span v-if="newWheel" class="text-error">*</span>
            </label>
            <USelect
              v-model="size"
              :items="wheelSizeOptions"
              :placeholder="t('step1.wheel_size_placeholder')"
              :color="isFieldTouched('size') && newWheel && !size ? 'error' : undefined"
              @blur="markFieldAsTouched('size')"
            />
            <p class="text-sm text-muted mt-1">{{ t('step1.diameter_inches') }}</p>
            <p v-if="isFieldTouched('size') && newWheel && !size" class="text-sm text-error mt-1">
              {{ t('step1.wheel_size_required') }}
            </p>
          </div>

          <!-- Offset -->
          <div class="w-full">
            <p v-if="!newWheel && wheel" class="text-sm text-muted mb-1">
              {{ t('step1.current_offset') }}
              <span class="font-semibold">{{ wheel.offset || t('step1.no_data') }}</span>
            </p>
            <label class="text-sm font-medium mb-1 block">{{ t('step1.offset_info') }}</label>
            <UInput
              v-model="offset"
              :placeholder="t('step1.offset_placeholder')"
              icon="i-fa6-solid-arrow-right"
              maxlength="30"
            />
          </div>

          <!-- Notes -->
          <div class="w-full col-span-1 md:col-span-2">
            <p v-if="!newWheel && wheel" class="text-sm text-muted mb-1">
              {{ t('step1.current_notes') }}
              <span class="font-semibold">{{ wheel.notes || t('step1.no_data') }}</span>
            </p>
            <label class="text-sm font-medium mb-1 block">{{ t('step1.extra_notes') }}</label>
            <UTextarea v-model="notes" :placeholder="t('step1.notes_placeholder')" :rows="3" maxlength="250" />
            <p class="text-sm text-muted mt-1">{{ t('step1.characters_count', { count: notes.length }) }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Step 2: Images -->
    <UCard v-else-if="step === 2">
      <template #header>
        <h2 class="font-semibold text-lg">{{ t('step2.title') }}</h2>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Image Upload -->
        <div>
          <h3 class="text-xl font-semibold mb-2">{{ t('step2.add_images') }}</h3>
          <p class="text-sm text-muted mb-4" v-if="newWheel">
            {{ t('step2.new_wheel_notice') }}
          </p>

          <div class="w-full">
            <label class="flex items-center gap-1 mb-1">
              <span class="text-sm font-medium">{{ t('step2.upload_label') }}</span>
              <span v-if="newWheel" class="text-error">*</span>
            </label>
            <input
              type="file"
              ref="fileInput"
              class="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/80 cursor-pointer border border-default rounded-lg"
              accept="image/png, image/jpeg"
              multiple
              @change="handleFileChange"
            />
            <p class="text-sm text-muted mt-1">{{ t('step2.accepted_formats') }}</p>
            <p v-if="fileError" class="text-error text-sm mt-1">
              {{ fileError }}
            </p>
          </div>

          <!-- Files to upload -->
          <div v-if="dropFiles.length > 0" class="mt-4">
            <h4 class="font-medium mb-2">
              {{ t('step2.files_to_upload', { count: dropFiles.length }) }}
            </h4>
            <div class="space-y-2">
              <div
                v-for="(file, index) in dropFiles"
                :key="index"
                class="flex items-center justify-between p-2 bg-muted rounded-lg"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <i class="fas fa-image text-muted shrink-0"></i>
                  <span class="truncate max-w-50">{{ file.name }}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-sm text-muted">{{ humanFileSize(file.size) }}</span>
                  <UButton size="xs" variant="ghost" color="neutral" @click="dropFiles.splice(index, 1)">
                    <i class="fas fa-times"></i>
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Image Preview -->
        <div>
          <h3 class="text-xl font-semibold mb-4">
            {{ newWheel ? t('step2.your_images') : t('step2.existing_images') }}
          </h3>

          <div v-if="!newWheel && wheel?.images?.length" class="grid grid-cols-2 gap-4">
            <div v-for="(image, i) in wheel.images" :key="i" class="relative aspect-square">
              <img :src="image.src" :alt="`Wheel image ${i + 1}`" class="w-full h-full object-cover rounded-lg" />
              <div
                class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center opacity-0 hover:opacity-100"
              >
                <UButton variant="ghost" size="sm" class="text-white">
                  <i class="fas fa-search-plus"></i>
                </UButton>
              </div>
            </div>
          </div>

          <div v-else-if="dropFiles.length > 0" class="grid grid-cols-2 gap-4">
            <div v-for="(file, i) in dropFiles" :key="i" class="relative aspect-square">
              <img
                :src="URL.createObjectURL(file)"
                :alt="`Preview ${i + 1}`"
                class="w-full h-full object-cover rounded-lg"
              />
              <div
                class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center opacity-0 hover:opacity-100"
              >
                <UButton variant="ghost" size="sm" class="text-white" @click="dropFiles.splice(i, 1)">
                  <i class="fas fa-trash"></i>
                </UButton>
              </div>
            </div>
          </div>

          <div v-else class="text-center p-8 border-2 border-dashed border-default rounded-lg">
            <i class="fas fa-images text-4xl text-muted mb-2"></i>
            <p class="text-muted">{{ t('step2.no_images') }}</p>
          </div>
        </div>
      </div>
    </UCard>
    <!-- Step 3: Contact Information -->
    <UCard v-else-if="step === 3">
      <template #header>
        <h2 class="font-semibold text-lg">{{ t('step3.title') }}</h2>
      </template>

      <div class="grid grid-cols-1 gap-6 max-w-2xl mx-auto">
        <div class="w-full">
          <label class="flex items-center gap-1 mb-1">
            <span class="text-sm font-medium">{{ t('step3.your_name') }}</span>
            <span class="text-error">*</span>
          </label>
          <UInput
            v-model="userName"
            :placeholder="t('step3.name_placeholder')"
            icon="i-fa6-solid-user"
            :color="isFieldTouched('userName') && !userName.trim() ? 'error' : undefined"
            @blur="markFieldAsTouched('userName')"
            required
          />
          <p v-if="isFieldTouched('userName') && !userName.trim()" class="text-sm text-error mt-1">
            {{ t('step3.name_required') }}
          </p>
        </div>

        <div class="w-full">
          <label class="flex items-center gap-1 mb-1">
            <span class="text-sm font-medium">{{ t('step3.email_address') }}</span>
            <span class="text-error">*</span>
          </label>
          <UInput
            type="email"
            v-model="emailAddress"
            :placeholder="t('step3.email_placeholder')"
            icon="i-fa6-solid-envelope"
            :color="
              isFieldTouched('emailAddress') && emailAddress && !validateEmail(emailAddress) ? 'error' : undefined
            "
            @blur="markFieldAsTouched('emailAddress')"
            required
          />
          <p
            v-if="isFieldTouched('emailAddress') && emailAddress && !validateEmail(emailAddress)"
            class="text-sm text-error mt-1"
          >
            {{ t('step3.email_invalid') }}
          </p>
        </div>
      </div>
    </UCard>

    <!-- Step 4: Review -->
    <UCard v-if="step === 4">
      <template #header>
        <h2 class="font-semibold text-lg">{{ t('step4.title') }}</h2>
      </template>

      <UAlert v-if="!newWheel" color="info" class="mb-6">
        <template #icon>
          <i class="fas fa-info-circle"></i>
        </template>
        <template #description>{{ t('step4.update_notice') }}</template>
      </UAlert>

      <div class="space-y-6">
        <!-- Wheel Details -->
        <div class="bg-muted rounded-lg p-4">
          <h3 class="font-semibold text-lg mb-4">{{ t('step4.wheel_details') }}</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div class="text-sm font-semibold text-muted">{{ t('step4.name') }}</div>
              <div class="text-base">{{ name || t('step4.not_provided') }}</div>
            </div>
            <div>
              <div class="text-sm font-semibold text-muted">{{ t('step4.type') }}</div>
              <div class="text-base">{{ type || t('step4.not_provided') }}</div>
            </div>
            <div>
              <div class="text-sm font-semibold text-muted">{{ t('step4.width') }}</div>
              <div class="text-base">{{ width || t('step4.not_provided') }}</div>
            </div>
            <div>
              <div class="text-sm font-semibold text-muted">{{ t('step4.size') }}</div>
              <div class="text-base">{{ size || t('step4.not_provided') }}</div>
            </div>
            <div>
              <div class="text-sm font-semibold text-muted">{{ t('step4.offset') }}</div>
              <div class="text-base">{{ offset || t('step4.not_provided') }}</div>
            </div>
            <div class="md:col-span-2">
              <div class="text-sm font-semibold text-muted">{{ t('step4.notes') }}</div>
              <div class="text-base whitespace-pre-line">
                {{ notes || t('step4.no_additional_notes') }}
              </div>
            </div>
          </div>
        </div>

        <!-- Images -->
        <div class="bg-muted rounded-lg p-4">
          <h3 class="font-semibold text-lg mb-4">{{ t('step4.images') }}</h3>
          <div v-if="dropFiles.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <div v-for="(file, i) in dropFiles" :key="i" class="relative aspect-square">
              <img
                :src="URL.createObjectURL(file)"
                :alt="`Preview ${i + 1}`"
                class="w-full h-full object-cover rounded-lg"
              />
            </div>
          </div>
          <div v-else class="text-center py-8 text-muted">
            <i class="fas fa-images text-3xl mb-2"></i>
            <p>{{ t('step4.no_images_added') }}</p>
          </div>
        </div>

        <!-- Contact Information -->
        <div class="bg-muted rounded-lg p-4">
          <h3 class="font-semibold text-lg mb-4">{{ t('step4.contact_information') }}</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div class="text-sm font-semibold text-muted">{{ t('step4.name') }}</div>
              <div class="text-base">{{ userName }}</div>
            </div>
            <div>
              <div class="text-sm font-semibold text-muted">{{ t('step4.email') }}</div>
              <div class="text-base">{{ emailAddress }}</div>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Step 5: Submitted -->
    <UCard v-else-if="step === 5" class="text-center">
      <div class="flex justify-center mb-4">
        <div class="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
          <i class="fas fa-check text-3xl text-success"></i>
        </div>
      </div>
      <h2 class="font-bold text-3xl mb-2">{{ t('step5.thank_you') }}</h2>
      <p class="text-lg mb-6">{{ t('step5.submission_received') }}</p>

      <div class="bg-muted rounded-lg p-4 mb-6 max-w-2xl mx-auto">
        <p v-if="newWheel" class="mb-2">
          {{ t('step5.new_wheel_message', { email: emailAddress }) }}
        </p>
        <p v-else>
          {{ t('step5.update_message', { email: emailAddress }) }}
        </p>
      </div>

      <UButton color="primary" @click="resetForm">
        <i class="fas fa-plus-circle mr-2"></i>
        {{ t('step5.submit_another') }}
      </UButton>
    </UCard>

    <!-- Error Display -->
    <UAlert v-if="hasError" color="error" class="mt-6">
      <template #icon>
        <i class="fas fa-exclamation-circle"></i>
      </template>
      <template #description>{{ errorMessage }}</template>
    </UAlert>

    <!-- Success Display -->
    <UAlert v-if="hasSuccess && step < 5" color="success" class="mt-6">
      <template #icon>
        <i class="fas fa-check-circle"></i>
      </template>
      <template #description>{{ t('success.submission_processing') }}</template>
    </UAlert>

    <!-- Navigation Buttons -->
    <div class="flex justify-end gap-4 mt-8">
      <UButton v-if="step > 1 && step < 5" variant="ghost" @click="step--" :disabled="loading">
        <i class="fas fa-arrow-left mr-2"></i>
        {{ t('navigation.back') }}
      </UButton>

      <UButton v-if="step < 4" color="primary" @click="handleNextStep" :disabled="!canProceedToNextStep || loading">
        {{ t('navigation.next') }}
        <i class="fas fa-arrow-right ml-2"></i>
      </UButton>

      <UButton
        v-else-if="step === 4"
        color="primary"
        @click="submitForm"
        :disabled="!canProceedToNextStep || loading"
        :loading="loading"
      >
        <i class="fas fa-paper-plane mr-2" v-if="!loading"></i>
        {{ loading ? t('navigation.submitting') : t('navigation.submit') }}
      </UButton>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "stepper": {
      "wheel_details": "Wheel Details",
      "images": "Images",
      "contact_info": "Contact Info",
      "review": "Review",
      "submitted": "Submitted"
    },
    "step1": {
      "title_new": "Submit New Wheel",
      "title_update": "Suggest Updates",
      "current_name": "Current Name:",
      "current_type": "Current Type:",
      "current_width": "Current Width:",
      "current_size": "Current Size:",
      "current_offset": "Current Offset:",
      "current_notes": "Current Notes:",
      "wheel_name": "Wheel Name",
      "wheel_name_placeholder": "Enter wheel name",
      "wheel_name_required": "Wheel name is required",
      "wheel_material_type": "Wheel Material Type",
      "wheel_material_placeholder": "e.g., Alloy, Steel, etc.",
      "wheel_width": "Wheel Width",
      "wheel_width_placeholder": "Enter width",
      "width_required": "Width is required",
      "wheel_size": "Wheel Size",
      "wheel_size_placeholder": "Select wheel size",
      "wheel_size_required": "Wheel size is required",
      "diameter_inches": "Diameter in inches",
      "offset_info": "Offset Information",
      "offset_placeholder": "e.g., ET25",
      "extra_notes": "Extra Notes",
      "notes_placeholder": "Any additional information about these wheels...",
      "characters_count": "{count}/250 characters",
      "no_data": "No data"
    },
    "step2": {
      "title": "Wheel Images",
      "add_images": "Add your own images",
      "new_wheel_notice": "To submit a new wheel, you must include at least one image for the registry",
      "upload_label": "Upload up to 5 images",
      "accepted_formats": "Accepted formats: JPG, PNG (Max 3MB each)",
      "files_to_upload": "Files to upload ({count})",
      "your_images": "Your Images",
      "existing_images": "Existing Images",
      "no_images": "No images uploaded yet"
    },
    "step3": {
      "title": "Contact Information",
      "your_name": "Your Name",
      "name_placeholder": "Enter your name",
      "name_required": "Your name is required",
      "email_address": "Email Address",
      "email_placeholder": "your{'@'}email.com",
      "email_invalid": "Please enter a valid email address"
    },
    "step4": {
      "title": "Review Your Submission",
      "update_notice": "You are suggesting updates to an existing wheel. Your changes will be reviewed before being published.",
      "wheel_details": "Wheel Details",
      "images": "Images",
      "contact_information": "Contact Information",
      "not_provided": "Not provided",
      "no_additional_notes": "No additional notes",
      "no_images_added": "No images added",
      "name": "Name",
      "type": "Type",
      "width": "Width",
      "size": "Size",
      "offset": "Offset",
      "notes": "Notes",
      "email": "Email"
    },
    "step5": {
      "thank_you": "Thank You!",
      "submission_received": "Your submission has been received.",
      "new_wheel_message": "Your wheel has been submitted for review. We'll notify you at {email} once it's been approved and added to the registry.",
      "update_message": "Your suggested updates have been submitted for review. We'll notify you at {email} once they've been processed.",
      "submit_another": "Submit Another Wheel"
    },
    "success": {
      "submission_processing": "Your submission is being processed..."
    },
    "navigation": {
      "back": "Back",
      "next": "Next",
      "submit": "Submit",
      "submitting": "Submitting..."
    },
    "errors": {
      "load_failed": "Failed to load wheel data. Please try again.",
      "unable_to_load": "Unable to load wheel data",
      "start_over": "Start Over"
    }
  },
  "de": {
    "stepper": {
      "wheel_details": "Felgendetails",
      "images": "Bilder",
      "contact_info": "Kontaktinfo",
      "review": "Überprüfung",
      "submitted": "Eingereicht"
    },
    "step1": {
      "title_new": "Neue Felge einreichen",
      "title_update": "Updates vorschlagen",
      "current_name": "Aktueller Name:",
      "current_type": "Aktueller Typ:",
      "current_width": "Aktuelle Breite:",
      "current_size": "Aktuelle Größe:",
      "current_offset": "Aktueller Offset:",
      "current_notes": "Aktuelle Notizen:",
      "wheel_name": "Felgenname",
      "wheel_name_placeholder": "Felgenname eingeben",
      "wheel_name_required": "Felgenname ist erforderlich",
      "wheel_material_type": "Felgenmaterial",
      "wheel_material_placeholder": "z.B. Legierung, Stahl, etc.",
      "wheel_width": "Felgenbreite",
      "wheel_width_placeholder": "Breite eingeben",
      "width_required": "Breite ist erforderlich",
      "wheel_size": "Felgengröße",
      "wheel_size_placeholder": "Felgengröße auswählen",
      "wheel_size_required": "Felgengröße ist erforderlich",
      "diameter_inches": "Durchmesser in Zoll",
      "offset_info": "Offset-Informationen",
      "offset_placeholder": "z.B. ET25",
      "extra_notes": "Zusätzliche Notizen",
      "notes_placeholder": "Zusätzliche Informationen über diese Felgen...",
      "characters_count": "{count}/250 Zeichen",
      "no_data": "Keine Daten"
    },
    "step2": {
      "title": "Felgenbilder",
      "add_images": "Eigene Bilder hinzufügen",
      "new_wheel_notice": "Um eine neue Felge einzureichen, müssen Sie mindestens ein Bild für das Register hinzufügen",
      "upload_label": "Bis zu 5 Bilder hochladen",
      "accepted_formats": "Akzeptierte Formate: JPG, PNG (Max 3MB je Bild)",
      "files_to_upload": "Hochzuladende Dateien ({count})",
      "your_images": "Ihre Bilder",
      "existing_images": "Vorhandene Bilder",
      "no_images": "Noch keine Bilder hochgeladen"
    },
    "step3": {
      "title": "Kontaktinformationen",
      "your_name": "Ihr Name",
      "name_placeholder": "Namen eingeben",
      "name_required": "Ihr Name ist erforderlich",
      "email_address": "E-Mail-Adresse",
      "email_placeholder": "ihre{'@'}email.com",
      "email_invalid": "Bitte geben Sie eine gültige E-Mail-Adresse ein"
    },
    "step4": {
      "title": "Ihre Einreichung überprüfen",
      "update_notice": "Sie schlagen Updates für eine bestehende Felge vor. Ihre Änderungen werden vor der Veröffentlichung überprüft.",
      "wheel_details": "Felgendetails",
      "images": "Bilder",
      "contact_information": "Kontaktinformationen",
      "not_provided": "Nicht angegeben",
      "no_additional_notes": "Keine zusätzlichen Notizen",
      "no_images_added": "Keine Bilder hinzugefügt",
      "name": "Name",
      "type": "Typ",
      "width": "Breite",
      "size": "Größe",
      "offset": "Offset",
      "notes": "Notizen",
      "email": "E-Mail"
    },
    "step5": {
      "thank_you": "Vielen Dank!",
      "submission_received": "Ihre Einreichung wurde erhalten.",
      "new_wheel_message": "Ihre Felge wurde zur Überprüfung eingereicht. Wir werden Sie unter {email} benachrichtigen, sobald sie genehmigt und zum Register hinzugefügt wurde.",
      "update_message": "Ihre vorgeschlagenen Updates wurden zur Überprüfung eingereicht. Wir werden Sie unter {email} benachrichtigen, sobald sie bearbeitet wurden.",
      "submit_another": "Weitere Felge einreichen"
    },
    "navigation": {
      "back": "Zurück",
      "next": "Weiter",
      "submit": "Absenden"
    },
    "errors": {
      "load_failed": "Fehler beim Laden der Felgendaten. Bitte versuchen Sie es erneut.",
      "unable_to_load": "Felgendaten konnten nicht geladen werden",
      "start_over": "Neu beginnen"
    }
  },
  "es": {
    "stepper": {
      "wheel_details": "Detalles de Llanta",
      "images": "Imágenes",
      "contact_info": "Información de Contacto",
      "review": "Revisar",
      "submitted": "Enviado"
    },
    "step1": {
      "title_new": "Enviar Nueva Llanta",
      "title_update": "Sugerir Actualizaciones",
      "current_name": "Nombre Actual:",
      "current_type": "Tipo Actual:",
      "current_width": "Ancho Actual:",
      "current_size": "Tamaño Actual:",
      "current_offset": "Offset Actual:",
      "current_notes": "Notas Actuales:",
      "wheel_name": "Nombre de Llanta",
      "wheel_name_placeholder": "Ingresa el nombre de la llanta",
      "wheel_name_required": "El nombre de la llanta es requerido",
      "wheel_material_type": "Tipo de Material de Llanta",
      "wheel_material_placeholder": "ej., Aleación, Acero, etc.",
      "wheel_width": "Ancho de Llanta",
      "wheel_width_placeholder": "Ingresa el ancho",
      "width_required": "El ancho es requerido",
      "wheel_size": "Tamaño de Llanta",
      "wheel_size_placeholder": "Selecciona el tamaño de llanta",
      "wheel_size_required": "El tamaño de llanta es requerido",
      "diameter_inches": "Diámetro en pulgadas",
      "offset_info": "Información de Offset",
      "offset_placeholder": "ej., ET25",
      "extra_notes": "Notas Adicionales",
      "notes_placeholder": "Cualquier información adicional sobre estas llantas...",
      "characters_count": "{count}/250 caracteres",
      "no_data": "Sin datos"
    },
    "step2": {
      "title": "Imágenes de Llanta",
      "add_images": "Agregar tus propias imágenes",
      "new_wheel_notice": "Para enviar una nueva llanta, debes incluir al menos una imagen para el registro",
      "upload_label": "Subir hasta 5 imágenes",
      "accepted_formats": "Formatos aceptados: JPG, PNG (Máx 3MB cada una)",
      "files_to_upload": "Archivos para subir ({count})",
      "your_images": "Tus Imágenes",
      "existing_images": "Imágenes Existentes",
      "no_images": "No se han subido imágenes aún"
    },
    "step3": {
      "title": "Información de Contacto",
      "your_name": "Tu Nombre",
      "name_placeholder": "Ingresa tu nombre",
      "name_required": "Tu nombre es requerido",
      "email_address": "Dirección de Correo Electrónico",
      "email_placeholder": "tu{'@'}correo.com",
      "email_invalid": "Por favor ingresa una dirección de correo electrónico válida"
    },
    "step4": {
      "title": "Revisa tu Envío",
      "update_notice": "Estás sugiriendo actualizaciones a una llanta existente. Tus cambios serán revisados antes de ser publicados.",
      "wheel_details": "Detalles de Llanta",
      "images": "Imágenes",
      "contact_information": "Información de Contacto",
      "not_provided": "No proporcionado",
      "no_additional_notes": "Sin notas adicionales",
      "no_images_added": "Sin imágenes agregadas",
      "name": "Nombre",
      "type": "Tipo",
      "width": "Ancho",
      "size": "Tamaño",
      "offset": "Offset",
      "notes": "Notas",
      "email": "Correo Electrónico"
    },
    "step5": {
      "thank_you": "¡Gracias!",
      "submission_received": "Tu envío ha sido recibido.",
      "new_wheel_message": "Tu llanta ha sido enviada para revisión. Te notificaremos en {email} una vez que haya sido aprobada y agregada al registro.",
      "update_message": "Tus actualizaciones sugeridas han sido enviadas para revisión. Te notificaremos en {email} una vez que hayan sido procesadas.",
      "submit_another": "Enviar Otra Llanta"
    },
    "navigation": {
      "back": "Atrás",
      "next": "Siguiente",
      "submit": "Enviar"
    },
    "errors": {
      "load_failed": "Error al cargar los datos de la llanta. Por favor inténtalo de nuevo.",
      "unable_to_load": "No se pudieron cargar los datos de la llanta",
      "start_over": "Comenzar de Nuevo"
    }
  },
  "fr": {
    "stepper": {
      "wheel_details": "Détails jante",
      "images": "Images",
      "contact_info": "Info contact",
      "review": "Révision",
      "submitted": "Soumis"
    },
    "step1": {
      "title_new": "Soumettre nouvelle jante",
      "title_update": "Suggérer mises à jour",
      "current_name": "Nom actuel:",
      "current_type": "Type actuel:",
      "current_width": "Largeur actuelle:",
      "current_size": "Taille actuelle:",
      "current_offset": "Déport actuel:",
      "current_notes": "Notes actuelles:",
      "wheel_name": "Nom jante",
      "wheel_name_placeholder": "Entrer nom jante",
      "wheel_name_required": "Nom jante requis",
      "wheel_material_type": "Type matériau jante",
      "wheel_material_placeholder": "ex. Alliage, Acier, etc.",
      "wheel_width": "Largeur jante",
      "wheel_width_placeholder": "Entrer largeur",
      "width_required": "Largeur requise",
      "wheel_size": "Taille jante",
      "wheel_size_placeholder": "Sélectionner taille jante",
      "wheel_size_required": "Taille jante requise",
      "diameter_inches": "Diamètre en pouces",
      "offset_info": "Information déport",
      "offset_placeholder": "ex. ET25",
      "extra_notes": "Notes supplémentaires",
      "notes_placeholder": "Informations supplémentaires sur ces jantes...",
      "characters_count": "{count}/250 caractères",
      "no_data": "Aucune donnée"
    },
    "step2": {
      "title": "Images jante",
      "add_images": "Ajouter vos propres images",
      "new_wheel_notice": "Pour soumettre nouvelle jante, vous devez inclure au moins une image pour le registre",
      "upload_label": "Télécharger jusqu'à 5 images",
      "accepted_formats": "Formats acceptés: JPG, PNG (Max 3MB chacune)",
      "files_to_upload": "Fichiers à télécharger ({count})",
      "your_images": "Vos Images",
      "existing_images": "Images Existantes",
      "no_images": "Aucune image téléchargée encore"
    },
    "step3": {
      "title": "Informations contact",
      "your_name": "Votre nom",
      "name_placeholder": "Entrer votre nom",
      "name_required": "Votre nom est requis",
      "email_address": "Adresse e-mail",
      "email_placeholder": "votre{'@'}email.com",
      "email_invalid": "Veuillez entrer adresse e-mail valide"
    },
    "step4": {
      "title": "Réviser votre soumission",
      "update_notice": "Vous suggérez mises à jour pour jante existante. Vos changements seront révisés avant publication.",
      "wheel_details": "Détails jante",
      "images": "Images",
      "contact_information": "Informations contact",
      "not_provided": "Non fourni",
      "no_additional_notes": "Aucune note supplémentaire",
      "no_images_added": "Aucune image ajoutée",
      "name": "Nom",
      "type": "Type",
      "width": "Largeur",
      "size": "Taille",
      "offset": "Déport",
      "notes": "Notes",
      "email": "E-mail"
    },
    "step5": {
      "thank_you": "Merci!",
      "submission_received": "Votre soumission a été reçue.",
      "new_wheel_message": "Votre jante a été soumise pour révision. Nous vous notifierons à {email} une fois approuvée et ajoutée au registre.",
      "update_message": "Vos mises à jour suggérées ont été soumises pour révision. Nous vous notifierons à {email} une fois traitées.",
      "submit_another": "Soumettre autre jante"
    },
    "navigation": {
      "back": "Retour",
      "next": "Suivant",
      "submit": "Soumettre"
    },
    "errors": {
      "load_failed": "Échec chargement données jante. Veuillez réessayer.",
      "unable_to_load": "Impossible charger données jante",
      "start_over": "Recommencer"
    }
  },
  "it": {
    "stepper": {
      "wheel_details": "Dettagli cerchio",
      "images": "Immagini",
      "contact_info": "Info contatto",
      "review": "Revisione",
      "submitted": "Inviato"
    },
    "step1": {
      "title_new": "Invia nuovo cerchio",
      "title_update": "Suggerisci aggiornamenti",
      "current_name": "Nome attuale:",
      "current_type": "Tipo attuale:",
      "current_width": "Larghezza attuale:",
      "current_size": "Dimensione attuale:",
      "current_offset": "Offset attuale:",
      "current_notes": "Note attuali:",
      "wheel_name": "Nome cerchio",
      "wheel_name_placeholder": "Inserisci nome cerchio",
      "wheel_name_required": "Nome cerchio richiesto",
      "wheel_material_type": "Tipo materiale cerchio",
      "wheel_material_placeholder": "es. Lega, Acciaio, ecc.",
      "wheel_width": "Larghezza cerchio",
      "wheel_width_placeholder": "Inserisci larghezza",
      "width_required": "Larghezza richiesta",
      "wheel_size": "Dimensione cerchio",
      "wheel_size_placeholder": "Seleziona dimensione cerchio",
      "wheel_size_required": "Dimensione cerchio richiesta",
      "diameter_inches": "Diametro in pollici",
      "offset_info": "Informazioni offset",
      "offset_placeholder": "es. ET25",
      "extra_notes": "Note aggiuntive",
      "notes_placeholder": "Informazioni aggiuntive su questi cerchi...",
      "characters_count": "{count}/250 caratteri",
      "no_data": "Nessun dato"
    },
    "step2": {
      "title": "Immagini cerchio",
      "add_images": "Aggiungi tue immagini",
      "new_wheel_notice": "Per inviare nuovo cerchio, devi includere almeno un'immagine per il registro",
      "upload_label": "Carica fino a 5 immagini",
      "accepted_formats": "Formati accettati: JPG, PNG (Max 3MB ciascuna)",
      "files_to_upload": "File da caricare ({count})",
      "your_images": "Tue Immagini",
      "existing_images": "Immagini Esistenti",
      "no_images": "Nessuna immagine caricata ancora"
    },
    "step3": {
      "title": "Informazioni contatto",
      "your_name": "Tuo nome",
      "name_placeholder": "Inserisci tuo nome",
      "name_required": "Tuo nome richiesto",
      "email_address": "Indirizzo email",
      "email_placeholder": "tua{'@'}email.com",
      "email_invalid": "Inserisci indirizzo email valido"
    },
    "step4": {
      "title": "Rivedi tua sottomissione",
      "update_notice": "Stai suggerendo aggiornamenti per cerchio esistente. I tuoi cambiamenti saranno rivisti prima della pubblicazione.",
      "wheel_details": "Dettagli cerchio",
      "images": "Immagini",
      "contact_information": "Informazioni contatto",
      "not_provided": "Non fornito",
      "no_additional_notes": "Nessuna nota aggiuntiva",
      "no_images_added": "Nessuna immagine aggiunta",
      "name": "Nome",
      "type": "Tipo",
      "width": "Larghezza",
      "size": "Dimensione",
      "offset": "Offset",
      "notes": "Note",
      "email": "Email"
    },
    "step5": {
      "thank_you": "Grazie!",
      "submission_received": "Tua sottomissione ricevuta.",
      "new_wheel_message": "Tuo cerchio inviato per revisione. Ti notificheremo a {email} una volta approvato e aggiunto al registro.",
      "update_message": "Tuoi aggiornamenti suggeriti inviati per revisione. Ti notificheremo a {email} una volta elaborati.",
      "submit_another": "Invia altro cerchio"
    },
    "navigation": { "back": "Indietro", "next": "Avanti", "submit": "Invia" },
    "errors": {
      "load_failed": "Caricamento dati cerchio fallito. Riprova.",
      "unable_to_load": "Impossibile caricare dati cerchio",
      "start_over": "Ricomincia"
    }
  },
  "ja": {
    "stepper": {
      "wheel_details": "ホイール詳細",
      "images": "画像",
      "contact_info": "連絡先情報",
      "review": "レビュー",
      "submitted": "送信済み"
    },
    "step1": {
      "title_new": "新しいホイールを送信",
      "title_update": "更新を提案",
      "current_name": "現在の名前:",
      "current_type": "現在のタイプ:",
      "current_width": "現在の幅:",
      "current_size": "現在のサイズ:",
      "current_offset": "現在のオフセット:",
      "current_notes": "現在のメモ:",
      "wheel_name": "ホイール名",
      "wheel_name_placeholder": "ホイール名を入力",
      "wheel_name_required": "ホイール名が必要です",
      "wheel_material_type": "ホイール材質タイプ",
      "wheel_material_placeholder": "例：合金、スチールなど",
      "wheel_width": "ホイール幅",
      "wheel_width_placeholder": "幅を入力",
      "width_required": "幅が必要です",
      "wheel_size": "ホイールサイズ",
      "wheel_size_placeholder": "ホイールサイズを選択",
      "wheel_size_required": "ホイールサイズが必要です",
      "diameter_inches": "直径（インチ）",
      "offset_info": "オフセット情報",
      "offset_placeholder": "例：ET25",
      "extra_notes": "追加メモ",
      "notes_placeholder": "これらのホイールに関する追加情報...",
      "characters_count": "{count}/250文字",
      "no_data": "データなし"
    },
    "step2": {
      "title": "ホイール画像",
      "add_images": "独自の画像を追加",
      "new_wheel_notice": "新しいホイールを送信するには、レジストリに少なくとも1つの画像を含める必要があります",
      "upload_label": "最大5つの画像をアップロード",
      "accepted_formats": "受け入れ形式：JPG、PNG（各最大3MB）",
      "files_to_upload": "アップロードするファイル（{count}）",
      "your_images": "あなたの画像",
      "existing_images": "既存の画像",
      "no_images": "まだ画像がアップロードされていません"
    },
    "step3": {
      "title": "連絡先情報",
      "your_name": "あなたの名前",
      "name_placeholder": "名前を入力",
      "name_required": "名前が必要です",
      "email_address": "メールアドレス",
      "email_placeholder": "your{'@'}email.com",
      "email_invalid": "有効なメールアドレスを入力してください"
    },
    "step4": {
      "title": "送信内容を確認",
      "update_notice": "既存のホイールの更新を提案しています。変更は公開前に確認されます。",
      "wheel_details": "ホイール詳細",
      "images": "画像",
      "contact_information": "連絡先情報",
      "not_provided": "提供されていません",
      "no_additional_notes": "追加メモなし",
      "no_images_added": "画像が追加されていません",
      "name": "名前",
      "type": "タイプ",
      "width": "幅",
      "size": "サイズ",
      "offset": "オフセット",
      "notes": "メモ",
      "email": "メール"
    },
    "step5": {
      "thank_you": "ありがとうございます！",
      "submission_received": "送信を受け取りました。",
      "new_wheel_message": "ホイールが審査のために送信されました。承認されてレジストリに追加されたら{email}に通知します。",
      "update_message": "提案された更新が審査のために送信されました。処理されたら{email}に通知します。",
      "submit_another": "別のホイールを送信"
    },
    "navigation": { "back": "戻る", "next": "次へ", "submit": "送信" },
    "errors": {
      "load_failed": "ホイールデータの読み込みに失敗しました。もう一度お試しください。",
      "unable_to_load": "ホイールデータを読み込めません",
      "start_over": "最初からやり直す"
    }
  },
  "ko": {
    "stepper": {
      "wheel_details": "휠 세부사항",
      "images": "이미지",
      "contact_info": "연락처 정보",
      "review": "검토",
      "submitted": "제출됨"
    },
    "step1": {
      "title_new": "새 휠 제출",
      "title_update": "업데이트 제안",
      "current_name": "현재 이름:",
      "current_type": "현재 유형:",
      "current_width": "현재 너비:",
      "current_size": "현재 크기:",
      "current_offset": "현재 오프셋:",
      "current_notes": "현재 메모:",
      "wheel_name": "휠 이름",
      "wheel_name_placeholder": "휠 이름 입력",
      "wheel_name_required": "휠 이름이 필요합니다",
      "wheel_material_type": "휠 재질 유형",
      "wheel_material_placeholder": "예: 합금, 강철 등",
      "wheel_width": "휠 너비",
      "wheel_width_placeholder": "너비 입력",
      "width_required": "너비가 필요합니다",
      "wheel_size": "휠 크기",
      "wheel_size_placeholder": "휠 크기 선택",
      "wheel_size_required": "휠 크기가 필요합니다",
      "diameter_inches": "직경(인치)",
      "offset_info": "오프셋 정보",
      "offset_placeholder": "예: ET25",
      "extra_notes": "추가 메모",
      "notes_placeholder": "이 휠에 대한 추가 정보...",
      "characters_count": "{count}/250자",
      "no_data": "데이터 없음"
    },
    "step2": {
      "title": "휠 이미지",
      "add_images": "자신의 이미지 추가",
      "new_wheel_notice": "새 휠을 제출하려면 레지스트리에 최소 하나의 이미지를 포함해야 합니다",
      "upload_label": "최대 5개 이미지 업로드",
      "accepted_formats": "허용 형식: JPG, PNG (각각 최대 3MB)",
      "files_to_upload": "업로드할 파일 ({count})",
      "your_images": "당신의 이미지",
      "existing_images": "기존 이미지",
      "no_images": "아직 업로드된 이미지가 없습니다"
    },
    "step3": {
      "title": "연락처 정보",
      "your_name": "이름",
      "name_placeholder": "이름 입력",
      "name_required": "이름이 필요합니다",
      "email_address": "이메일 주소",
      "email_placeholder": "your{'@'}email.com",
      "email_invalid": "유효한 이메일 주소를 입력하세요"
    },
    "step4": {
      "title": "제출 내용 검토",
      "update_notice": "기존 휠에 대한 업데이트를 제안하고 있습니다. 변경사항은 게시 전에 검토됩니다.",
      "wheel_details": "휠 세부사항",
      "images": "이미지",
      "contact_information": "연락처 정보",
      "not_provided": "제공되지 않음",
      "no_additional_notes": "추가 메모 없음",
      "no_images_added": "추가된 이미지 없음",
      "name": "이름",
      "type": "유형",
      "width": "너비",
      "size": "크기",
      "offset": "오프셋",
      "notes": "메모",
      "email": "이메일"
    },
    "step5": {
      "thank_you": "감사합니다!",
      "submission_received": "제출이 접수되었습니다.",
      "new_wheel_message": "휠이 검토를 위해 제출되었습니다. 승인되어 레지스트리에 추가되면 {email}로 알려드리겠습니다.",
      "update_message": "제안된 업데이트가 검토를 위해 제출되었습니다. 처리되면 {email}로 알려드리겠습니다.",
      "submit_another": "다른 휠 제출"
    },
    "navigation": { "back": "뒤로", "next": "다음", "submit": "제출" },
    "errors": {
      "load_failed": "휠 데이터 로드에 실패했습니다. 다시 시도해 주세요.",
      "unable_to_load": "휠 데이터를 로드할 수 없습니다",
      "start_over": "처음부터 시작"
    }
  },
  "pt": {
    "stepper": {
      "wheel_details": "Detalhes da roda",
      "images": "Imagens",
      "contact_info": "Info contato",
      "review": "Revisão",
      "submitted": "Enviado"
    },
    "step1": {
      "title_new": "Enviar nova roda",
      "title_update": "Sugerir atualizações",
      "current_name": "Nome atual:",
      "current_type": "Tipo atual:",
      "current_width": "Largura atual:",
      "current_size": "Tamanho atual:",
      "current_offset": "Offset atual:",
      "current_notes": "Notas atuais:",
      "wheel_name": "Nome da roda",
      "wheel_name_placeholder": "Digite nome da roda",
      "wheel_name_required": "Nome da roda obrigatório",
      "wheel_material_type": "Tipo material roda",
      "wheel_material_placeholder": "ex. Liga, Aço, etc.",
      "wheel_width": "Largura roda",
      "wheel_width_placeholder": "Digite largura",
      "width_required": "Largura obrigatória",
      "wheel_size": "Tamanho roda",
      "wheel_size_placeholder": "Selecione tamanho roda",
      "wheel_size_required": "Tamanho roda obrigatório",
      "diameter_inches": "Diâmetro em polegadas",
      "offset_info": "Informação offset",
      "offset_placeholder": "ex. ET25",
      "extra_notes": "Notas extras",
      "notes_placeholder": "Informações adicionais sobre estas rodas...",
      "characters_count": "{count}/250 caracteres",
      "no_data": "Sem dados"
    },
    "step2": {
      "title": "Imagens roda",
      "add_images": "Adicionar suas imagens",
      "new_wheel_notice": "Para enviar nova roda, deve incluir pelo menos uma imagem para o registro",
      "upload_label": "Enviar até 5 imagens",
      "accepted_formats": "Formatos aceitos: JPG, PNG (Máx 3MB cada)",
      "files_to_upload": "Arquivos para enviar ({count})",
      "your_images": "Suas Imagens",
      "existing_images": "Imagens Existentes",
      "no_images": "Nenhuma imagem enviada ainda"
    },
    "step3": {
      "title": "Informações contato",
      "your_name": "Seu nome",
      "name_placeholder": "Digite seu nome",
      "name_required": "Seu nome obrigatório",
      "email_address": "Endereço email",
      "email_placeholder": "seu{'@'}email.com",
      "email_invalid": "Digite endereço email válido"
    },
    "step4": {
      "title": "Revisar seu envio",
      "update_notice": "Você está sugerindo atualizações para roda existente. Suas mudanças serão revisadas antes da publicação.",
      "wheel_details": "Detalhes roda",
      "images": "Imagens",
      "contact_information": "Informações contato",
      "not_provided": "Não fornecido",
      "no_additional_notes": "Nenhuma nota adicional",
      "no_images_added": "Nenhuma imagem adicionada",
      "name": "Nome",
      "type": "Tipo",
      "width": "Largura",
      "size": "Tamanho",
      "offset": "Offset",
      "notes": "Notas",
      "email": "Email"
    },
    "step5": {
      "thank_you": "Obrigado!",
      "submission_received": "Seu envio foi recebido.",
      "new_wheel_message": "Sua roda foi enviada para revisão. Notificaremos você em {email} uma vez aprovada e adicionada ao registro.",
      "update_message": "Suas atualizações sugeridas foram enviadas para revisão. Notificaremos você em {email} uma vez processadas.",
      "submit_another": "Enviar outra roda"
    },
    "navigation": { "back": "Voltar", "next": "Próximo", "submit": "Enviar" },
    "errors": {
      "load_failed": "Falha carregar dados roda. Tente novamente.",
      "unable_to_load": "Impossível carregar dados roda",
      "start_over": "Começar novamente"
    }
  },
  "ru": {
    "stepper": {
      "wheel_details": "Детали диска",
      "images": "Изображения",
      "contact_info": "Контактная информация",
      "review": "Обзор",
      "submitted": "Отправлено"
    },
    "step1": {
      "title_new": "Отправить новый диск",
      "title_update": "Предложить обновления",
      "current_name": "Текущее название:",
      "current_type": "Текущий тип:",
      "current_width": "Текущая ширина:",
      "current_size": "Текущий размер:",
      "current_offset": "Текущий вылет:",
      "current_notes": "Текущие заметки:",
      "wheel_name": "Название диска",
      "wheel_name_placeholder": "Введите название диска",
      "wheel_name_required": "Название диска обязательно",
      "wheel_material_type": "Тип материала диска",
      "wheel_material_placeholder": "напр. Сплав, Сталь и т.д.",
      "wheel_width": "Ширина диска",
      "wheel_width_placeholder": "Введите ширину",
      "width_required": "Ширина обязательна",
      "wheel_size": "Размер диска",
      "wheel_size_placeholder": "Выберите размер диска",
      "wheel_size_required": "Размер диска обязателен",
      "diameter_inches": "Диаметр в дюймах",
      "offset_info": "Информация о вылете",
      "offset_placeholder": "напр. ET25",
      "extra_notes": "Дополнительные заметки",
      "notes_placeholder": "Любая дополнительная информация об этих дисках...",
      "characters_count": "{count}/250 символов",
      "no_data": "Нет данных"
    },
    "step2": {
      "title": "Изображения диска",
      "add_images": "Добавить свои изображения",
      "new_wheel_notice": "Для отправки нового диска необходимо включить хотя бы одно изображение для реестра",
      "upload_label": "Загрузить до 5 изображений",
      "accepted_formats": "Принимаемые форматы: JPG, PNG (Макс 3МБ каждое)",
      "files_to_upload": "Файлы для загрузки ({count})",
      "your_images": "Ваши Изображения",
      "existing_images": "Существующие Изображения",
      "no_images": "Изображения еще не загружены"
    },
    "step3": {
      "title": "Контактная информация",
      "your_name": "Ваше имя",
      "name_placeholder": "Введите ваше имя",
      "name_required": "Ваше имя обязательно",
      "email_address": "Адрес электронной почты",
      "email_placeholder": "ваш{'@'}email.com",
      "email_invalid": "Введите действительный адрес электронной почты"
    },
    "step4": {
      "title": "Просмотрите вашу заявку",
      "update_notice": "Вы предлагаете обновления для существующего диска. Ваши изменения будут рассмотрены перед публикацией.",
      "wheel_details": "Детали диска",
      "images": "Изображения",
      "contact_information": "Контактная информация",
      "not_provided": "Не предоставлено",
      "no_additional_notes": "Нет дополнительных заметок",
      "no_images_added": "Изображения не добавлены",
      "name": "Имя",
      "type": "Тип",
      "width": "Ширина",
      "size": "Размер",
      "offset": "Вылет",
      "notes": "Заметки",
      "email": "Email"
    },
    "step5": {
      "thank_you": "Спасибо!",
      "submission_received": "Ваша заявка получена.",
      "new_wheel_message": "Ваш диск отправлен на рассмотрение. Мы уведомим вас на {email}, как только он будет одобрен и добавлен в реестр.",
      "update_message": "Ваши предлагаемые обновления отправлены на рассмотрение. Мы уведомим вас на {email}, как только они будут обработаны.",
      "submit_another": "Отправить другой диск"
    },
    "navigation": { "back": "Назад", "next": "Далее", "submit": "Отправить" },
    "errors": {
      "load_failed": "Не удалось загрузить данные диска. Попробуйте еще раз.",
      "unable_to_load": "Невозможно загрузить данные диска",
      "start_over": "Начать заново"
    }
  },
  "zh": {
    "stepper": {
      "wheel_details": "轮毂详情",
      "images": "图片",
      "contact_info": "联系信息",
      "review": "审核",
      "submitted": "已提交"
    },
    "step1": {
      "title_new": "提交新轮毂",
      "title_update": "建议更新",
      "current_name": "当前名称:",
      "current_type": "当前类型:",
      "current_width": "当前宽度:",
      "current_size": "当前尺寸:",
      "current_offset": "当前偏移:",
      "current_notes": "当前备注:",
      "wheel_name": "轮毂名称",
      "wheel_name_placeholder": "输入轮毂名称",
      "wheel_name_required": "轮毂名称必填",
      "wheel_material_type": "轮毂材料类型",
      "wheel_material_placeholder": "例如：合金、钢等",
      "wheel_width": "轮毂宽度",
      "wheel_width_placeholder": "输入宽度",
      "width_required": "宽度必填",
      "wheel_size": "轮毂尺寸",
      "wheel_size_placeholder": "选择轮毂尺寸",
      "wheel_size_required": "轮毂尺寸必填",
      "diameter_inches": "直径（英寸）",
      "offset_info": "偏移信息",
      "offset_placeholder": "例如：ET25",
      "extra_notes": "额外备注",
      "notes_placeholder": "关于这些轮毂的任何额外信息...",
      "characters_count": "{count}/250字符",
      "no_data": "无数据"
    },
    "step2": {
      "title": "轮毂图片",
      "add_images": "添加您的图片",
      "new_wheel_notice": "要提交新轮毂，您必须为注册表包含至少一张图片",
      "upload_label": "上传最多5张图片",
      "accepted_formats": "接受格式：JPG、PNG（每张最大3MB）",
      "files_to_upload": "要上传的文件（{count}）",
      "your_images": "您的图片",
      "existing_images": "现有图片",
      "no_images": "尚未上传图片"
    },
    "step3": {
      "title": "联系信息",
      "your_name": "您的姓名",
      "name_placeholder": "输入您的姓名",
      "name_required": "您的姓名必填",
      "email_address": "电子邮件地址",
      "email_placeholder": "your{'@'}email.com",
      "email_invalid": "请输入有效的电子邮件地址"
    },
    "step4": {
      "title": "审核您的提交",
      "update_notice": "您正在为现有轮毂建议更新。您的更改将在发布前进行审核。",
      "wheel_details": "轮毂详情",
      "images": "图片",
      "contact_information": "联系信息",
      "not_provided": "未提供",
      "no_additional_notes": "无额外备注",
      "no_images_added": "未添加图片",
      "name": "姓名",
      "type": "类型",
      "width": "宽度",
      "size": "尺寸",
      "offset": "偏移",
      "notes": "备注",
      "email": "邮箱"
    },
    "step5": {
      "thank_you": "谢谢！",
      "submission_received": "已收到您的提交。",
      "new_wheel_message": "您的轮毂已提交审核。一旦获得批准并添加到注册表，我们将通知您的邮箱{email}。",
      "update_message": "您建议的更新已提交审核。一旦处理完成，我们将通知您的邮箱{email}。",
      "submit_another": "提交另一个轮毂"
    },
    "navigation": { "back": "返回", "next": "下一步", "submit": "提交" },
    "errors": {
      "load_failed": "加载轮毂数据失败。请重试。",
      "unable_to_load": "无法加载轮毂数据",
      "start_over": "重新开始"
    }
  }
}
</i18n>
