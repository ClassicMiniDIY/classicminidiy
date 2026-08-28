<script setup lang="ts">
  /**
   * Per-client MCP setup accordion — one snippet per major AI client plus a
   * generic fallback, each with a copy button and a suggested first prompt.
   * Shared by /developers and /dashboard/api-keys; the section chrome (eyebrow,
   * heading, card) belongs to the page, this component is just the accordion.
   *
   * Snippets carry a cmdiy_YOUR_KEY placeholder — keys are minted at
   * /dashboard/api-keys and pasted in. Product names and code are deliberately
   * untranslated; the surrounding copy lives in the i18n block below.
   */
  const { t } = useI18n();
  const toast = useToast();

  // Radio group name must be unique per accordion instance (daisyUI accordions
  // are radio-driven); useId() keeps it stable across SSR and hydration.
  const accordionName = `mcp-client-${useId()}`;

  // Icons: real Font Awesome brand glyphs where the kit (FA 7.3.1) ships them,
  // in their brand color (fixed colors are allowed for external brand marks).
  // Verified against the kit CDN: fa-claude and fa-copilot exist; Cursor and
  // VS Code have NO brand glyph in 7.3.1, so those two use neutral stand-ins —
  // re-probe before "fixing" them to fab classes, a missing glyph renders as a
  // silently empty element.
  const clients = [
    {
      key: 'claude_code',
      title: 'Claude Code',
      icon: 'fab fa-claude text-[#D97757]',
      snippet: `claude mcp add --transport http classic-mini-diy https://classicminidiy.com/mcp \\
  --header "Authorization: Bearer cmdiy_YOUR_KEY"`,
    },
    {
      key: 'claude_desktop',
      title: 'Claude Desktop',
      icon: 'fab fa-claude text-[#D97757]',
      snippet: `{
  "mcpServers": {
    "classic-mini-diy": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://classicminidiy.com/mcp",
        "--header", "Authorization: Bearer cmdiy_YOUR_KEY"
      ]
    }
  }
}`,
    },
    {
      key: 'cursor',
      title: 'Cursor',
      icon: 'fas fa-arrow-pointer opacity-80',
      snippet: `{
  "mcpServers": {
    "classic-mini-diy": {
      "url": "https://classicminidiy.com/mcp",
      "headers": {
        "Authorization": "Bearer cmdiy_YOUR_KEY"
      }
    }
  }
}`,
    },
    {
      key: 'vscode',
      title: 'VS Code (Copilot)',
      icon: 'fab fa-copilot opacity-80',
      snippet: `{
  "servers": {
    "classic-mini-diy": {
      "type": "http",
      "url": "https://classicminidiy.com/mcp",
      "headers": {
        "Authorization": "Bearer cmdiy_YOUR_KEY"
      }
    }
  }
}`,
    },
    {
      key: 'generic',
      title: 'Any MCP client',
      icon: 'fas fa-plug opacity-70',
      snippet: `curl -X POST https://classicminidiy.com/mcp \\
  -H "Authorization: Bearer cmdiy_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
    },
  ];

  const copySnippet = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.add({ title: t('copied'), color: 'success', icon: 'fas fa-circle-check' });
    } catch {
      toast.add({ title: t('copy_error'), color: 'error', icon: 'fas fa-triangle-exclamation' });
    }
  };
</script>

<template>
  <div>
    <div class="join join-vertical w-full bg-base-100">
      <div
        v-for="(client, index) in clients"
        :key="client.key"
        class="collapse collapse-arrow join-item border border-base-300"
      >
        <input type="radio" :name="accordionName" :checked="index === 0" :aria-label="client.title" />
        <div class="collapse-title font-semibold">
          <i :class="client.icon" class="mr-2" aria-hidden="true"></i>{{ client.title }}
        </div>
        <div class="collapse-content text-sm">
          <p class="opacity-70">{{ t(`items.${client.key}.desc`) }}</p>
          <div class="relative mt-3">
            <pre
              class="bg-base-200 rounded-box p-4 pr-14 text-xs leading-relaxed overflow-x-auto"
            ><code>{{ client.snippet }}</code></pre>
            <button
              type="button"
              class="btn btn-square btn-sm absolute top-2 right-2"
              :aria-label="t('copy')"
              @click="copySnippet(client.snippet)"
            >
              <i class="fas fa-copy" aria-hidden="true"></i>
            </button>
          </div>
          <p class="mt-3 text-xs opacity-60">
            <i class="fas fa-wand-magic-sparkles mr-1" aria-hidden="true"></i>
            {{ t('try_prompt') }}
            <span class="italic">“{{ t('example_prompt') }}”</span>
          </p>
        </div>
      </div>
    </div>

    <p class="text-center text-xs opacity-60 mt-4">{{ t('key_note') }}</p>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "copy": "Copy",
    "copied": "Copied to clipboard.",
    "copy_error": "Could not copy. Select the text and copy it manually.",
    "items": {
      "claude_code": { "desc": "Run this in your terminal — one command registers the server for all your sessions." },
      "claude_desktop": { "desc": "Add this to claude_desktop_config.json (Settings → Developer → Edit Config), then restart Claude Desktop." },
      "cursor": { "desc": "Add this to .cursor/mcp.json in your project, or to ~/.cursor/mcp.json for every project." },
      "vscode": { "desc": "Add this to .vscode/mcp.json, then start the server from the MCP panel." },
      "generic": { "desc": "Any client that speaks MCP over streamable HTTP works. This curl verifies your key and lists the tools." }
    },
    "try_prompt": "Then try asking:",
    "example_prompt": "What torque do my cylinder head nuts need, and what compression ratio does a 21.4cc head give my 1275?",
    "key_note": "Every snippet uses the placeholder cmdiy_YOUR_KEY. Keys are shown once at creation — paste yours in right away."
  },
  "es": {
    "copy": "Copiar",
    "copied": "Copiado al portapapeles.",
    "copy_error": "No se pudo copiar. Selecciona el texto y cópialo manualmente.",
    "items": {
      "claude_code": { "desc": "Ejecuta esto en tu terminal: un solo comando registra el servidor para todas tus sesiones." },
      "claude_desktop": { "desc": "Añade esto a claude_desktop_config.json (Ajustes → Desarrollador → Editar configuración) y reinicia Claude Desktop." },
      "cursor": { "desc": "Añade esto a .cursor/mcp.json en tu proyecto, o a ~/.cursor/mcp.json para todos los proyectos." },
      "vscode": { "desc": "Añade esto a .vscode/mcp.json y luego inicia el servidor desde el panel MCP." },
      "generic": { "desc": "Funciona cualquier cliente que hable MCP sobre HTTP streamable. Este curl verifica tu clave y lista las herramientas." }
    },
    "try_prompt": "Luego prueba a preguntar:",
    "example_prompt": "¿Qué par necesitan las tuercas de mi culata y qué relación de compresión da una culata de 21,4 cc en mi 1275?",
    "key_note": "Cada fragmento usa el marcador cmdiy_YOUR_KEY. Las claves se muestran una sola vez al crearlas: pega la tuya de inmediato."
  },
  "fr": {
    "copy": "Copier",
    "copied": "Copié dans le presse-papiers.",
    "copy_error": "Copie impossible. Sélectionnez le texte et copiez-le manuellement.",
    "items": {
      "claude_code": { "desc": "Exécutez ceci dans votre terminal — une seule commande enregistre le serveur pour toutes vos sessions." },
      "claude_desktop": { "desc": "Ajoutez ceci à claude_desktop_config.json (Réglages → Développeur → Modifier la configuration), puis redémarrez Claude Desktop." },
      "cursor": { "desc": "Ajoutez ceci à .cursor/mcp.json dans votre projet, ou à ~/.cursor/mcp.json pour tous les projets." },
      "vscode": { "desc": "Ajoutez ceci à .vscode/mcp.json, puis démarrez le serveur depuis le panneau MCP." },
      "generic": { "desc": "Tout client parlant MCP en HTTP streamable fonctionne. Ce curl vérifie votre clé et liste les outils." }
    },
    "try_prompt": "Puis essayez de demander :",
    "example_prompt": "Quel couple pour mes écrous de culasse, et quel taux de compression donne une culasse de 21,4 cc sur mon 1275 ?",
    "key_note": "Chaque extrait utilise l'espace réservé cmdiy_YOUR_KEY. Les clés ne s'affichent qu'une fois à la création — collez la vôtre immédiatement."
  },
  "de": {
    "copy": "Kopieren",
    "copied": "In die Zwischenablage kopiert.",
    "copy_error": "Kopieren nicht möglich. Markieren Sie den Text und kopieren Sie ihn manuell.",
    "items": {
      "claude_code": { "desc": "Im Terminal ausführen — ein Befehl registriert den Server für alle Ihre Sitzungen." },
      "claude_desktop": { "desc": "In claude_desktop_config.json eintragen (Einstellungen → Entwickler → Konfiguration bearbeiten), dann Claude Desktop neu starten." },
      "cursor": { "desc": "In .cursor/mcp.json im Projekt eintragen, oder in ~/.cursor/mcp.json für alle Projekte." },
      "vscode": { "desc": "In .vscode/mcp.json eintragen und den Server dann über das MCP-Panel starten." },
      "generic": { "desc": "Jeder Client mit MCP über Streamable HTTP funktioniert. Dieses curl prüft Ihren Schlüssel und listet die Tools." }
    },
    "try_prompt": "Dann fragen Sie zum Beispiel:",
    "example_prompt": "Welches Drehmoment brauchen meine Zylinderkopfmuttern, und welches Verdichtungsverhältnis ergibt ein 21,4-ccm-Kopf bei meinem 1275?",
    "key_note": "Jedes Snippet nutzt den Platzhalter cmdiy_YOUR_KEY. Schlüssel werden nur einmal bei der Erstellung angezeigt — fügen Sie Ihren sofort ein."
  },
  "it": {
    "copy": "Copia",
    "copied": "Copiato negli appunti.",
    "copy_error": "Impossibile copiare. Seleziona il testo e copialo manualmente.",
    "items": {
      "claude_code": { "desc": "Esegui questo nel terminale: un solo comando registra il server per tutte le tue sessioni." },
      "claude_desktop": { "desc": "Aggiungi questo a claude_desktop_config.json (Impostazioni → Sviluppatore → Modifica configurazione), poi riavvia Claude Desktop." },
      "cursor": { "desc": "Aggiungi questo a .cursor/mcp.json nel progetto, o a ~/.cursor/mcp.json per tutti i progetti." },
      "vscode": { "desc": "Aggiungi questo a .vscode/mcp.json, poi avvia il server dal pannello MCP." },
      "generic": { "desc": "Funziona qualsiasi client che parla MCP su HTTP streamable. Questo curl verifica la tua chiave ed elenca gli strumenti." }
    },
    "try_prompt": "Poi prova a chiedere:",
    "example_prompt": "Che coppia servono i dadi della mia testata, e che rapporto di compressione dà una testata da 21,4 cc sul mio 1275?",
    "key_note": "Ogni snippet usa il segnaposto cmdiy_YOUR_KEY. Le chiavi si mostrano una sola volta alla creazione: incolla subito la tua."
  },
  "pt": {
    "copy": "Copiar",
    "copied": "Copiado para a área de transferência.",
    "copy_error": "Não foi possível copiar. Selecione o texto e copie manualmente.",
    "items": {
      "claude_code": { "desc": "Execute isto no terminal — um único comando registra o servidor para todas as suas sessões." },
      "claude_desktop": { "desc": "Adicione isto ao claude_desktop_config.json (Configurações → Desenvolvedor → Editar configuração) e reinicie o Claude Desktop." },
      "cursor": { "desc": "Adicione isto ao .cursor/mcp.json do projeto, ou ao ~/.cursor/mcp.json para todos os projetos." },
      "vscode": { "desc": "Adicione isto ao .vscode/mcp.json e inicie o servidor pelo painel MCP." },
      "generic": { "desc": "Qualquer cliente que fale MCP sobre HTTP streamable funciona. Este curl verifica sua chave e lista as ferramentas." }
    },
    "try_prompt": "Depois experimente perguntar:",
    "example_prompt": "Qual torque as porcas do meu cabeçote precisam, e qual taxa de compressão um cabeçote de 21,4 cc dá no meu 1275?",
    "key_note": "Cada trecho usa o marcador cmdiy_YOUR_KEY. As chaves aparecem uma única vez na criação — cole a sua imediatamente."
  },
  "ru": {
    "copy": "Копировать",
    "copied": "Скопировано в буфер обмена.",
    "copy_error": "Не удалось скопировать. Выделите текст и скопируйте вручную.",
    "items": {
      "claude_code": { "desc": "Выполните в терминале — одна команда регистрирует сервер для всех ваших сессий." },
      "claude_desktop": { "desc": "Добавьте это в claude_desktop_config.json (Настройки → Разработчик → Изменить конфигурацию) и перезапустите Claude Desktop." },
      "cursor": { "desc": "Добавьте это в .cursor/mcp.json проекта или в ~/.cursor/mcp.json для всех проектов." },
      "vscode": { "desc": "Добавьте это в .vscode/mcp.json и запустите сервер из панели MCP." },
      "generic": { "desc": "Подойдёт любой клиент, говорящий на MCP по streamable HTTP. Этот curl проверяет ключ и выводит список инструментов." }
    },
    "try_prompt": "Затем попробуйте спросить:",
    "example_prompt": "Какой момент затяжки нужен гайкам моей головки блока и какую степень сжатия даст головка 21,4 см³ на моём 1275?",
    "key_note": "В каждом фрагменте стоит заполнитель cmdiy_YOUR_KEY. Ключ показывается один раз при создании — сразу вставьте свой."
  },
  "ja": {
    "copy": "コピー",
    "copied": "クリップボードにコピーしました。",
    "copy_error": "コピーできませんでした。テキストを選択して手動でコピーしてください。",
    "items": {
      "claude_code": { "desc": "ターミナルで実行してください — 1つのコマンドですべてのセッションにサーバーが登録されます。" },
      "claude_desktop": { "desc": "claude_desktop_config.json（設定 → 開発者 → 構成を編集）に追加し、Claude Desktop を再起動してください。" },
      "cursor": { "desc": "プロジェクトの .cursor/mcp.json、または全プロジェクト共通の ~/.cursor/mcp.json に追加してください。" },
      "vscode": { "desc": ".vscode/mcp.json に追加し、MCP パネルからサーバーを起動してください。" },
      "generic": { "desc": "Streamable HTTP で MCP を話せるクライアントなら何でも使えます。この curl でキーを確認し、ツール一覧を取得できます。" }
    },
    "try_prompt": "続いて、こう聞いてみてください：",
    "example_prompt": "シリンダーヘッドナットの締め付けトルクは？ 21.4cc のヘッドだと私の 1275 の圧縮比はいくつ？",
    "key_note": "各スニペットにはプレースホルダー cmdiy_YOUR_KEY が入っています。キーは作成時に一度だけ表示されます — すぐに貼り付けてください。"
  },
  "zh": {
    "copy": "复制",
    "copied": "已复制到剪贴板。",
    "copy_error": "无法复制。请选中文本手动复制。",
    "items": {
      "claude_code": { "desc": "在终端中运行——一条命令即可为所有会话注册该服务器。" },
      "claude_desktop": { "desc": "将其添加到 claude_desktop_config.json（设置 → 开发者 → 编辑配置），然后重启 Claude Desktop。" },
      "cursor": { "desc": "添加到项目的 .cursor/mcp.json，或添加到 ~/.cursor/mcp.json 以作用于所有项目。" },
      "vscode": { "desc": "添加到 .vscode/mcp.json，然后从 MCP 面板启动服务器。" },
      "generic": { "desc": "任何支持 streamable HTTP 的 MCP 客户端都可以。此 curl 可验证密钥并列出工具。" }
    },
    "try_prompt": "然后试着问：",
    "example_prompt": "我的缸盖螺母需要多大扭矩？21.4cc 缸盖能让我的 1275 达到多少压缩比？",
    "key_note": "每个片段都使用占位符 cmdiy_YOUR_KEY。密钥仅在创建时显示一次——请立即粘贴您的密钥。"
  },
  "ko": {
    "copy": "복사",
    "copied": "클립보드에 복사되었습니다.",
    "copy_error": "복사할 수 없습니다. 텍스트를 선택해 직접 복사하세요.",
    "items": {
      "claude_code": { "desc": "터미널에서 실행하세요 — 명령 하나로 모든 세션에 서버가 등록됩니다." },
      "claude_desktop": { "desc": "claude_desktop_config.json(설정 → 개발자 → 구성 편집)에 추가한 뒤 Claude Desktop을 재시작하세요." },
      "cursor": { "desc": "프로젝트의 .cursor/mcp.json에 추가하거나, 모든 프로젝트에 적용하려면 ~/.cursor/mcp.json에 추가하세요." },
      "vscode": { "desc": ".vscode/mcp.json에 추가한 뒤 MCP 패널에서 서버를 시작하세요." },
      "generic": { "desc": "Streamable HTTP로 MCP를 지원하는 클라이언트라면 무엇이든 됩니다. 이 curl로 키를 확인하고 도구 목록을 가져올 수 있습니다." }
    },
    "try_prompt": "그다음 이렇게 물어보세요:",
    "example_prompt": "실린더 헤드 너트의 토크는 얼마이고, 21.4cc 헤드면 내 1275의 압축비는 얼마나 되나요?",
    "key_note": "모든 스니펫은 자리표시자 cmdiy_YOUR_KEY를 사용합니다. 키는 생성 시 한 번만 표시되니 바로 붙여넣으세요."
  }
}
</i18n>
