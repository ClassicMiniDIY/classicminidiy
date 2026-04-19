# Nuxt UI → DaisyUI 5 Conversion Reference

This document is the source of truth for the `@nuxt/ui` → `daisyui` 5 migration on the `feature/daisy-ui-rebuild` branch. Agents working on the conversion **must** follow these rules exactly.

## Scope of what changes

**Change:** Any `<U*>` component (UButton, UCard, UInput, etc.) must be replaced with raw HTML + daisyUI class names.

**Do NOT change:**
- Template logic, props, emits, or reactivity — preserve `v-if`, `v-for`, `v-model`, event handlers, slot usage, ref values, computed props, i18n `t()` calls, `trackStuff()` calls.
- Font Awesome icon markup (`<i class="fas fa-...">`, `<i class="fad fa-...">`, `<i class="fab fa-...">`, etc.) — keep as-is.
- Tailwind utility classes that don't conflict with daisyUI (layout, spacing, typography utilities).
- Business logic in `<script>` blocks.
- `<NuxtLink>`, `<NuxtImg>`, `<NuxtPicture>`, `<NuxtPage>`, `<NuxtLoadingIndicator>` — all stay.
- `useColorMode()`, `useToast()` composables — they exist now as local composables with the same API.

## Theme & color system

- Active themes: **`cmdiy`** (light, default) and **`cmdiy-dark`** (dark).
- Theme is selected via `data-theme` attribute on `<html>`.
- Use semantic color tokens from daisyUI: `primary`, `secondary`, `accent`, `neutral`, `info`, `success`, `warning`, `error`, `base-100` / `base-200` / `base-300` / `base-content`.
- Backgrounds: `bg-base-100` (main), `bg-base-200` (muted section), `bg-base-300` (strongest).
- Text: `text-base-content` (default body text), `text-primary`, `text-error`, etc.
- **Do not** write `.dark:*` tailwind variants anymore — daisyUI handles both themes automatically when you use semantic tokens. Delete existing `dark:` variants that were paired with `bg-*`, `text-*`, `border-*` for neutrals.

## Icon conversion helper

When a Nuxt UI component had `icon="i-fa6-solid-foo"`:
- `i-fa6-solid-*` → `<i class="fas fa-*"></i>`
- `i-fa6-regular-*` → `<i class="far fa-*"></i>`
- `i-fa6-brands-*` → `<i class="fab fa-*"></i>`
- `i-heroicons-*` → map to the closest Font Awesome equivalent or `<i class="fas fa-*"></i>` (this project is FA-only)

## Component-by-component mapping

### UButton
```html
<!-- before -->
<UButton color="primary" variant="solid" size="md" icon="i-fa6-solid-save" @click="save">
  Save
</UButton>

<!-- after -->
<button class="btn btn-primary" @click="save">
  <i class="fas fa-save"></i>
  Save
</button>
```

Variant/color/size mapping:
| Nuxt UI                        | DaisyUI class          |
|--------------------------------|------------------------|
| `color="primary"`              | `btn-primary`          |
| `color="secondary"`            | `btn-secondary`        |
| `color="success"`              | `btn-success`          |
| `color="error"`                | `btn-error`            |
| `color="warning"`              | `btn-warning`          |
| `color="info"`                 | `btn-info`             |
| `color="neutral"`              | `btn-neutral`          |
| `variant="solid"`              | (default)              |
| `variant="outline"`            | `btn-outline`          |
| `variant="soft"`               | `btn-soft`             |
| `variant="ghost"`              | `btn-ghost`            |
| `variant="link"`               | `btn-link`             |
| `size="xs"`                    | `btn-xs`               |
| `size="sm"`                    | `btn-sm`               |
| `size="md"`                    | (default)              |
| `size="lg"`                    | `btn-lg`               |
| `size="xl"`                    | `btn-xl`               |
| `block`                        | `btn-block`            |
| `square`                       | `btn-square`           |
| `loading`                      | replace inner with `<span class="loading loading-spinner"></span>` |
| `disabled`                     | `disabled` attr        |

If `to="..."` is set, use `<NuxtLink class="btn ...">...</NuxtLink>` instead of `<button>`.

If `color="neutral" variant="ghost"`, use `btn btn-ghost`.

### UCard
```html
<!-- before -->
<UCard>
  <template #header>...</template>
  body...
  <template #footer>...</template>
</UCard>

<!-- after -->
<div class="card bg-base-100 shadow-md border border-base-300">
  <div class="card-body">
    <div class="card-title">...header...</div>
    <div>body...</div>
    <div class="card-actions justify-end">...footer...</div>
  </div>
</div>
```

### UInput
```html
<!-- before -->
<UInput v-model="value" placeholder="Search" icon="i-fa6-solid-magnifying-glass" size="sm" />

<!-- after -->
<label class="input input-sm">
  <i class="fas fa-magnifying-glass opacity-60"></i>
  <input type="text" v-model="value" placeholder="Search" />
</label>
```

Plain input (no icon):
```html
<input type="text" v-model="value" class="input input-bordered" placeholder="Search" />
```

Color modifiers: `input-primary`, `input-error`, `input-success`, `input-warning`, `input-info`, `input-ghost`.
Size modifiers: `input-xs`, `input-sm`, `input-md`, `input-lg`.
`:disabled="true"` → `disabled` attribute.

### USelect
```html
<!-- before -->
<USelect v-model="val" :items="[{label:'One',value:1},{label:'Two',value:2}]" />

<!-- after -->
<select v-model="val" class="select select-bordered">
  <option :value="1">One</option>
  <option :value="2">Two</option>
</select>
```

If the items are dynamic, iterate: `<option v-for="opt in items" :key="opt.value" :value="opt.value">{{ opt.label }}</option>`.

### UTextarea
```html
<!-- before -->
<UTextarea v-model="notes" :rows="4" placeholder="Notes" />

<!-- after -->
<textarea v-model="notes" class="textarea textarea-bordered" rows="4" placeholder="Notes"></textarea>
```

### UBadge
```html
<!-- before -->
<UBadge color="primary" variant="soft" size="sm">New</UBadge>

<!-- after -->
<span class="badge badge-primary badge-soft badge-sm">New</span>
```

Variants: `badge-outline`, `badge-soft`, `badge-dash`, `badge-ghost`. Default is solid.

### UAlert
```html
<!-- before -->
<UAlert color="warning" icon="i-fa6-solid-triangle-exclamation" title="Heads up" description="..." />

<!-- after -->
<div role="alert" class="alert alert-warning">
  <i class="fas fa-triangle-exclamation"></i>
  <div>
    <div class="font-semibold">Heads up</div>
    <div class="text-sm">...</div>
  </div>
</div>
```

Colors: `alert-info`, `alert-success`, `alert-warning`, `alert-error`. Variants: `alert-outline`, `alert-soft`, `alert-dash`.

### USeparator
```html
<!-- before -->
<USeparator />
<USeparator label="OR" />

<!-- after -->
<div class="divider"></div>
<div class="divider">OR</div>
```

Horizontal in flex-row: `divider-horizontal`.

### USkeleton
```html
<!-- before -->
<USkeleton class="h-8 w-32" />

<!-- after -->
<div class="skeleton h-8 w-32"></div>
```

### UFormField
```html
<!-- before -->
<UFormField label="Email" name="email" hint="Required" :error="errors.email">
  <UInput v-model="email" />
</UFormField>

<!-- after -->
<fieldset class="fieldset">
  <legend class="fieldset-legend">Email</legend>
  <input v-model="email" type="email" class="input input-bordered w-full" :class="{ 'input-error': errors.email }" />
  <p v-if="errors.email" class="label text-error">{{ errors.email }}</p>
  <p v-else class="label">Required</p>
</fieldset>
```

### UModal
```html
<!-- before -->
<UModal v-model:open="isOpen" title="Confirm">
  <template #body>...content...</template>
  <template #footer>
    <UButton @click="confirm">OK</UButton>
  </template>
</UModal>

<!-- after -->
<dialog :open="isOpen" class="modal" @close="isOpen = false">
  <div class="modal-box">
    <h3 class="text-lg font-semibold">Confirm</h3>
    <div class="py-4">...content...</div>
    <div class="modal-action">
      <button class="btn btn-primary" @click="confirm">OK</button>
      <button class="btn" @click="isOpen = false">Cancel</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
```

If an existing component used a ref + `.open()` / `.close()` on a ref for UModal, convert to using `useTemplateRef` on the `<dialog>` and call `.showModal()` / `.close()`, OR use a reactive boolean (`isOpen`) and set `open` attribute + call `show()`/`close()` via watcher.

### UAccordion
```html
<!-- before -->
<UAccordion :items="[{ label: 'Q1', content: 'A1' }]" />

<!-- after -->
<div class="join join-vertical w-full">
  <div v-for="(item, i) in items" :key="i" class="collapse collapse-arrow join-item border border-base-300">
    <input type="radio" name="accordion-{{ uid }}" :checked="i === 0" />
    <div class="collapse-title font-medium">{{ item.label }}</div>
    <div class="collapse-content text-sm">{{ item.content }}</div>
  </div>
</div>
```

### ULink
```html
<!-- before -->
<ULink to="/foo">Link</ULink>

<!-- after -->
<NuxtLink to="/foo" class="link link-primary">Link</NuxtLink>
```

### UTable
Use `<table class="table">`. For zebra rows add `table-zebra`. For hover add `table-pin-rows` / `table-pin-cols` as needed. Size: `table-xs`, `table-sm`, `table-lg`.
```html
<table class="table table-zebra">
  <thead>
    <tr><th>Name</th><th>Value</th></tr>
  </thead>
  <tbody>
    <tr v-for="row in rows" :key="row.id">
      <td>{{ row.name }}</td>
      <td>{{ row.value }}</td>
    </tr>
  </tbody>
</table>
```

### UBreadcrumb
```html
<!-- before -->
<UBreadcrumb :items="[{ label: 'Home', to: '/' }, { label: 'Archive', to: '/archive' }]" />

<!-- after -->
<div class="breadcrumbs text-sm">
  <ul>
    <li v-for="(crumb, i) in items" :key="i">
      <NuxtLink v-if="crumb.to && i < items.length - 1" :to="crumb.to">{{ crumb.label }}</NuxtLink>
      <span v-else>{{ crumb.label }}</span>
    </li>
  </ul>
</div>
```

### USwitch / UCheckbox
```html
<!-- switch -->
<input type="checkbox" v-model="enabled" class="toggle toggle-primary" />

<!-- checkbox -->
<input type="checkbox" v-model="checked" class="checkbox checkbox-primary" />
```

### UDropdownMenu
```html
<!-- before -->
<UDropdownMenu :items="[[{label:'Edit',to:'/edit'}]]">
  <UButton>Menu</UButton>
</UDropdownMenu>

<!-- after -->
<div class="dropdown dropdown-end">
  <div tabindex="0" role="button" class="btn">Menu</div>
  <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-10 w-52 p-2 shadow">
    <li><NuxtLink to="/edit">Edit</NuxtLink></li>
  </ul>
</div>
```

### UButtonGroup
```html
<!-- before -->
<UButtonGroup>
  <UButton>Left</UButton>
  <UButton>Right</UButton>
</UButtonGroup>

<!-- after -->
<div class="join">
  <button class="btn join-item">Left</button>
  <button class="btn join-item">Right</button>
</div>
```

### UColorModeButton
Already migrated — use `<ColorModeButton />` (auto-imported). Do not remove; keep usages where they are.

### UTooltip
```html
<!-- before -->
<UTooltip text="Hello">
  <UButton>Hover</UButton>
</UTooltip>

<!-- after -->
<div class="tooltip" data-tip="Hello">
  <button class="btn">Hover</button>
</div>
```

### UToaster
Already migrated — the `<Toaster />` component is mounted globally in `app.vue`. Remove any `<UToaster />` usage inside pages; `useToast()` still works with the same `.add({title, description, color, icon})` API.

### USlideover
```html
<!-- before -->
<USlideover v-model:open="open" side="right">
  <template #header>Title</template>
  <template #body>Content</template>
</USlideover>

<!-- after -->
<div class="drawer drawer-end" :class="{ 'drawer-open': open }">
  <input type="checkbox" class="drawer-toggle" :checked="open" @change="open = $event.target.checked" />
  <div class="drawer-side z-50">
    <label class="drawer-overlay" @click="open = false"></label>
    <div class="min-h-full w-80 bg-base-100 p-4 flex flex-col gap-4">
      <div class="font-semibold">Title</div>
      <div>Content</div>
    </div>
  </div>
</div>
```

### UCollapsible
```html
<div class="collapse collapse-arrow bg-base-200">
  <input type="checkbox" />
  <div class="collapse-title font-medium">Toggle</div>
  <div class="collapse-content">Hidden content</div>
</div>
```

### UAvatar
```html
<!-- before -->
<UAvatar :src="url" alt="User" size="md" />

<!-- after -->
<div class="avatar">
  <div class="w-10 rounded-full">
    <img :src="url" alt="User" />
  </div>
</div>
```

Sizes (approximate): xs `w-6`, sm `w-8`, md `w-10`, lg `w-16`, xl `w-24`.

### UApp
Already removed at the app.vue level. Delete any stray `<UApp>` / `</UApp>` wrappers.

## `useColorMode()` API

Same surface as before. Exposes `.preference` (writable ref), `.value` (alias), `.resolved` (readonly `'light' | 'dark'`), `.isDark` (readonly boolean), `.toggle()`.

Existing usages like `colorMode.value === 'dark'` still work — but `.value` returns `'light' | 'dark' | 'system'` (user preference), not always the resolved mode. If the original code compared `colorMode.value === 'dark'` to decide chart/table colors, switch to `colorMode.isDark.value` (or `colorMode.resolved.value === 'dark'`) instead.

## `useToast()` API

Same API: `const toast = useToast(); toast.add({ title, description, color, icon })`.

`color` supports `'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'neutral'`.
`icon` strings starting with `i-fa6-solid-`, `i-fa6-regular-`, `i-fa6-brands-`, `i-heroicons-` are auto-normalized to Font Awesome classes.

## `.dark:` variant cleanup

Throughout the codebase there are Tailwind `dark:` variants pinned to the old `.dark` class strategy. These should be **removed** when they duplicate what daisyUI semantic tokens already handle.

Examples to clean up:
- `bg-white dark:bg-neutral-900` → `bg-base-100`
- `text-neutral-900 dark:text-neutral-100` → `text-base-content`
- `border-neutral-200 dark:border-neutral-800` → `border-base-300`
- `bg-neutral-50 dark:bg-neutral-800` → `bg-base-200`
- `bg-neutral-100 dark:bg-neutral-800` → `bg-base-200` (muted)
- `hover:bg-neutral-100 dark:hover:bg-neutral-800` → `hover:bg-base-200`

Keep `dark:` variants ONLY if they do something special that daisyUI tokens can't express (rare).

## What agents should run before finishing

After converting files, do a quick sanity sweep:

1. No remaining `<U[A-Z]` component tags in your files.
2. No remaining `import ... from '@nuxt/ui'` or similar.
3. No remaining `icon="i-..."` props on converted elements (they should be inline `<i class="fa..">`).
4. Logic/reactive state / props / emits / slots preserved.
5. Translation keys (`t('...')`) untouched.

## Common pitfalls — DO NOT

- **Do not** re-render a component's slots wrong. When converting `<UCard><template #header>...</template>body<template #footer>...</template></UCard>`, preserve header/body/footer content and order.
- **Do not** drop `v-model`. `<UInput v-model="x" />` → `<input v-model="x" class="input input-bordered" />`.
- **Do not** lose `aria-*` attributes, `for`/`id` pairings, form `name` attributes, or `type="email"` / `type="password"` / `type="number"` on inputs.
- **Do not** invent new daisyUI classes. If unsure, check the [daisyUI docs](https://daisyui.com/components/) or call the `daisyui-blueprint` MCP (`mcp__daisyui-blueprint__daisyUI-Snippets`).
- **Do not** change the underlying Nuxt composables (`useRoute`, `useRouter`, `useRuntimeConfig`, `useAsyncData`, etc.).
- **Do not** rename variables, functions, or emit names.
- **Do not** auto-format beyond what's needed for correctness. Keep formatting close to the original.

## DaisyUI MCP is available

If you need reference snippets for any component, call `mcp__daisyui-blueprint__daisyUI-Snippets` with the components you want. Prefer this over guessing.
