/**
 * Kairon Quick Capture — Zero-friction task input
 * Swipe up or press "n" → type → enter → done. No forms.
 */

export class QuickCapture {
  constructor(onAdd) {
    this.onAdd = onAdd; // callback: (task) => void
    this._setupGlobalShortcut();
  }

  _setupGlobalShortcut() {
    // Already handled in main app via "n" key
  }

  renderInboxBar() {
    return `
      <div id="quickCapture" class="fixed bottom-20 left-4 right-4 z-30 hidden">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 flex gap-2 items-center">
          <input type="text" id="quickInput" 
            class="flex-1 bg-transparent border-none outline-none text-sm placeholder-gray-400"
            placeholder="Quick add task... (press Enter)"
            onkeydown="if(event.key==='Enter')quickAdd();if(event.key==='Escape')hideQuickCapture();">
          <button onclick="quickAdd()" class="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg font-bold">Add</button>
          <button onclick="hideQuickCapture()" class="p-1 text-gray-400 hover:text-gray-600">✕</button>
        </div>
      </div>
    `;
  }

  show() {
    const el = document.getElementById("quickCapture");
    if (el) {
      el.classList.remove("hidden");
      document.getElementById("quickInput")?.focus();
    }
  }

  hide() {
    const el = document.getElementById("quickCapture");
    if (el) el.classList.add("hidden");
  }

  getInput() {
    return document.getElementById("quickInput")?.value?.trim() || "";
  }

  clear() {
    const input = document.getElementById("quickInput");
    if (input) input.value = "";
  }
}
