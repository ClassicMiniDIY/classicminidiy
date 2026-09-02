#!/usr/bin/env python3
"""
Find local declarations that shadow a Nuxt auto-imported name.

Nuxt's auto-import (unimport) scans a module for declared identifiers and skips
injecting any name it thinks is already provided — it does NOT do scope
analysis. So a single `const ref = ...`, even buried inside a computed()
callback, suppresses `import { ref } from "vue"` for the WHOLE file, and every
ref() at setup scope then throws "ref is not defined" at runtime.

Nothing catches this: the build succeeds, types pass, and the failure is a
runtime ReferenceError. It took the SU needle configurator down completely (see
CLAUDE.md "Rules that apply everywhere" and .claude/rules/vue-resolution.md).

A composable file exporting its own name (useAuth.ts exporting useAuth) is the
definition, not a shadow, and is skipped.

Usage:  python3 scripts/find-shadowed-autoimports.py
Exits 1 on any finding, so it can be wired into CI.
"""
import re
import sys
import pathlib
import subprocess

VUE = """ref computed reactive watch watchEffect shallowRef shallowReactive toRef toRefs unref
isRef readonly nextTick provide inject onMounted onUnmounted onBeforeMount onBeforeUnmount
onUpdated onActivated onDeactivated onErrorCaptured markRaw toRaw customRef effectScope
useSlots useAttrs useTemplateRef useId""".split()
NUXT = """useState useRoute useRouter useFetch useAsyncData useLazyFetch useLazyAsyncData useHead
useSeoMeta useRuntimeConfig useNuxtApp useCookie useRequestHeaders useError navigateTo
createError refreshNuxtData useRequestURL useSchemaOrg useRobotsRule useI18n useLocalePath
useSwitchLocalePath definePageMeta""".split()
localnames = [p.stem for p in pathlib.Path('app/composables').glob('*.ts')]
NAMES = sorted(set(VUE) | set(NUXT) | set(localnames))
alt = '|'.join(map(re.escape, NAMES))

PATTERNS = [
    ('binding',     re.compile(r'\b(?:const|let|var)\s+(' + alt + r')\b\s*[=:]')),
    ('function',    re.compile(r'\bfunction\s+(' + alt + r')\s*\(')),
    ('destructure', re.compile(r'\b(?:const|let|var)\s*[{\[][^}\]]*\b(' + alt + r')\b[^}\]]*[}\]]\s*=')),
    ('param',       re.compile(r'\(\s*(?:[\w:<>\[\]{} ,]*,\s*)?(' + alt + r')\s*(?:[,:)])(?=[^)]*\)\s*(?:=>|\{))')),
]

files = [f for f in subprocess.run(['git','ls-files','app','server','data'],
         capture_output=True, text=True).stdout.split() if f.endswith(('.vue','.ts'))]

real = []
for f in files:
    stem = pathlib.Path(f).stem
    for i, line in enumerate(pathlib.Path(f).read_text().split('\n'), 1):
        s = line.strip()
        if s.startswith(('//','*','/*')):
            continue
        for kind, pat in PATTERNS:
            m = pat.search(line)
            if not m:
                continue
            name = m.group(1)
            # A composable file defining its own export is the definition, not a shadow.
            if name == stem and f.startswith('app/composables/'):
                continue
            real.append((f, i, kind, name, s[:100]))
            break

for f, i, kind, name, s in real:
    print(f'{f}:{i}  ({kind}) [{name}]  {s}')
print(f'\n{len(real)} genuine shadow(s)')
sys.exit(1 if real else 0)
