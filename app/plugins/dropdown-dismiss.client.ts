/**
 * Escape closes any open daisyUI dropdown, app-wide.
 *
 * These menus are pure CSS — daisyUI opens them on `:focus-within` — so there
 * is no state to set and no component to notify. "Closing" one means moving
 * focus out of it, which until this existed only a click somewhere else could
 * do. Every dropdown in the app was therefore keyboard-openable and not
 * keyboard-closable.
 *
 * Deliberately narrow: it acts only when focus is genuinely inside a
 * `.dropdown`, so it never swallows an Escape meant for the omnisearch
 * palette, the contribute wizard, or a `<dialog class="modal">`. A dropdown
 * nested inside a modal takes precedence and closes first, which is the
 * expected innermost-first behaviour — the next Escape reaches the modal.
 */
export default defineNuxtPlugin(() => {
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;

    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;

    const dropdown = active.closest('.dropdown');
    if (!dropdown) return;

    event.preventDefault();
    active.blur();
  };

  window.addEventListener('keydown', onKeydown);

  // Nuxt plugins live for the life of the app, but clean up anyway so HMR in
  // dev doesn't stack duplicate listeners on every edit.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => window.removeEventListener('keydown', onKeydown));
  }
});
