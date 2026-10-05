// Custom page meta flags read by app.vue.
declare module '#app' {
  interface PageMeta {
    /** Render the page without the site chrome (nav, footer, onboarding nudge). */
    bareLayout?: boolean;
  }
}

export {};
