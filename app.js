import PortID from "@harboria-labs/portid-js-sdk";

document.addEventListener("DOMContentLoaded", () => {
  // --- SDK SETUP ---
  const sdk = new PortID("kairon-v1", "https://kairon-eta.vercel.app");

  // --- KAIRON'S OWN DATABASE FOR APP DATA ---
  const db = new Dexie("KaironAppCache");
  db.version(1).stores({
    tasks: "++id, status, category, priority, dueDateTime",
    interests: "++id",
    settings: "key",
    inspirations: "++id",
  });

  // ---- STATE MANAGEMENT ---- //
  let tasks = [];
  let settings = {};
  let interests = [];
  let inspirations = [];
  let calendarInstance = null;
  let sortableInstance = null;
  let currentSubtasks = [];

  // ---- CONSTANTS & CONFIG ---- //
  const themeColors = {
    purple: {
      from: "#667eea",
      to: "#764ba2",
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    blue: {
      from: "#3b82f6",
      to: "#1e40af",
      gradient: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
    },
    green: {
      from: "#10b981",
      to: "#047857",
      gradient: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
    },
    red: {
      from: "#ef4444",
      to: "#b91c1c",
      gradient: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
    },
    orange: {
      from: "#f97316",
      to: "#c2410c",
      gradient: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)",
    },
  };
  const darkModes = [
    {
      name: "soft",
      bg: "#1e293b",
      card: "#334155",
      input: "#475569",
      text: "#e2e8f0",
      border: "#475569",
    },
    {
      name: "normal",
      bg: "#0f172a",
      card: "#1e293b",
      input: "#334155",
      text: "#e2e8f0",
      border: "#475569",
    },
    {
      name: "deep",
      bg: "#020617",
      card: "#0f172a",
      input: "#1e293b",
      text: "#e2e8f0",
      border: "#334155",
    },
  ];

  // ---- INITIALIZATION ---- //
  async function init() {
    await loadData();
    setupEventListeners();
    renderAppLayout();
    showPage(settings.defaultView || "today");
    updateTime();
    setInterval(updateTime, 1000);

    if (settings.theme === "dark") {
      document.body.classList.add("dark");
      document.getElementById("sunIcon").classList.add("hidden");
      document.getElementById("moonIcon").classList.remove("hidden");
      applyDarkMode(darkModes[settings.darkIntensity || 1]);
    }
    updateThemeColor(settings.themeColor || "purple");

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => console.log("ServiceWorker registration successful."))
          .catch((err) =>
            console.log("ServiceWorker registration failed: ", err)
          );
      });
    }
  }

  // ---- DATA PERSISTENCE ---- //
  async function loadData() {
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) return;

    const defaultSettings = {
      defaultView: "today",
      notifications: "all",
      theme: "light",
      location: "Naaldwijk",
      themeColor: "purple",
      darkIntensity: 1,
    };

    const [loadedTasks, loadedInterests, loadedSettings, loadedInspirations] =
      await Promise.all([
        db.tasks.where("userId").equals(currentUser).toArray(),
        db.interests.where("userId").equals(currentUser).toArray(),
        db.settings.get(`${currentUser}_settings`),
        db.inspirations.where("userId").equals(currentUser).toArray(),
      ]);

    tasks = loadedTasks;
    interests = loadedInterests;
    inspirations = loadedInspirations;
    settings = loadedSettings
      ? { ...defaultSettings, ...loadedSettings.value }
      : defaultSettings;
  }

  // ---- UI RENDERING & LAYOUT ---- //
  function renderAppLayout() {
    const appContainer = document.getElementById("app");
    if (appContainer) {
      appContainer.innerHTML = `
                <div id="todayPage" class="max-w-6xl mx-auto hidden"></div>
                <div id="tasksPage" class="max-w-6xl mx-auto hidden"></div>
                <div id="calendarPage" class="max-w-6xl mx-auto hidden"></div>
                <div id="analyticsPage" class="max-w-6xl mx-auto hidden"></div>
                <div id="settingsPage" class="max-w-6xl mx-auto hidden"></div>
            `;
    }
  }

  function showPage(pageId) {
    [
      "todayPage",
      "tasksPage",
      "calendarPage",
      "analyticsPage",
      "settingsPage",
    ].forEach((id) => {
      const pageEl = document.getElementById(id);
      if (pageEl) pageEl.style.display = "none";
    });
    const targetPage = document.getElementById(`${pageId}Page`);
    if (targetPage) {
      targetPage.style.display = "block";
      renderPageContent(pageId);
    }
    updateFabVisibility(pageId);
  }

  function renderPageContent(pageId) {
    const pageContainer = document.getElementById(`${pageId}Page`);
    if (!pageContainer) return;
    let html = "";
    switch (pageId) {
      case "today":
        html = getTodayPageHTML();
        pageContainer.innerHTML = html;
        renderTodayPage();
        break;
      case "tasks":
        html = getTasksPageHTML();
        pageContainer.innerHTML = html;
        renderTasks();
        updateFilters();
        break;
      case "calendar":
        html = getCalendarPageHTML();
        pageContainer.innerHTML = html;
        renderCalendar();
        break;
      case "analytics":
        html = getAnalyticsPageHTML();
        pageContainer.innerHTML = html;
        updateAnalytics();
        break;
      case "settings":
        html = getSettingsPageHTML();
        pageContainer.innerHTML = html;
        loadSettings();
        renderMyInspirations();
        break;
    }
  }

  // ---- THEME & UI HELPERS ---- //
  function updateThemeColor(color) {
    settings.themeColor = color;
    const selectedTheme = themeColors[color];
    if (!selectedTheme) return;
    document
      .querySelectorAll("#fab, #interestFab, .bg-gradient-to-r")
      .forEach((el) => {
        if (el) el.style.background = selectedTheme.gradient;
      });
    const darkIntensitySlider = document.getElementById("darkIntensity");
    if (darkIntensitySlider) {
      darkIntensitySlider.style.accentColor = selectedTheme.from;
    }
  }

  window.updateDarkIntensityPreview = function (value) {
    const labels = ["Soft", "Normal", "Deep"];
    const intensityLabel = document.getElementById("intensityLabel");
    if (intensityLabel) intensityLabel.textContent = labels[value];
    settings.darkIntensity = parseInt(value);
    if (document.body.classList.contains("dark"))
      applyDarkMode(darkModes[value]);
  };

  function applyDarkMode(mode) {
    if (!mode) return;
    document.body.style.backgroundColor = mode.bg;
    document.body.style.color = mode.text;
    document
      .querySelectorAll(".card, .side-menu, .fixed.top-0, .filter-panel")
      .forEach((el) => {
        if (el && !el.style.background.includes("gradient"))
          el.style.backgroundColor = mode.card;
      });
    document.querySelectorAll(".bg-gray-50").forEach((el) => {
      if (el) el.style.backgroundColor = mode.input;
    });
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      if (el) {
        el.style.backgroundColor = mode.input;
        el.style.color = mode.text;
        el.style.borderColor = mode.border;
      }
    });
  }

  function removeDarkMode() {
    document.body.style.backgroundColor = "";
    document.body.style.color = "";
    document
      .querySelectorAll(
        ".card, .side-menu, .fixed.top-0, .filter-panel, .bg-gray-50, input, select, textarea"
      )
      .forEach((el) => {
        if (el) {
          el.style.backgroundColor = "";
          el.style.color = "";
          el.style.borderColor = "";
        }
      });
  }

  function updateTime() {
    const now = new Date();
    const timeEl = document.getElementById("currentTime");
    if (timeEl)
      timeEl.textContent = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
  }

  function updateFabVisibility(pageId) {
    const taskFab = document.getElementById("fab");
    const interestFab = document.getElementById("interestFab");
    if (!taskFab || !interestFab) return;
    taskFab.classList.add("hidden");
    interestFab.classList.add("hidden");
    if (pageId === "tasks") taskFab.classList.remove("hidden");
    else if (pageId === "today") interestFab.classList.remove("hidden");
  }

  function encryptData(data, secretKey) {
    const dataString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(dataString, secretKey).toString();
  }

  function decryptData(encryptedData, secretKey) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  }

  function showNotification(title, message) {
    const container = document.getElementById("notificationContainer");
    if (!container) return;
    const notification = document.createElement("div");
    notification.className =
      "notification bg-white rounded-lg shadow-lg p-4 border-l-4 border-purple-600";
    notification.innerHTML = `<h4 class="font-semibold">${title}</h4><p class="text-sm text-gray-600">${message}</p>`;
    container.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
  }

  function formatTimeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const seconds = Math.floor((now - past) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    if (years > 0)
      return years + (years > 1 ? " years overdue" : " year overdue");
    if (months > 0)
      return months + (months > 1 ? " months overdue" : " month overdue");
    if (days > 0) return days + (days > 1 ? " days overdue" : " day overdue");
    if (hours > 0)
      return hours + (hours > 1 ? " hours overdue" : " hour overdue");
    if (minutes > 0)
      return minutes + (minutes > 1 ? " mins overdue" : " min overdue");
    return "Just now overdue";
  }

  // ---- EVENT LISTENERS ---- //
  function setupEventListeners() {
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle)
      themeToggle.addEventListener("click", async () => {
        const isDark = document.body.classList.toggle("dark");
        document.getElementById("sunIcon").classList.toggle("hidden", isDark);
        document.getElementById("moonIcon").classList.toggle("hidden", !isDark);
        settings.theme = isDark ? "dark" : "light";
        await window.saveSettings();
        if (isDark) applyDarkMode(darkModes[settings.darkIntensity || 1]);
        else removeDarkMode();
      });

    const menuBtn = document.getElementById("menuBtn");
    if (menuBtn)
      menuBtn.addEventListener("click", () =>
        document.getElementById("sideMenu").classList.add("open")
      );

    const closeMenuBtn = document.getElementById("closeMenuBtn");
    if (closeMenuBtn)
      closeMenuBtn.addEventListener("click", () =>
        document.getElementById("sideMenu").classList.remove("open")
      );

    document.addEventListener("click", (e) => {
      const menu = document.getElementById("sideMenu");
      const menuBtn = document.getElementById("menuBtn");
      if (
        menu &&
        menuBtn &&
        menu.classList.contains("open") &&
        !menu.contains(e.target) &&
        !menuBtn.contains(e.target)
      ) {
        menu.classList.remove("open");
      }
    });

    document.querySelectorAll(".menu-item").forEach((item) => {
      item.addEventListener("click", () => {
        showPage(item.dataset.view);
        document.getElementById("sideMenu").classList.remove("open");
      });
    });

    document.addEventListener("keydown", (e) => {
      const activeElement = document.activeElement;
      const isTyping =
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA";
      if (e.key === "Escape") {
        closeTaskForm();
        closeEditModal();
      }
      if (e.key.toLowerCase() === "n" && !isTyping) {
        e.preventDefault();
        openTaskForm();
      }
      if (e.key.toLowerCase() === "f" && !isTyping) {
        e.preventDefault();
        const searchInput = document.getElementById("searchInput");
        if (searchInput) searchInput.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        const addTaskForm = document.querySelector("#taskForm");
        const editTaskModal = document.querySelector("#editTaskModal");
        if (addTaskForm && !addTaskForm.classList.contains("hidden")) {
          e.preventDefault();
          addTaskForm.requestSubmit();
        }
        if (editTaskModal && !editTaskModal.classList.contains("hidden")) {
          e.preventDefault();
          document.getElementById("editTaskForm").requestSubmit();
        }
      }
    });

    const fab = document.getElementById("fab");
    if (fab) {
      fab.addEventListener("click", openTaskForm);
    }

    const interestFab = document.getElementById("interestFab");
    if (interestFab) {
      interestFab.addEventListener("click", showInterestFormFab);
    }
  }

  // ---- SUB-TASK & NOTIFICATION HELPERS ---- //
  window.renderCurrentSubtasks = (formType) => {
    const container = document.getElementById(`${formType}SubtasksContainer`);
    if (!container) return;
    container.innerHTML = currentSubtasks
      .map(
        (subtask, index) => `
            <div class="flex items-center justify-between p-2 rounded-md ${
              subtask.completed ? "bg-gray-100" : ""
            }">
                <label class="flex items-center gap-2 flex-1 cursor-pointer ${
                  subtask.completed ? "subtask-completed" : ""
                }">
                    <input type="checkbox" ${
                      subtask.completed ? "checked" : ""
                    } onchange="handleToggleSubtask(${index}, '${formType}')">
                    <span>${subtask.text}</span>
                </label>
                <button type="button" onclick="handleDeleteSubtask(${index}, '${formType}')" class="p-1 text-red-500 hover:bg-red-100 rounded-full">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
        `
      )
      .join("");
  };
  window.handleAddSubtask = (formType) => {
    const input = document.getElementById(`${formType}SubtaskInput`);
    if (input && input.value.trim()) {
      currentSubtasks.push({ text: input.value.trim(), completed: false });
      input.value = "";
      renderCurrentSubtasks(formType);
    }
  };
  window.handleToggleSubtask = (index, formType) => {
    currentSubtasks[index].completed = !currentSubtasks[index].completed;
    renderCurrentSubtasks(formType);
  };
  window.handleDeleteSubtask = (index, formType) => {
    currentSubtasks.splice(index, 1);
    renderCurrentSubtasks(formType);
  };

  function requestNotificationPermission() {
    return new Promise((resolve, reject) => {
      if (!("Notification" in window)) {
        alert("This browser does not support desktop notification");
        return reject();
      }
      if (Notification.permission === "granted") return resolve();
      if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") resolve();
          else reject();
        });
      } else {
        reject();
      }
    });
  }

  window.handleReminderChange = function (selectElement) {
    const reminderValue = selectElement.value;
    if (reminderValue !== "none" && Notification.permission === "default") {
      requestNotificationPermission()
        .then(() =>
          showNotification("Success", "Notifications are now enabled.")
        )
        .catch(() => console.log("Permission was denied."));
    }
  };

  function scheduleReminder(task, formData) {
    const reminderMinutes = parseInt(formData.get("reminder"));
    if (reminderMinutes && reminderMinutes > 0) {
      const dueDateTime = new Date(task.dueDateTime).getTime();
      const reminderTime = dueDateTime - reminderMinutes * 60 * 1000;
      const now = new Date().getTime();
      if (reminderTime > now) {
        requestNotificationPermission()
          .then(() => {
            setTimeout(() => {
              const audio = new Audio("/notification.mp3");
              audio.play().catch((e) => console.error("Audio play failed:", e));
              showNotification(
                "Task Reminder",
                `Your task "${task.title}" is due soon.`
              );
              navigator.serviceWorker.ready.then((registration) => {
                registration.active.postMessage({
                  type: "show-reminder",
                  title: "Kairon Reminder",
                  body: `Your task "${task.title}" is due soon.`,
                  icon: "/favicon/android-chrome-192x192.png",
                });
              });
            }, reminderTime - now);
            console.log(`Notification scheduled for task: ${task.title}`);
          })
          .catch(() => console.log("Notification permission denied."));
      }
    }
  }

  // ---- DATA CRUD FUNCTIONS ---- //

  window.addInspiration = async function (event) {
    event.preventDefault();
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) return;

    const form = event.target;
    const formData = new FormData(form);
    const text = formData.get("inspirationText").trim();

    if (text) {
      const newInspiration = { userId: currentUser, text: text };
      const newId = await db.inspirations.add(newInspiration);
      newInspiration.id = newId;
      inspirations.push(newInspiration);
      form.reset();
      renderMyInspirations();
      displayDailyInspiration();
    }
  };

  window.deleteInspiration = async function (id) {
    inspirations = inspirations.filter((i) => i.id !== id);
    await db.inspirations.delete(id);
    renderMyInspirations();
    displayDailyInspiration();
  };

  function renderMyInspirations() {
    const list = document.getElementById("myInspirationsList");
    if (!list) return;

    list.innerHTML =
      inspirations.length === 0
        ? '<p class="text-xs text-gray-500">Add your own quotes and ideas.</p>'
        : inspirations
            .map(
              (insp) => `
            <div class="text-sm flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-2 rounded-md">
                <span class="italic pr-2">"${insp.text}"</span>
                <button onclick="deleteInspiration(${insp.id})" class="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full flex-shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `
            )
            .join("");
  }

  window.openTaskForm = () => {
    const form = document.querySelector("#tasksPage #taskForm");
    if (form) {
      form.classList.remove("hidden");
      form.querySelector('[name="dueDateTime"]').value = new Date()
        .toISOString()
        .slice(0, 16);
      currentSubtasks = [];
      renderCurrentSubtasks("add");
    }
  };
  window.closeTaskForm = () => {
    const form = document.querySelector("#tasksPage #taskForm");
    if (form) form.classList.add("hidden");
  };

  window.handleAddTask = async function (event) {
    event.preventDefault();
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) return;
    const formData = new FormData(event.target);
    const task = {
      userId: currentUser,
      title: formData.get("title"),
      category: formData.get("category"),
      priority: formData.get("priority"),
      dueDateTime: formData.get("dueDateTime"),
      recurrence: formData.get("recurrence"),
      tags: formData.get("tags")
        ? formData
            .get("tags")
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t)
        : [],
      notes: formData.get("notes"),
      subtasks: [...currentSubtasks],
      status: "active",
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    const newId = await db.tasks.add(task);
    task.id = newId;
    tasks.push(task);
    renderTasks();
    updateFilters();
    closeTaskForm();
    event.target.reset();
    showNotification("Success", `"${task.title}" has been added!`);
    scheduleReminder(task, formData);
  };

  window.handleUpdateTask = async function (event) {
    event.preventDefault();
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) return;
    const form = event.target;
    const formData = new FormData(form);
    const taskId = parseInt(formData.get("taskId"));
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    let updatedTaskData;
    if (taskIndex > -1) {
      updatedTaskData = {
        ...tasks[taskIndex],
        userId: currentUser,
        title: formData.get("title"),
        category: formData.get("category"),
        priority: formData.get("priority"),
        dueDateTime: formData.get("dueDateTime"),
        recurrence: formData.get("recurrence"),
        tags: formData.get("tags")
          ? formData
              .get("tags")
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t)
          : [],
        notes: formData.get("notes"),
        subtasks: [...currentSubtasks],
      };
      tasks[taskIndex] = updatedTaskData;
    }
    if (updatedTaskData) await db.tasks.put(updatedTaskData);
    renderTasks();
    closeEditModal();
    showNotification(
      "Success",
      `"${tasks[taskIndex].title}" has been updated.`
    );
    const updatedTask = tasks[taskIndex];
    scheduleReminder(updatedTask, formData);
  };

  window.toggleSubtaskCompletion = async function (taskId, subtaskIndex) {
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.subtasks[subtaskIndex]) {
      task.subtasks[subtaskIndex].completed =
        !task.subtasks[subtaskIndex].completed;
      await db.tasks.put(task);

      const currentPage = document
        .querySelector("#mainAppContainer > div:not(.hidden)")
        ?.id.replace("Page", "");
      if (currentPage) {
        renderPageContent(currentPage);
      }
    }
  };

  window.completeTask = async function (taskId) {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = "completed";
      task.completedAt = new Date().toISOString();
      await db.tasks.update(taskId, {
        status: "completed",
        completedAt: task.completedAt,
      });
      renderTasks();
    }
  };

  window.deleteTask = async function (taskId) {
    if (confirm("Are you sure you want to delete this task?")) {
      tasks = tasks.filter((t) => t.id !== taskId);
      await db.tasks.delete(taskId);
      renderTasks();
    }
  };

  window.editTask = function (taskId) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const modal = document.getElementById("editTaskModal");
    const form = document.getElementById("editTaskForm");
    form.querySelector('[name="taskId"]').value = task.id;
    form.querySelector('[name="title"]').value = task.title;
    form.querySelector('[name="category"]').value = task.category;
    form.querySelector('[name="priority"]').value = task.priority;
    form.querySelector('[name="dueDateTime"]').value = task.dueDateTime;
    form.querySelector('[name="recurrence"]').value = task.recurrence || "none";
    form.querySelector('[name="tags"]').value = task.tags
      ? task.tags.join(", ")
      : "";
    form.querySelector('[name="notes"]').value = task.notes || "";
    const reminderSelect = form.querySelector('[name="reminder"]');
    if (reminderSelect) reminderSelect.value = "none";
    currentSubtasks = task.subtasks
      ? JSON.parse(JSON.stringify(task.subtasks))
      : [];
    renderCurrentSubtasks("edit");
    modal.classList.remove("hidden");
  };
  window.closeEditModal = () => {
    const modal = document.getElementById("editTaskModal");
    if (modal) modal.classList.add("hidden");
    currentSubtasks = [];
  };

  window.showInterestFormFab = function () {
    const form = document.getElementById("interestForm");
    if (form) {
      form.classList.remove("hidden");
      document.getElementById("interestTitleInput").focus();
    }
  };

  window.addInterest = async function () {
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) return;

    const titleInput = document.getElementById("interestTitleInput");
    const descInput = document.getElementById("interestDescInput");
    if (!titleInput || !descInput) return;

    const title = titleInput.value.trim();
    const description = descInput.value.trim();

    if (title) {
      const newInterest = { userId: currentUser, title, description };
      const newId = await db.interests.add(newInterest);
      newInterest.id = newId;
      interests.push(newInterest);

      renderInterests();
      cancelInterest();
    }
  };

  window.cancelInterest = function () {
    const form = document.getElementById("interestForm");
    if (form) form.classList.add("hidden");
    document.getElementById("interestTitleInput").value = "";
    document.getElementById("interestDescInput").value = "";
  };

  window.deleteInterest = async function (id) {
    interests = interests.filter((i) => i.id !== id);
    await db.interests.delete(id);
    renderInterests();
  };

  window.syncFilters = function () {
    document.getElementById("searchInput").value =
      document.getElementById("mobileSearchInput").value;
    document.getElementById("categoryFilter").value = document.getElementById(
      "mobileCategoryFilter"
    ).value;
    document.getElementById("priorityFilter").value = document.getElementById(
      "mobilePriorityFilter"
    ).value;
    document.getElementById("timeFilter").value =
      document.getElementById("mobileTimeFilter").value;
    document.getElementById("tagFilter").value =
      document.getElementById("mobileTagFilter").value;
    filterTasks();
  };

  window.filterTasks = function () {
    const search = document.getElementById("searchInput").value.toLowerCase();
    const category = document.getElementById("categoryFilter").value;
    const priority = document.getElementById("priorityFilter").value;
    const time = document.getElementById("timeFilter").value;
    const tag = document.getElementById("tagFilter").value;
    const filtered = tasks.filter((task) => {
      const matchSearch = task.title.toLowerCase().includes(search);
      const matchCategory = category === "all" || task.category === category;
      const matchPriority = priority === "all" || task.priority === priority;
      const matchTag = tag === "all" || (task.tags && task.tags.includes(tag));
      let matchTime = true;
      if (time === "today")
        matchTime =
          new Date(task.dueDateTime).toDateString() ===
          new Date().toDateString();
      else if (time === "week") {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        matchTime =
          new Date(task.dueDateTime) >= weekStart &&
          new Date(task.dueDateTime) <= weekEnd;
      } else if (time === "overdue")
        matchTime =
          new Date(task.dueDateTime) < new Date() && task.status === "active";
      return (
        matchSearch && matchCategory && matchPriority && matchTag && matchTime
      );
    });
    renderTasks(filtered, false);
  };

  function updateFilters() {
    const categories = [...new Set(tasks.map((t) => t.category))].filter(
      Boolean
    );
    const tags = [...new Set(tasks.flatMap((t) => t.tags || []))].filter(
      Boolean
    );
    const catHTML =
      '<option value="all">All Categories</option>' +
      categories.map((c) => `<option value="${c}">${c}</option>`).join("");
    const tagHTML =
      '<option value="all">All Tags</option>' +
      tags.map((t) => `<option value="${t}">${t}</option>`).join("");
    document
      .querySelectorAll("#categoryFilter, #mobileCategoryFilter")
      .forEach((el) => {
        if (el) el.innerHTML = catHTML;
      });
    document.querySelectorAll("#tagFilter, #mobileTagFilter").forEach((el) => {
      if (el) el.innerHTML = tagHTML;
    });
  }

  // ---- DYNAMIC PAGE HTML & RENDER FUNCTIONS ---- //
  function getEmptyStateHTML(message, subtext) {
    return `
            <div class="text-center py-16 px-6">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-gray-200">${message}</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">${subtext}</p>
            </div>
        `;
  }

  function getTodayPageHTML() {
    return `
        <h2 id="greetingHeader" class="text-3xl font-bold mb-6"></h2>
        <div class="flex flex-col md:grid md:grid-cols-3 md:gap-6 space-y-6 md:space-y-0">
            
            <div class="card p-6 order-1" style="background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);">
                <h3 class="text-xl font-semibold mb-4 text-gray-800">🔥 Overdue</h3>
                <div id="overdueTasksList" class="max-h-60 overflow-y-auto pr-2"></div>
            </div>

            <div class="card p-6 order-2" style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);">
                <h3 class="text-xl font-semibold mb-4 text-gray-800">☀️ Today</h3>
                <div id="todayTasksList" class="space-y-2 max-h-60 overflow-y-auto pr-2"></div>
            </div>

            <div class="card p-6 order-3" style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);">
                <h3 class="text-xl font-semibold mb-4 text-gray-800">🔭 Upcoming</h3>
                <div class="space-y-4 max-h-60 overflow-y-auto pr-2">
                    <div><h4 class="font-bold text-sm text-gray-700 mb-1">Tomorrow</h4><div id="tomorrowTasksList"></div></div>
                    <div><h4 class="font-bold text-sm text-gray-700 mb-1">This Week</h4><div id="thisWeekTasksList"></div></div>
                    <div><h4 class="font-bold text-sm text-gray-700 mb-1">Later</h4><div id="laterTasksList"></div></div>
                </div>
            </div>

            <div class="md:col-span-3 card p-6 order-4" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);">
                 <h3 class="text-xl font-semibold mb-4 text-gray-800">Things I'm Interested In</h3>
                 <div id="interestForm" class="hidden mb-4 p-4 bg-white rounded-lg shadow-sm">
                     <div class="space-y-3">
                         <input type="text" id="interestTitleInput" placeholder="What are you interested in?" class="w-full px-3 py-2 border rounded-lg text-sm">
                         <textarea id="interestDescInput" placeholder="Tell me more about it..." rows="2" class="w-full px-3 py-2 border rounded-lg text-sm"></textarea>
                         <div class="flex gap-2">
                             <button onclick="addInterest()" class="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg text-sm hover:shadow-lg transition-all">Add</button>
                             <button onclick="cancelInterest()" class="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                         </div>
                     </div>
                 </div>
                 <div id="interestsList" class="max-h-60 overflow-y-auto pr-2"></div>
            </div>
            
            <div class="md:col-span-3 card p-6 order-5" style="background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%);">
                <h3 class="text-lg font-semibold mb-2 text-gray-800">Daily Inspiration</h3>
                <p id="quoteWidget" class="text-sm italic text-gray-700"></p>
            </div>
        </div>`;
  }

  function renderTodayPage() {
    const hour = new Date().getHours();
    const date = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const greetingHeader = document.getElementById("greetingHeader");
    if (greetingHeader) {
      let greeting =
        hour < 12
          ? `Good Morning from ${settings.location}!`
          : hour < 18
          ? `Good Afternoon from ${settings.location}!`
          : `Good Evening from ${settings.location}!`;
      greetingHeader.textContent = `${greeting} It's ${date}.`;
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const overdueTasks = tasks.filter(
      (task) => new Date(task.dueDateTime) < now && task.status === "active"
    );
    const overdueList = document.getElementById("overdueTasksList");
    if (overdueList)
      overdueList.innerHTML =
        overdueTasks.length === 0
          ? '<p class="text-gray-600">Nothing is overdue. Great job!</p>'
          : overdueTasks
              .map(
                (task) =>
                  `<div class="flex items-center justify-between py-2 border-b border-red-300"><span class="font-medium text-gray-800">${
                    task.title
                  }</span><span class="text-sm text-red-700 font-semibold">${formatTimeAgo(
                    task.dueDateTime
                  )}</span></div>`
              )
              .join("");

    const todayString = startOfToday.toDateString();
    const todayTasks = tasks.filter(
      (task) =>
        new Date(task.dueDateTime).toDateString() === todayString &&
        new Date(task.dueDateTime) >= now &&
        task.status !== "completed"
    );

    const groupedTasks = todayTasks.reduce((groups, task) => {
      const category = task.category || "Uncategorized";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(task);
      return groups;
    }, {});

    const todayList = document.getElementById("todayTasksList");
    if (todayList) {
      if (Object.keys(groupedTasks).length === 0) {
        todayList.innerHTML =
          '<p class="text-gray-600">No tasks due today. Enjoy!</p>';
      } else {
        todayList.innerHTML = Object.keys(groupedTasks)
          .map(
            (category) => `
                <div class="mb-4">
                    <h5 class="font-bold text-sm text-blue-800 mb-2">${category}</h5>
                    <div class="space-y-2">
                        ${groupedTasks[category]
                          .map((task) => {
                            const subtasks = task.subtasks || [];
                            const completedSubtasks = subtasks.filter(
                              (st) => st.completed
                            ).length;
                            const allSubtasksDone =
                              subtasks.length > 0 &&
                              completedSubtasks === subtasks.length;
                            return `
                                <div class="p-2 rounded-md hover:bg-blue-100">
                                    <label class="flex items-center cursor-pointer">
                                        <input type="checkbox" 
                                               class="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed" 
                                               onchange="completeTask(${
                                                 task.id
                                               })"
                                               ${
                                                 subtasks.length > 0 &&
                                                 !allSubtasksDone
                                                   ? "disabled"
                                                   : ""
                                               }
                                        >
                                        <span class="ml-3 text-gray-800">${
                                          task.title
                                        }</span>
                                        <span class="ml-auto text-sm text-gray-600">${new Date(
                                          task.dueDateTime
                                        ).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}</span>
                                    </label>
                                    ${
                                      subtasks.length > 0
                                        ? `<div class="ml-8 mt-2 space-y-1 border-l-2 pl-3">${subtasks
                                            .map(
                                              (subtask, index) =>
                                                `<label class="flex items-center text-sm cursor-pointer ${
                                                  subtask.completed
                                                    ? "text-gray-400 line-through"
                                                    : "text-gray-700"
                                                }"><input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" onchange="toggleSubtaskCompletion(${
                                                  task.id
                                                }, ${index})" ${
                                                  subtask.completed
                                                    ? "checked"
                                                    : ""
                                                }><span class="ml-2">${
                                                  subtask.text
                                                }</span></label>`
                                            )
                                            .join("")}</div>`
                                        : ""
                                    }
                                </div>
                            `;
                          })
                          .join("")}
                    </div>
                </div>
            `
          )
          .join("");
      }
    }

    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfToday.getDate() + 1);
    const startOfDayAfterTomorrow = new Date(startOfToday);
    startOfDayAfterTomorrow.setDate(startOfToday.getDate() + 2);
    const startOfNextWeek = new Date(startOfToday);
    startOfNextWeek.setDate(startOfToday.getDate() + 8);
    const tomorrowTasks = tasks.filter(
      (t) =>
        new Date(t.dueDateTime) >= startOfTomorrow &&
        new Date(t.dueDateTime) < startOfDayAfterTomorrow &&
        t.status === "active"
    );
    const thisWeekTasks = tasks.filter(
      (t) =>
        new Date(t.dueDateTime) >= startOfDayAfterTomorrow &&
        new Date(t.dueDateTime) < startOfNextWeek &&
        t.status === "active"
    );
    const laterTasks = tasks.filter(
      (t) => new Date(t.dueDateTime) >= startOfNextWeek && t.status === "active"
    );
    const renderUpcomingTask = (task) =>
      `<div class="py-1"><p class="text-sm text-gray-700">${task.title}</p></div>`;
    const tomorrowTasksList = document.getElementById("tomorrowTasksList");
    if (tomorrowTasksList)
      tomorrowTasksList.innerHTML =
        tomorrowTasks.length === 0
          ? '<p class="text-xs text-gray-500">Nothing for tomorrow.</p>'
          : tomorrowTasks.map(renderUpcomingTask).join("");
    const thisWeekTasksList = document.getElementById("thisWeekTasksList");
    if (thisWeekTasksList)
      thisWeekTasksList.innerHTML =
        thisWeekTasks.length === 0
          ? '<p class="text-xs text-gray-500">Nothing else this week.</p>'
          : thisWeekTasks.map(renderUpcomingTask).join("");
    const laterTasksList = document.getElementById("laterTasksList");
    if (laterTasksList)
      laterTasksList.innerHTML =
        laterTasks.length === 0
          ? '<p class="text-xs text-gray-500">Nothing scheduled for later.</p>'
          : laterTasks.map(renderUpcomingTask).join("");

    renderInterests();
    displayDailyInspiration();
    getWeather();
  }

  function renderInterests() {
    const list = document.getElementById("interestsList");
    if (!list) return;
    list.innerHTML =
      interests.length === 0
        ? '<p class="text-gray-600 text-sm">Tap + to add something!</p>'
        : interests
            .map(
              (interest) =>
                `<div class="interest-item"><div class="flex items-start justify-between"><div class="flex-1 mr-2"><h4 class="font-semibold text-sm text-gray-800">${
                  interest.title
                }</h4>${
                  interest.description
                    ? `<p class="text-xs text-gray-700 mt-1">${interest.description}</p>`
                    : ""
                }</div><button onclick="deleteInterest(${
                  interest.id
                })" class="p-1 hover:bg-gray-200 rounded"><svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div></div>`
            )
            .join("");
  }

  async function displayDailyInspiration() {
    const quoteWidget = document.getElementById("quoteWidget");
    if (!quoteWidget) return;

    if (inspirations.length > 0) {
      const randomIndex = Math.floor(Math.random() * inspirations.length);
      const randomInspiration = inspirations[randomIndex];
      quoteWidget.innerHTML = `"${randomInspiration.text}" <br><span class="font-semibold">— You</span>`;
    } else {
      try {
        const response = await fetch(
          "https://api.quotable.io/random?maxLength=100"
        );
        const data = await response.json();
        quoteWidget.innerHTML = `"${data.content}" <br><span class="font-semibold">— ${data.author}</span>`;
      } catch (error) {
        quoteWidget.textContent = "Could not load quote.";
      }
    }
  }

  async function getWeather() {
    if (!settings.location) return;
    const weatherIconEl = document.getElementById("weatherIcon");
    const weatherTempEl = document.getElementById("weatherTemp");

    try {
      const response = await fetch(
        `/api/weather?location=${encodeURIComponent(settings.location)}`
      );
      if (!response.ok) {
        throw new Error("Weather data not found.");
      }

      const data = await response.json();
      const weatherIcons = {
        Clear: "☀️",
        Clouds: "☁️",
        Rain: "🌧️",
        Snow: "❄️",
        Thunderstorm: "⛈️",
        Drizzle: "🌦️",
        Mist: "🌫️",
      };

      if (weatherIconEl) {
        weatherIconEl.textContent = weatherIcons[data.weather[0].main] || "🌤️";
      }
      if (weatherTempEl) {
        weatherTempEl.textContent = `${Math.round(data.main.temp)}°C`;
      }
    } catch (error) {
      console.error("Weather fetch error:", error);
      if (weatherTempEl) {
        weatherTempEl.textContent = "N/A";
      }
    }
  }

  function getTasksPageHTML() {
    return `
            <button id="mobileFilterBtn" onclick="document.getElementById('filterPanel').classList.add('open')" class="md:hidden mb-4 px-4 py-2 bg-white rounded-lg shadow-sm flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                Filters
            </button>
            <div id="desktopFilters" class="hidden md:block card p-4 mb-6">
                <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div class="tooltip-wrapper"><input type="text" id="searchInput" placeholder="Search tasks (Press 'F')" onkeyup="filterTasks()" class="w-full px-4 py-2 border rounded-lg"><span class="tooltip-content">Search by task title</span></div>
                    <div class="tooltip-wrapper"><select id="categoryFilter" onchange="filterTasks()" class="w-full px-4 py-2 border rounded-lg"></select><span class="tooltip-content">Filter by category</span></div>
                    <div class="tooltip-wrapper"><select id="priorityFilter" onchange="filterTasks()" class="w-full px-4 py-2 border rounded-lg"><option value="all">All Priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><span class="tooltip-content">Filter by priority level</span></div>
                    <div class="tooltip-wrapper"><select id="timeFilter" onchange="filterTasks()" class="w-full px-4 py-2 border rounded-lg"><option value="all">All Time</option><option value="today">Today</option><option value="week">This Week</option><option value="overdue">Overdue</option></select><span class="tooltip-content">Filter by time frame</span></div>
                    <div class="tooltip-wrapper"><select id="tagFilter" onchange="filterTasks()" class="w-full px-4 py-2 border rounded-lg"></select><span class="tooltip-content">Filter by tags</span></div>
                </div>
            </div>
            <div id="filterPanel" class="filter-panel fixed inset-y-0 right-0 w-80 bg-white shadow-lg z-40 md:hidden">
                 <div class="p-4 h-full flex flex-col">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-xl font-bold">Filters</h2>
                        <button onclick="document.getElementById('filterPanel').classList.remove('open')" class="p-2 hover:bg-gray-100 rounded-lg">
                           <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                    <div class="space-y-4">
                        <div><label class="block text-sm font-medium mb-2">Search</label><input type="text" id="mobileSearchInput" placeholder="Search tasks..." onkeyup="syncFilters()" class="w-full px-4 py-2 border rounded-lg"></div>
                        <div><label class="block text-sm font-medium mb-2">Category</label><select id="mobileCategoryFilter" onchange="syncFilters()" class="w-full px-4 py-2 border rounded-lg"></select></div>
                        <div><label class="block text-sm font-medium mb-2">Priority</label><select id="mobilePriorityFilter" onchange="syncFilters()" class="w-full px-4 py-2 border rounded-lg"><option value="all">All Priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
                        <div><label class="block text-sm font-medium mb-2">Time</label><select id="mobileTimeFilter" onchange="syncFilters()" class="w-full px-4 py-2 border rounded-lg"><option value="all">All Time</option><option value="today">Today</option><option value="week">This Week</option><option value="overdue">Overdue</option></select></div>
                        <div><label class="block text-sm font-medium mb-2">Tags</label><select id="mobileTagFilter" onchange="syncFilters()" class="w-full px-4 py-2 border rounded-lg"></select></div>
                       <button onclick="document.getElementById('filterPanel').classList.remove('open')" class="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg">Apply Filters</button>
                    </div>
                 </div>
            </div>
            <form id="taskForm" class="mb-6 card p-6 hidden" onsubmit="handleAddTask(event)">
                <h3 class="text-lg font-bold mb-4">Add New Task</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div class="md:col-span-2"><label class="block text-sm font-medium mb-1">Task Title *</label><input type="text" name="title" required class="w-full px-4 py-2 border rounded-lg"></div>
                    <div><label class="block text-sm font-medium mb-1">Category *</label><select name="category" required class="w-full px-4 py-2 border rounded-lg"><option value="">Select Category</option><option value="Work">Work</option><option value="Personal">Personal</option><option value="Shopping">Shopping</option><option value="Health">Health</option><option value="Other">Other</option></select></div>
                    <div><label class="block text-sm font-medium mb-1">Priority</label><select name="priority" class="w-full px-4 py-2 border rounded-lg"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                    <div><label class="block text-sm font-medium mb-1">Due Date & Time *</label><input type="datetime-local" name="dueDateTime" required class="w-full px-4 py-2 border rounded-lg"></div>
                    <div><label class="block text-sm font-medium mb-1">Recurrence</label><select name="recurrence" class="w-full px-4 py-2 border rounded-lg"><option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
                    <div><label class="block text-sm font-medium mb-1">Reminder</label><select name="reminder" class="w-full px-4 py-2 border rounded-lg" onchange="handleReminderChange(this)"><option value="none">None</option><option value="5">5 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option></select></div>
                    <div class="md:col-span-2"><label class="block text-sm font-medium mb-1">Tags (comma-separated)</label><input type="text" name="tags" placeholder="#urgent, #project-alpha" class="w-full px-4 py-2 border rounded-lg"></div>
                    <div class="md:col-span-2"><label class="block text-sm font-medium mb-1">Notes</label><textarea name="notes" rows="2" class="w-full px-4 py-2 border rounded-lg"></textarea></div>
                </div>
                <div class="border-t pt-4 mt-4">
                    <label class="block text-sm font-medium mb-2">Sub-tasks</label>
                    <div id="addSubtasksContainer" class="space-y-2 max-h-40 overflow-y-auto mb-2 pr-2"></div>
                    <div class="flex gap-2"><input type="text" id="addSubtaskInput" placeholder="Add a new sub-task..." class="w-full px-4 py-2 border rounded-lg"><button type="button" onclick="handleAddSubtask('add')" class="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Add</button></div>
                </div>
                <div class="flex justify-end gap-2 mt-6"><button type="button" onclick="closeTaskForm()" class="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button><button type="submit" class="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all">Save Task</button></div>
            </form>
            <div class="space-y-4">
                <div class="card overflow-hidden">
                    <div class="px-6 py-4 bg-gray-50 border-b"><h2 class="text-lg font-semibold">Active Tasks</h2></div>
                    <div class="divide-y" id="activeTasksList"></div>
                </div>
                <div class="card overflow-hidden">
                    <div class="px-6 py-4 bg-gray-50 border-b"><h2 class="text-lg font-semibold">Completed Tasks</h2></div>
                    <div class="divide-y" id="completedTasksList"></div>
                </div>
            </div>`;
  }

  function renderTasks(tasksToRender = null, filterSource = true) {
    const tasksSource = tasksToRender || tasks;
    const activeTasks = filterSource
      ? tasksSource
          .filter((t) => t.status === "active")
          .sort((a, b) => new Date(a.dueDateTime) - new Date(b.dueDateTime))
      : tasksSource.filter((t) => t.status === "active");
    const completedTasks = tasksSource.filter((t) => t.status === "completed");
    const priorityColors = {
      high: "bg-red-100 text-red-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-green-100 text-green-800",
    };
    const activeTasksList = document.getElementById("activeTasksList");
    const completedTasksList = document.getElementById("completedTasksList");

    if (activeTasksList) {
      activeTasksList.innerHTML =
        activeTasks.length === 0
          ? getEmptyStateHTML(
              "Your slate is clear.",
              "What will you accomplish today?"
            )
          : activeTasks
              .map((task) => {
                const subtasks = task.subtasks || [];
                const completedSubtasks = subtasks.filter(
                  (st) => st.completed
                ).length;
                const subtaskProgress =
                  subtasks.length > 0
                    ? `(${completedSubtasks}/${subtasks.length})`
                    : "";
                const progressPercentage =
                  subtasks.length > 0
                    ? (completedSubtasks / subtasks.length) * 100
                    : 0;
                return `
                    <div class="px-6 py-4 flex items-start justify-between hover:bg-gray-50 transition-colors" data-task-id="${
                      task.id
                    }">
                        <div class="flex items-start flex-1">
                            <div class="task-draggable pr-4 pt-1 text-gray-400"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg></div>
                            <div class="flex-1">
                                <h3 class="font-semibold">${
                                  task.title
                                } <span class="text-sm font-normal text-gray-500">${subtaskProgress}</span></h3>
                                <p class="text-sm text-gray-600">Due: ${new Date(
                                  task.dueDateTime
                                ).toLocaleString()}</p>
                                ${
                                  subtasks.length > 0
                                    ? `<div class="w-full bg-gray-200 rounded-full h-1.5 mt-2 dark:bg-gray-700"><div class="bg-purple-600 h-1.5 rounded-full" style="width: ${progressPercentage}%"></div></div>`
                                    : ""
                                }
                                ${
                                  subtasks.length > 0
                                    ? `<div class="mt-3 text-sm text-gray-700 space-y-1">${subtasks
                                        .map(
                                          (st) =>
                                            `<div class="flex items-center gap-2 ${
                                              st.completed
                                                ? "subtask-completed"
                                                : ""
                                            }"><span>${
                                              st.completed ? "✓" : "○"
                                            }</span><span>${
                                              st.text
                                            }</span></div>`
                                        )
                                        .join("")}</div>`
                                    : ""
                                }
                                <div class="flex flex-wrap gap-2 mt-2">
                                    <span class="text-xs px-2 py-1 ${
                                      priorityColors[task.priority]
                                    } rounded-full">${task.priority}</span>
                                    <span class="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">${
                                      task.category
                                    }</span>
                                    ${
                                      task.recurrence &&
                                      task.recurrence !== "none"
                                        ? `<span class="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">🔄 ${task.recurrence}</span>`
                                        : ""
                                    }
                                    ${(task.tags || [])
                                      .map(
                                        (tag) =>
                                          `<span class="text-xs px-2 py-1 bg-gray-200 text-gray-800 rounded-full">${tag}</span>`
                                      )
                                      .join("")}
                                </div>
                            </div>
                        </div>
                        <div class="flex gap-1 pl-2">
                            <button onclick="editTask(${
                              task.id
                            })" class="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="Edit Task"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg></button>
                            <button onclick="completeTask(${
                              task.id
                            })" class="p-2 text-green-600 hover:bg-green-100 rounded-full" title="Complete Task"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></button>
                            <button onclick="deleteTask(${
                              task.id
                            })" class="p-2 text-red-600 hover:bg-red-100 rounded-full" title="Delete Task"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                        </div>
                    </div>`;
              })
              .join("");
    }

    if (completedTasksList) {
      completedTasksList.innerHTML =
        completedTasks.length === 0
          ? getEmptyStateHTML(
              "No completed tasks yet.",
              "Time to get started on your goals!"
            )
          : completedTasks
              .map(
                (task) =>
                  `<div class="px-6 py-4 flex items-center justify-between hover:bg-gray-50 opacity-70 transition-colors"><div class="flex-1"><h3 class="font-semibold line-through">${
                    task.title
                  }</h3><p class="text-sm text-gray-600">Completed: ${new Date(
                    task.completedAt
                  ).toLocaleString()}</p></div><button onclick="deleteTask(${
                    task.id
                  })" class="p-2 text-red-600 hover:bg-red-100 rounded-full" title="Delete Task"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></div>`
              )
              .join("");
    }

    if (sortableInstance) sortableInstance.destroy();
    if (activeTasksList && activeTasks.length > 0) {
      sortableInstance = new Sortable(activeTasksList, {
        handle: ".task-draggable",
        animation: 150,
        ghostClass: "sortable-ghost",
        dragClass: "sortable-drag",
        onEnd: (evt) => {
          const newOrderIds = Array.from(evt.to.children).map((item) =>
            parseInt(item.dataset.taskId)
          );
          tasks.sort((a, b) => {
            if (a.status === "active" && b.status === "active")
              return newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id);
            return 0;
          });
        },
      });
    }
  }

  function getCalendarPageHTML() {
    return `
            <div class="card p-6 mb-6">
                <h2 class="text-xl font-bold mb-4">Calendar Sync</h2>
                <p class="text-sm text-gray-600 mb-4">Connect your external calendars to see all your events in one place. (Backend required for full functionality).</p>
                <div class="flex flex-col sm:flex-row gap-4">
                    <button onclick="connectGoogleCalendar()" class="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"><svg class="w-5 h-5" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.82l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg> Connect Google Calendar</button>
                    <button onclick="connectAppleCalendar()" class="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 16 16"><path d="M11.182.008C10.148-.03 9.07.258 8.088.66c-1.013.414-2.033.953-2.943 1.55C4.24 2.76 3.322 3.842 2.58 5.105c-.652 1.09-.947 2.458-1.01 3.818-.063 1.357.1 2.77.633 4.043.49 1.18 1.25 2.24 2.13 3.09.87.84 1.87 1.47 2.97 1.81.98.31 2.05.39 3.1.18.92-.19 1.83-.59 2.65-1.18.78-.56 1.45-1.28 2.01-2.14.53-.83.89-1.81.9-2.86-.01-1.1-.38-2.21-1.02-3.2-.61-.95-1.42-1.78-2.36-2.42-1.1-1.01-2.43-1.65-3.83-1.82a4.35 4.35 0 0 0-1.13.04c-.45.08-.88.24-1.28.46-.38.21-.73.48-1.03.8-.28.3-.5.65-.67 1.02-.18.37-.28.78-.29 1.2-.01.48.07.95.23 1.4.15.42.39.82.7 1.16.32.34.7.61 1.12.8.42.18.88.27 1.35.27.42 0 .84-.08 1.24-.24.4-.16.77-.4 1.09-.72.32-.32.58-.7.76-1.12.18-.4.27-.85.27-1.32 0-.3-.04-.6-.12-.89-.08-.29-.2-.56-.37-.8-.17-.24-.38-.45-.62-.63-.24-.18-.52-.32-.82-.41a2.6 2.6 0 0 0-1.14-.1c-.48.05-.95.2-1.38.43-.43.23-.82.55-1.14.94-.32.39-.57.85-.74 1.35-.17.5-.25 1.03-.24 1.57 0 .58.1 1.15.3 1.7.2.54.5 1.05.88 1.5.39.45.85.83 1.38 1.13.53.3 1.12.5 1.75.58.63.08 1.27.06 1.89-.06.62-.12 1.22-.35 1.78-.68.56-.33 1.08-.76 1.53-1.28.45-.52.82-1.1 1.1-1.74.28-.64.45-1.32.49-2.02.04-.7-.04-1.4-.23-2.08s-.5-1.32-.9-1.9c-.4-.58-.88-1.08-1.43-1.5-.55-.42-1.15-.75-1.8-1a5.6 5.6 0 0 0-3.32-.47z"></path><path d="M7.762 3.282c.282-.23.633-.377 1.013-.399.38-.02.76.046 1.12.193.36.147.69.373.96.657.27.284.47.62.59 1.002.12.38.15.79.09 1.192-.06.402-.22.78-.47 1.107s-.59.58-1 .768c-.41.188-.85.28-1.3.27-.45-.01-.89-.12-1.29-.323-.4-.203-.76-.49-1.04-.85-.28-.36-.48-.79-.59-1.25-.11-.46-.12-.94-.03-1.402.09-.46.28-.89.56-1.26.28-.37.64-.67 1.05-.88z"></path></svg> Connect Apple Calendar</button>
                </div>
            </div>
            <div id="calendar" class="card p-4"></div>`;
  }

  function renderCalendar() {
    const calendarEl = document.getElementById("calendar");
    if (!calendarEl || !window.FullCalendar) return;
    if (calendarInstance) calendarInstance.destroy();
    calendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,listWeek",
      },
      events: tasks.map((t) => ({
        title: t.title,
        start: t.dueDateTime,
        color:
          t.status === "completed"
            ? "#10B981"
            : themeColors[settings.themeColor]?.from,
        borderColor:
          t.status === "completed"
            ? "#047857"
            : themeColors[settings.themeColor]?.to,
      })),
    });
    calendarInstance.render();
  }

  window.connectGoogleCalendar = function () {
    showNotification(
      "Coming Soon!",
      "Full Google Calendar sync requires a backend server."
    );
  };
  window.connectAppleCalendar = function () {
    showNotification(
      "Coming Soon!",
      "Full Apple Calendar sync requires a backend server."
    );
  };

  function getAnalyticsPageHTML() {
    return `
            <div class="card p-6">
                <h2 class="text-2xl font-bold mb-6">Analytics</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-blue-50 p-6 rounded-lg"><h3 class="font-semibold mb-2 text-gray-700">Completion Rate</h3><p id="completionRate" class="text-3xl font-bold text-blue-600">0%</p></div>
                    <div class="bg-green-50 p-6 rounded-lg"><h3 class="font-semibold mb-2 text-gray-700">On-Time Completion</h3><p id="onTimeRate" class="text-3xl font-bold text-green-600">0%</p></div>
                    <div class="bg-purple-50 p-6 rounded-lg"><h3 class="font-semibold mb-2 text-gray-700">Average Time Accuracy</h3><p id="timeAccuracy" class="text-3xl font-bold text-purple-600">0%</p></div>
                </div>
            </div>`;
  }

  function updateAnalytics() {
    const completionRateEl = document.getElementById("completionRate");
    const onTimeRateEl = document.getElementById("onTimeRate");
    const timeAccuracyEl = document.getElementById("timeAccuracy");
    if (!completionRateEl || !onTimeRateEl || !timeAccuracyEl) return;

    const completed = tasks.filter((t) => t.status === "completed");
    const onTime = completed.filter(
      (t) => new Date(t.completedAt) <= new Date(t.dueDateTime)
    );
    const total = tasks.length;
    completionRateEl.textContent = `${
      total > 0 ? ((completed.length / total) * 100).toFixed(0) : 0
    }%`;
    onTimeRateEl.textContent = `${
      completed.length > 0
        ? ((onTime.length / completed.length) * 100).toFixed(0)
        : 0
    }%`;
    const accuracies = completed.map((task) => {
      const estimated = new Date(task.dueDateTime) - new Date(task.createdAt);
      const actual = new Date(task.completedAt) - new Date(task.createdAt);
      return isNaN(estimated) || estimated <= 0
        ? 100
        : Math.max(0, 100 - (Math.abs(actual - estimated) / estimated) * 100);
    });
    const avgAccuracy =
      accuracies.length > 0
        ? (accuracies.reduce((a, b) => a + b, 0) / accuracies.length).toFixed(0)
        : 0;
    timeAccuracyEl.textContent = `${avgAccuracy}%`;
  }

  function getSettingsPageHTML() {
    return `
        <div class="card p-6">
            <h2 class="text-2xl font-bold mb-6">Settings</h2>
            <form id="settingsForm" onsubmit="saveSettings(event)">
                <div class="space-y-4">
                    <div><label class="block text-sm font-medium mb-2">Your Location (for weather)</label><input type="text" name="location" placeholder="e.g., Naaldwijk" class="w-full px-4 py-2 border rounded-lg"></div>
                    <div><label class="block text-sm font-medium mb-2">Default View</label><select name="defaultView" class="w-full px-4 py-2 border rounded-lg"><option value="today">Today</option><option value="tasks">Tasks</option><option value="calendar">Calendar</option><option value="analytics">Analytics</option></select></div>
                    <div><label class="block text-sm font-medium mb-2">Notifications</label><select name="notifications" class="w-full px-4 py-2 border rounded-lg"><option value="all">All Tasks</option><option value="high">High Priority Only</option><option value="none">None</option></select></div>
                    <div><label class="block text-sm font-medium mb-2">Theme Color</label><select id="themeColor" name="themeColor" onchange="updateThemeColor(this.value)" class="w-full px-4 py-2 border rounded-lg"><option value="purple">Purple (Default)</option><option value="blue">Blue</option><option value="green">Green</option><option value="red">Red</option><option value="orange">Orange</option></select></div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Dark Mode Intensity</label>
                        <div class="flex items-center gap-4">
                            <span class="text-xs text-gray-500">Soft</span>
                            <input type="range" id="darkIntensity" name="darkIntensity" min="0" max="2" value="1" step="1" oninput="updateDarkIntensityPreview(this.value)" class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                            <span class="text-xs text-gray-500">Deep</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1" id="intensityLabel">Normal</p>
                    </div>
                    <div class="border-t pt-4">
                        <label class="block text-sm font-medium mb-2">Data Sync</label>
                        <p class="text-xs text-gray-500 mb-2">Back up your encrypted data to the decentralized network. You can restore it on another device using your Recovery Key.</p>
                        <button type="button" onclick="handleBackup()" class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Backup Data Now</button>
                    </div>
                    <button type="submit" class="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all">Save Settings</button>
                </div>
            </form>

            <div class="mt-8 border-t pt-6">
                <h3 class="text-lg font-semibold mb-4">My Inspirations</h3>
                <div id="myInspirationsList" class="max-h-40 overflow-y-auto pr-2 mb-4 space-y-2"></div>
                <form onsubmit="addInspiration(event)" class="flex gap-2">
                    <input name="inspirationText" type="text" placeholder="Add a new quote..." required class="w-full px-3 py-2 border rounded-lg text-sm">
                    <button type="submit" class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">Add</button>
                </form>
            </div>
        </div>`;
  }

  function loadSettings() {
    const form = document.getElementById("settingsForm");
    if (!form) return;
    form.querySelector('[name="location"]').value = settings.location;
    form.querySelector('[name="defaultView"]').value = settings.defaultView;
    form.querySelector('[name="notifications"]').value = settings.notifications;
    form.querySelector('[name="themeColor"]').value = settings.themeColor;
    form.querySelector('[name="darkIntensity"]').value = settings.darkIntensity;
    updateDarkIntensityPreview(settings.darkIntensity);
  }

  window.saveSettings = async function (event) {
    if (event) event.preventDefault();
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) return;
    const form = document.getElementById("settingsForm");
    if (form) {
      const formData = new FormData(form);
      settings.location = formData.get("location");
      settings.defaultView = formData.get("defaultView");
      settings.notifications = formData.get("notifications");
      settings.themeColor = formData.get("themeColor");
      settings.darkIntensity = parseInt(formData.get("darkIntensity"));
    }
    await db.settings.put({
      key: `${currentUser}_settings`,
      value: settings,
      userId: currentUser,
    });
    updateThemeColor(settings.themeColor);
    getWeather();
    if (event) showNotification("Success", "Settings saved!");
  };

  // ---- AUTHENTICATION FUNCTIONS ---- //
  window.toggleAuthForms = function () {
    document.getElementById("loginForm")?.classList.toggle("hidden");
    document.getElementById("signUpForm")?.classList.toggle("hidden");
  };

  window.handleSignUp = async function (event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const username = formData.get("username");
    const password = formData.get("password");
    const signUpError = document.getElementById("signUpError");

    try {
      const { recoveryKey } = await sdk.signUp(username, password);

      document.getElementById("signUpForm").classList.add("hidden");
      document.getElementById("recoveryContainer").classList.remove("hidden");
      document.getElementById("recoveryKeyDisplay").textContent = recoveryKey;

      sessionStorage.setItem("signupUsername", username);
      sessionStorage.setItem("signupPassword", password);

      const confirmCheckbox = document.getElementById("confirmRecovery");
      const finishBtn = document.getElementById("finishSetupBtn");
      confirmCheckbox.onchange = () => {
        finishBtn.disabled = !confirmCheckbox.checked;
        finishBtn.classList.toggle("opacity-50", !confirmCheckbox.checked);
        finishBtn.classList.toggle(
          "cursor-not-allowed",
          !confirmCheckbox.checked
        );
      };
    } catch (error) {
      console.error("Sign up failed:", error);
      signUpError.textContent = error.message;
      signUpError.classList.remove("hidden");
    }
  };

  window.handleLogin = async function (event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const username = formData.get("username");
    const password = formData.get("password");
    const loginError = document.getElementById("loginError");

    try {
      const isLoggedIn = await sdk.login(username, password);
      if (isLoggedIn) {
        sessionStorage.setItem("isLoggedIn", "true");
        sessionStorage.setItem("currentUser", username);
        sessionStorage.setItem("sessionKey", btoa(password));
        location.reload();
      } else {
        loginError.textContent = "Invalid username or password.";
        loginError.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Login failed:", error);
      loginError.textContent = error.message;
      loginError.classList.remove("hidden");
    }
  };

  window.handleLogout = function () {
    sessionStorage.clear();
    sdk.logout();
    location.reload();
  };

  window.finishSetup = function () {
    const username = sessionStorage.getItem("signupUsername");
    const password = sessionStorage.getItem("signupPassword");
    if (username && password) {
      sessionStorage.setItem("isLoggedIn", "true");
      sessionStorage.setItem("currentUser", username);
      sessionStorage.setItem("sessionKey", btoa(password)); // Encode password for session re-login
      sessionStorage.removeItem("signupUsername");
      sessionStorage.removeItem("signupPassword");
      location.reload();
    }
  };
  async function loginAndInitialize() {
    const currentUser = sessionStorage.getItem("currentUser");
    if (!currentUser) {
      handleLogout();
      return;
    }

    try {
      // Use the saved password to re-login to the SDK
      const password = atob(sessionStorage.getItem("sessionKey"));
      const isLoggedIn = await sdk.login(currentUser, password);
      if (!isLoggedIn) throw new Error("Local session is invalid.");

      // Load the latest data from the backup via the SDK
      const initialData = await sdk.loadData();

      // Show the main app and initialize it with the data
      document.getElementById("mainAppContainer")?.classList.remove("hidden");
      document.getElementById("authContainer")?.classList.add("hidden");
      init(initialData);
    } catch (error) {
      console.error("Failed to initialize session:", error);
      handleLogout();
    }
  }

  window.showRecoveryForm = function () {
    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("signUpForm").classList.add("hidden");
    document.getElementById("recoveryForm").classList.remove("hidden");
  };

  window.showLoginForm = function () {
    document.getElementById("recoveryForm").classList.add("hidden");
    document.getElementById("signUpForm").classList.add("hidden");
    document.getElementById("loginForm").classList.remove("hidden");
  };

  window.handleRecovery = async function (event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const username = formData.get("username");
    const recoveryKey = formData.get("recoveryKey");
    const recoveryError = document.getElementById("recoveryError");

    try {
      // 1. The SDK downloads and decrypts the data
      const restoredData = await sdk.restoreData(username, recoveryKey);

      // 2. We clear Kairon's local database
      await db.tasks.clear();
      await db.interests.clear();
      await db.inspirations.clear();
      await db.settings.clear();

      // 3. We save the restored data into Kairon's local database
      await db.tasks.bulkPut(restoredData.tasks || []);
      await db.interests.bulkPut(restoredData.interests || []);
      await db.inspirations.bulkPut(restoredData.inspirations || []);
      await db.settings.put({ key: "userSettings", ...restoredData.settings });

      showNotification(
        "Success",
        "Account restored. Please set a new password for this device."
      );

      // 4. Show the password reset form
      document.getElementById("recoveryForm").classList.add("hidden");
      const resetForm = document.getElementById("resetPasswordForm");
      resetForm.classList.remove("hidden");
      resetForm.querySelector('[name="usernameForReset"]').value = username;
    } catch (error) {
      console.error("Recovery failed:", error);
      recoveryError.textContent = `Recovery failed: ${error.message}`;
      recoveryError.classList.remove("hidden");
    }
  };

  window.handleResetPassword = async function (event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const username = formData.get("usernameForReset");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");
    const resetError = document.getElementById("resetError");

    if (newPassword !== confirmPassword) {
      resetError.textContent = "Passwords do not match.";
      resetError.classList.remove("hidden");
      return;
    }

    const hashedPassword = CryptoJS.SHA256(newPassword).toString();
    await db.users.update(username, { hashedPassword });

    alert("Password successfully reset! Please log in with your new password.");

    document.getElementById("resetPasswordForm").classList.add("hidden");
    showLoginForm();
  };

  window.handleBackup = async function () {
    try {
      showNotification("Backup", "Syncing data...");
      const dataToBackup = { tasks, interests, settings, inspirations };
      await sdk.backupData(dataToBackup);
      showNotification("Success", "Your data has been securely synced.");
    } catch (error) {
      console.error("Backup failed:", error);
      showNotification("Error", `Sync failed: ${error.message}`);
    }
  };
  // ---- GATEKEEPER: This runs on every page load ---- //
  if (sessionStorage.getItem("isLoggedIn") === "true") {
    loginAndInitialize();
  }
});
