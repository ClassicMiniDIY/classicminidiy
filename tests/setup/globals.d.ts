import type { Ref } from 'vue';

declare global {
  function useState<T>(key: string, init?: () => T): Ref<T>;
  function useRouter(): any;
  function useRoute(): any;
  function useRuntimeConfig(): any;
  function useCookie(key: string): any;
  function useNuxtApp(): any;
  function useI18n(): any;
  function navigateTo(to: string, options?: any): any;
  function computed<T>(getter: () => T): any;
  function watch(...args: any[]): any;
  function watchEffect(effect: () => void): any;
  function onMounted(hook: () => void): void;
  function onUnmounted(hook: () => void): void;
  function onBeforeUnmount(hook: () => void): void;
  function nextTick(): Promise<void>;
  function ref<T>(value: T): Ref<T>;
  function reactive<T>(target: T): T;
  function readonly<T>(target: T): T;
  function definePageMeta(meta: any): void;
  function useHead(head: any): void;
  function useSeoMeta(meta: any): void;
  function __resetNuxtState(): void;
}

export {};
