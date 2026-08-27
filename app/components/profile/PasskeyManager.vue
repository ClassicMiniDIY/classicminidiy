<template>
  <div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <div class="flex items-center">
        <i class="fad fa-fingerprint mr-2"></i>
        <h2 class="text-lg font-semibold">{{ t('title') }}</h2>
      </div>

      <p class="text-sm opacity-70">{{ t('description') }}</p>

      <!-- Unsupported browser. Rendered from a post-mount flag, never from a
           setup-time check: PublicKeyCredential does not exist during SSR. -->
      <div v-if="mounted && !supported" role="status" class="alert alert-info mt-2">
        <i class="fas fa-circle-info"></i>
        <span>{{ t('unsupported') }}</span>
      </div>

      <template v-else-if="mounted">
        <div v-if="loading && !passkeys.length" class="flex justify-center py-6">
          <span class="loading loading-spinner loading-md"></span>
        </div>

        <div v-else-if="!passkeys.length" class="text-sm opacity-60 py-2">
          {{ t('empty') }}
        </div>

        <ul v-else class="divide-y divide-base-300">
          <li v-for="passkey in passkeys" :key="passkey.id" class="py-3 flex items-center gap-3">
            <i class="fad fa-key text-lg opacity-60"></i>

            <div class="grow min-w-0">
              <!-- Rename, inline -->
              <div v-if="renamingId === passkey.id" class="flex items-center gap-2">
                <input
                  ref="renameInput"
                  v-model="renameValue"
                  type="text"
                  maxlength="120"
                  :aria-label="t('name_placeholder')"
                  class="input input-bordered input-sm grow"
                  :placeholder="t('name_placeholder')"
                  :disabled="busyId === passkey.id"
                  @keyup.enter="confirmRename(passkey.id)"
                  @keyup.esc="cancelRename"
                />
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  :disabled="busyId === passkey.id || !renameValue.trim()"
                  @click="confirmRename(passkey.id)"
                >
                  {{ t('save') }}
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  :disabled="busyId === passkey.id"
                  @click="cancelRename"
                >
                  {{ t('cancel') }}
                </button>
              </div>

              <div v-else>
                <p class="font-medium truncate">{{ passkey.friendly_name || t('unnamed') }}</p>
                <p class="text-xs opacity-60">
                  {{ t('added', { date: formatDate(passkey.created_at) }) }}
                  <template v-if="passkey.last_used_at">
                    &middot; {{ t('last_used', { date: formatDate(passkey.last_used_at) }) }}
                  </template>
                </p>
              </div>
            </div>

            <div v-if="renamingId !== passkey.id" class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :aria-label="t('rename')"
                :disabled="busyId === passkey.id"
                @click="startRename(passkey)"
              >
                <i class="fas fa-pen"></i>
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm text-error"
                :aria-label="t('delete')"
                :disabled="busyId === passkey.id"
                @click="confirmDelete(passkey)"
              >
                <i v-if="busyId === passkey.id" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fas fa-trash"></i>
              </button>
            </div>
          </li>
        </ul>

        <div class="mt-2">
          <button
            ref="addButton"
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="registering"
            @click="addPasskey"
          >
            <span v-if="registering" class="loading loading-spinner loading-xs"></span>
            <i v-else class="fas fa-plus"></i>
            {{ t('add') }}
          </button>
        </div>
      </template>

      <!-- Delete confirmation. Deleting a passkey is irreversible, and the
           user may have no other credential enrolled on this device. -->
      <dialog ref="deleteDialog" class="modal" aria-labelledby="passkey-delete-title" @close="pendingDelete = null">
        <div class="modal-box">
          <h3 id="passkey-delete-title" class="text-lg font-bold">{{ t('delete_title') }}</h3>
          <p class="py-4">
            {{ t('delete_confirm', { name: pendingDelete?.friendly_name || t('unnamed') }) }}
          </p>
          <div v-if="passkeys.length === 1" role="alert" class="alert alert-warning">
            <i class="fas fa-triangle-exclamation"></i>
            <span>{{ t('delete_last_warning') }}</span>
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="closeDeleteDialog">{{ t('cancel') }}</button>
            <button type="button" class="btn btn-error" @click="performDelete">{{ t('delete') }}</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>{{ t('cancel') }}</button>
        </form>
      </dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { PasskeyListItem } from '@supabase/supabase-js';

  const { t, locale } = useI18n();
  const toast = useToast();
  const { passkeys, loading, isSupported, listPasskeys, registerPasskey, renamePasskey, deletePasskey } = usePasskeys();

  const mounted = ref(false);
  const supported = ref(false);
  const registering = ref(false);
  const busyId = ref<string | null>(null);
  const renamingId = ref<string | null>(null);
  const renameValue = ref('');
  const pendingDelete = ref<PasskeyListItem | null>(null);
  const deleteDialog = ref<HTMLDialogElement | null>(null);
  const renameInput = ref<HTMLInputElement | null>(null);
  const addButton = ref<HTMLButtonElement | null>(null);

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(locale.value, { year: 'numeric', month: 'short', day: 'numeric' });

  // A default name that tells one device from another in the list. The
  // registration endpoint accepts no name, so this is applied as a follow-up
  // rename inside registerPasskey().
  const defaultName = (): string => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad/i.test(ua)) return 'iPhone / iPad';
    if (/Macintosh/i.test(ua)) return 'Mac';
    if (/Android/i.test(ua)) return 'Android';
    if (/Windows/i.test(ua)) return 'Windows';
    return t('unnamed');
  };

  onMounted(async () => {
    mounted.value = true;
    supported.value = isSupported();
    if (!supported.value) return;
    try {
      await listPasskeys();
    } catch (error: any) {
      console.error('Failed to load passkeys:', error);
      toast.add({ title: t('load_error'), color: 'error', icon: 'fas fa-triangle-exclamation' });
    }
  });

  const addPasskey = async () => {
    registering.value = true;
    try {
      const created = await registerPasskey(defaultName());
      // null means the user dismissed the system prompt. Say nothing.
      if (created) {
        toast.add({ title: t('add_success'), color: 'success', icon: 'fas fa-circle-check' });
      }
    } catch (error: any) {
      console.error('Passkey registration failed:', error);
      toast.add({
        title: t('add_error'),
        description: error?.message,
        color: 'error',
        icon: 'fas fa-triangle-exclamation',
      });
    } finally {
      registering.value = false;
    }
  };

  // Switching to the input unmounts the button that had focus, which would
  // otherwise drop focus to <body> — a keyboard user's next Tab would restart
  // from the top of the page, and nothing would announce the edit mode.
  const startRename = async (passkey: PasskeyListItem) => {
    renamingId.value = passkey.id;
    renameValue.value = passkey.friendly_name ?? '';
    await nextTick();
    renameInput.value?.select();
  };

  const cancelRename = () => {
    renamingId.value = null;
    renameValue.value = '';
  };

  const confirmRename = async (passkeyId: string) => {
    const name = renameValue.value.trim();
    if (!name) return;
    busyId.value = passkeyId;
    try {
      await renamePasskey(passkeyId, name);
      cancelRename();
      toast.add({ title: t('rename_success'), color: 'success', icon: 'fas fa-circle-check' });
    } catch (error: any) {
      console.error('Passkey rename failed:', error);
      toast.add({
        title: t('rename_error'),
        description: error?.message,
        color: 'error',
        icon: 'fas fa-triangle-exclamation',
      });
    } finally {
      busyId.value = null;
    }
  };

  const confirmDelete = (passkey: PasskeyListItem) => {
    pendingDelete.value = passkey;
    deleteDialog.value?.showModal();
  };

  // `close` on the dialog clears pendingDelete for every path, Esc included.
  const closeDeleteDialog = () => {
    deleteDialog.value?.close();
  };

  const performDelete = async () => {
    const passkey = pendingDelete.value;
    if (!passkey) return;
    deleteDialog.value?.close();
    busyId.value = passkey.id;
    try {
      await deletePasskey(passkey.id);
      toast.add({ title: t('delete_success'), color: 'success', icon: 'fas fa-circle-check' });
    } catch (error: any) {
      console.error('Passkey delete failed:', error);
      toast.add({
        title: t('delete_error'),
        description: error?.message,
        color: 'error',
        icon: 'fas fa-triangle-exclamation',
      });
    } finally {
      busyId.value = null;
      pendingDelete.value = null;
      // The row that was focused is gone. Land somewhere real rather than on
      // <body>, which would send the next Tab back to the top of the page.
      await nextTick();
      addButton.value?.focus();
    }
  };
</script>

<i18n lang="json">
{
  "en": {
    "title": "Passkeys",
    "description": "Sign in with Touch ID, Face ID, Windows Hello, or a security key instead of waiting for a magic link.",
    "add": "Add a passkey",
    "empty": "No passkeys yet.",
    "unnamed": "Passkey",
    "added": "Added {date}",
    "last_used": "last used {date}",
    "rename": "Rename passkey",
    "delete": "Delete",
    "save": "Save",
    "cancel": "Cancel",
    "name_placeholder": "Name this passkey",
    "delete_title": "Delete passkey?",
    "delete_confirm": "\"{name}\" will no longer be able to sign you in. This cannot be undone.",
    "delete_last_warning": "This is your last passkey. You will need a magic link or Google or Apple sign in to get back in.",
    "unsupported": "This browser does not support passkeys. Use a magic link or Google or Apple sign in.",
    "load_error": "Could not load your passkeys.",
    "add_success": "Passkey added.",
    "add_error": "Could not add that passkey.",
    "rename_success": "Passkey renamed.",
    "rename_error": "Could not rename that passkey.",
    "delete_success": "Passkey deleted.",
    "delete_error": "Could not delete that passkey."
  },
  "es": {
    "title": "Claves de acceso",
    "description": "Inicia sesión con Touch ID, Face ID, Windows Hello o una llave de seguridad en lugar de esperar un enlace mágico.",
    "add": "Añadir clave de acceso",
    "empty": "Aún no hay claves de acceso.",
    "unnamed": "Clave de acceso",
    "added": "Añadida el {date}",
    "last_used": "usada por última vez el {date}",
    "rename": "Renombrar clave de acceso",
    "delete": "Eliminar",
    "save": "Guardar",
    "cancel": "Cancelar",
    "name_placeholder": "Nombra esta clave de acceso",
    "delete_title": "¿Eliminar clave de acceso?",
    "delete_confirm": "\"{name}\" ya no podrá iniciar tu sesión. Esto no se puede deshacer.",
    "delete_last_warning": "Esta es tu última clave de acceso. Necesitarás un enlace mágico o iniciar sesión con Google o Apple para volver a entrar.",
    "unsupported": "Este navegador no admite claves de acceso. Usa un enlace mágico o inicia sesión con Google o Apple.",
    "load_error": "No se pudieron cargar tus claves de acceso.",
    "add_success": "Clave de acceso añadida.",
    "add_error": "No se pudo añadir esa clave de acceso.",
    "rename_success": "Clave de acceso renombrada.",
    "rename_error": "No se pudo renombrar esa clave de acceso.",
    "delete_success": "Clave de acceso eliminada.",
    "delete_error": "No se pudo eliminar esa clave de acceso."
  },
  "fr": {
    "title": "Clés d'accès",
    "description": "Connectez-vous avec Touch ID, Face ID, Windows Hello ou une clé de sécurité au lieu d'attendre un lien magique.",
    "add": "Ajouter une clé d'accès",
    "empty": "Aucune clé d'accès pour le moment.",
    "unnamed": "Clé d'accès",
    "added": "Ajoutée le {date}",
    "last_used": "dernière utilisation le {date}",
    "rename": "Renommer la clé d'accès",
    "delete": "Supprimer",
    "save": "Enregistrer",
    "cancel": "Annuler",
    "name_placeholder": "Nommez cette clé d'accès",
    "delete_title": "Supprimer la clé d'accès ?",
    "delete_confirm": "\"{name}\" ne pourra plus vous connecter. Cette action est irréversible.",
    "delete_last_warning": "C'est votre dernière clé d'accès. Vous devrez utiliser un lien magique ou la connexion Google ou Apple pour revenir.",
    "unsupported": "Ce navigateur ne prend pas en charge les clés d'accès. Utilisez un lien magique ou la connexion Google ou Apple.",
    "load_error": "Impossible de charger vos clés d'accès.",
    "add_success": "Clé d'accès ajoutée.",
    "add_error": "Impossible d'ajouter cette clé d'accès.",
    "rename_success": "Clé d'accès renommée.",
    "rename_error": "Impossible de renommer cette clé d'accès.",
    "delete_success": "Clé d'accès supprimée.",
    "delete_error": "Impossible de supprimer cette clé d'accès."
  },
  "de": {
    "title": "Passkeys",
    "description": "Melden Sie sich mit Touch ID, Face ID, Windows Hello oder einem Sicherheitsschlüssel an, statt auf einen Magic Link zu warten.",
    "add": "Passkey hinzufügen",
    "empty": "Noch keine Passkeys.",
    "unnamed": "Passkey",
    "added": "Hinzugefügt am {date}",
    "last_used": "zuletzt verwendet am {date}",
    "rename": "Passkey umbenennen",
    "delete": "Löschen",
    "save": "Speichern",
    "cancel": "Abbrechen",
    "name_placeholder": "Diesen Passkey benennen",
    "delete_title": "Passkey löschen?",
    "delete_confirm": "\"{name}\" kann Sie nicht mehr anmelden. Dies kann nicht rückgängig gemacht werden.",
    "delete_last_warning": "Das ist Ihr letzter Passkey. Sie benötigen einen Magic Link oder die Anmeldung mit Google oder Apple, um wieder hineinzukommen.",
    "unsupported": "Dieser Browser unterstützt keine Passkeys. Verwenden Sie einen Magic Link oder die Anmeldung mit Google oder Apple.",
    "load_error": "Ihre Passkeys konnten nicht geladen werden.",
    "add_success": "Passkey hinzugefügt.",
    "add_error": "Dieser Passkey konnte nicht hinzugefügt werden.",
    "rename_success": "Passkey umbenannt.",
    "rename_error": "Dieser Passkey konnte nicht umbenannt werden.",
    "delete_success": "Passkey gelöscht.",
    "delete_error": "Dieser Passkey konnte nicht gelöscht werden."
  },
  "it": {
    "title": "Passkey",
    "description": "Accedi con Touch ID, Face ID, Windows Hello o una chiave di sicurezza invece di attendere un link magico.",
    "add": "Aggiungi una passkey",
    "empty": "Nessuna passkey per ora.",
    "unnamed": "Passkey",
    "added": "Aggiunta il {date}",
    "last_used": "ultimo utilizzo il {date}",
    "rename": "Rinomina passkey",
    "delete": "Elimina",
    "save": "Salva",
    "cancel": "Annulla",
    "name_placeholder": "Assegna un nome a questa passkey",
    "delete_title": "Eliminare la passkey?",
    "delete_confirm": "\"{name}\" non potrà più farti accedere. L'operazione non è reversibile.",
    "delete_last_warning": "Questa è la tua ultima passkey. Ti servirà un link magico o l'accesso con Google o Apple per rientrare.",
    "unsupported": "Questo browser non supporta le passkey. Usa un link magico o l'accesso con Google o Apple.",
    "load_error": "Impossibile caricare le tue passkey.",
    "add_success": "Passkey aggiunta.",
    "add_error": "Impossibile aggiungere quella passkey.",
    "rename_success": "Passkey rinominata.",
    "rename_error": "Impossibile rinominare quella passkey.",
    "delete_success": "Passkey eliminata.",
    "delete_error": "Impossibile eliminare quella passkey."
  },
  "pt": {
    "title": "Chaves de acesso",
    "description": "Entre com Touch ID, Face ID, Windows Hello ou uma chave de segurança em vez de esperar por um link mágico.",
    "add": "Adicionar chave de acesso",
    "empty": "Ainda não há chaves de acesso.",
    "unnamed": "Chave de acesso",
    "added": "Adicionada em {date}",
    "last_used": "usada pela última vez em {date}",
    "rename": "Renomear chave de acesso",
    "delete": "Excluir",
    "save": "Salvar",
    "cancel": "Cancelar",
    "name_placeholder": "Dê um nome a esta chave de acesso",
    "delete_title": "Excluir chave de acesso?",
    "delete_confirm": "\"{name}\" não poderá mais fazer seu login. Isso não pode ser desfeito.",
    "delete_last_warning": "Esta é a sua última chave de acesso. Você precisará de um link mágico ou do login com Google ou Apple para voltar a entrar.",
    "unsupported": "Este navegador não é compatível com chaves de acesso. Use um link mágico ou o login com Google ou Apple.",
    "load_error": "Não foi possível carregar suas chaves de acesso.",
    "add_success": "Chave de acesso adicionada.",
    "add_error": "Não foi possível adicionar essa chave de acesso.",
    "rename_success": "Chave de acesso renomeada.",
    "rename_error": "Não foi possível renomear essa chave de acesso.",
    "delete_success": "Chave de acesso excluída.",
    "delete_error": "Não foi possível excluir essa chave de acesso."
  },
  "ru": {
    "title": "Пароли-ключи",
    "description": "Входите с помощью Touch ID, Face ID, Windows Hello или ключа безопасности вместо ожидания волшебной ссылки.",
    "add": "Добавить пароль-ключ",
    "empty": "Паролей-ключей пока нет.",
    "unnamed": "Пароль-ключ",
    "added": "Добавлен {date}",
    "last_used": "последнее использование {date}",
    "rename": "Переименовать пароль-ключ",
    "delete": "Удалить",
    "save": "Сохранить",
    "cancel": "Отмена",
    "name_placeholder": "Назовите этот пароль-ключ",
    "delete_title": "Удалить пароль-ключ?",
    "delete_confirm": "\"{name}\" больше не сможет выполнять вход. Это действие необратимо.",
    "delete_last_warning": "Это ваш последний пароль-ключ. Для входа вам понадобится волшебная ссылка либо вход через Google или Apple.",
    "unsupported": "Этот браузер не поддерживает пароли-ключи. Используйте волшебную ссылку либо вход через Google или Apple.",
    "load_error": "Не удалось загрузить ваши пароли-ключи.",
    "add_success": "Пароль-ключ добавлен.",
    "add_error": "Не удалось добавить этот пароль-ключ.",
    "rename_success": "Пароль-ключ переименован.",
    "rename_error": "Не удалось переименовать этот пароль-ключ.",
    "delete_success": "Пароль-ключ удалён.",
    "delete_error": "Не удалось удалить этот пароль-ключ."
  },
  "ja": {
    "title": "パスキー",
    "description": "マジックリンクを待たずに、Touch ID、Face ID、Windows Hello、またはセキュリティキーでサインインできます。",
    "add": "パスキーを追加",
    "empty": "パスキーはまだありません。",
    "unnamed": "パスキー",
    "added": "{date} に追加",
    "last_used": "最終使用 {date}",
    "rename": "パスキーの名前を変更",
    "delete": "削除",
    "save": "保存",
    "cancel": "キャンセル",
    "name_placeholder": "このパスキーに名前を付けます",
    "delete_title": "パスキーを削除しますか？",
    "delete_confirm": "「{name}」ではサインインできなくなります。この操作は取り消せません。",
    "delete_last_warning": "これは最後のパスキーです。再度サインインするには、マジックリンクまたは Google か Apple でのサインインが必要です。",
    "unsupported": "このブラウザはパスキーに対応していません。マジックリンク、または Google か Apple でサインインしてください。",
    "load_error": "パスキーを読み込めませんでした。",
    "add_success": "パスキーを追加しました。",
    "add_error": "そのパスキーを追加できませんでした。",
    "rename_success": "パスキーの名前を変更しました。",
    "rename_error": "そのパスキーの名前を変更できませんでした。",
    "delete_success": "パスキーを削除しました。",
    "delete_error": "そのパスキーを削除できませんでした。"
  },
  "zh": {
    "title": "通行密钥",
    "description": "使用 Touch ID、Face ID、Windows Hello 或安全密钥登录，无需等待魔法链接。",
    "add": "添加通行密钥",
    "empty": "尚无通行密钥。",
    "unnamed": "通行密钥",
    "added": "添加于 {date}",
    "last_used": "上次使用 {date}",
    "rename": "重命名通行密钥",
    "delete": "删除",
    "save": "保存",
    "cancel": "取消",
    "name_placeholder": "为此通行密钥命名",
    "delete_title": "删除通行密钥？",
    "delete_confirm": "“{name}”将无法再为您登录。此操作无法撤销。",
    "delete_last_warning": "这是您最后一个通行密钥。您将需要魔法链接或使用 Google 或 Apple 登录才能重新进入。",
    "unsupported": "此浏览器不支持通行密钥。请使用魔法链接或通过 Google 或 Apple 登录。",
    "load_error": "无法加载您的通行密钥。",
    "add_success": "已添加通行密钥。",
    "add_error": "无法添加该通行密钥。",
    "rename_success": "已重命名通行密钥。",
    "rename_error": "无法重命名该通行密钥。",
    "delete_success": "已删除通行密钥。",
    "delete_error": "无法删除该通行密钥。"
  },
  "ko": {
    "title": "패스키",
    "description": "매직 링크를 기다리지 않고 Touch ID, Face ID, Windows Hello 또는 보안 키로 로그인하세요.",
    "add": "패스키 추가",
    "empty": "아직 패스키가 없습니다.",
    "unnamed": "패스키",
    "added": "{date}에 추가됨",
    "last_used": "마지막 사용 {date}",
    "rename": "패스키 이름 변경",
    "delete": "삭제",
    "save": "저장",
    "cancel": "취소",
    "name_placeholder": "이 패스키의 이름을 지정하세요",
    "delete_title": "패스키를 삭제할까요?",
    "delete_confirm": "\"{name}\"(으)로는 더 이상 로그인할 수 없습니다. 이 작업은 취소할 수 없습니다.",
    "delete_last_warning": "마지막 패스키입니다. 다시 로그인하려면 매직 링크 또는 Google이나 Apple 로그인이 필요합니다.",
    "unsupported": "이 브라우저는 패스키를 지원하지 않습니다. 매직 링크 또는 Google이나 Apple 로그인을 사용하세요.",
    "load_error": "패스키를 불러오지 못했습니다.",
    "add_success": "패스키가 추가되었습니다.",
    "add_error": "해당 패스키를 추가하지 못했습니다.",
    "rename_success": "패스키 이름이 변경되었습니다.",
    "rename_error": "해당 패스키의 이름을 변경하지 못했습니다.",
    "delete_success": "패스키가 삭제되었습니다.",
    "delete_error": "해당 패스키를 삭제하지 못했습니다."
  }
}
</i18n>
