// Import required libraries
importScripts("https://unpkg.com/dexie@latest/dist/dexie.js");
importScripts(
  "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"
);

// --- PWA Caching Logic (from before) ---
const CACHE_NAME = "kairon-v1";
const FILES_TO_CACHE = [
  "/",
  "index.html",
  "style.css",
  "app.js",
  "notification.mp3",
  "/favicon_io/site.webmanifest",
  // ... all your other icon files
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Service Worker: Caching app shell");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

// --- NEW: Auto-Backup Logic ---
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "portid-auto-backup") {
    event.waitUntil(performAutoBackup());
  }
});

async function performAutoBackup() {
  console.log("Service Worker: Waking up for auto-backup...");

  // Helper function to get data from localStorage (since SW can't access it directly)
  const getLocalStorage = (key) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("localStorageDB");
      request.onupgradeneeded = () =>
        request.result.createObjectStore("localStorageStore");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("localStorageStore");
        const store = tx.objectStore("localStorageStore");
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      };
      request.onerror = () => reject(request.error);
    });
  };

  try {
    // Since the SDK is not directly available, we must replicate its logic.
    // This is a simplified version.

    // 1. Get the current user
    const currentUser = await getLocalStorage("kairon_currentUser");
    if (!currentUser) {
      console.log("Auto-backup: No user found. Skipping.");
      return;
    }

    // 2. Access both databases
    const portidDb = new Dexie(`PortID_DB_kairon-v1`);
    portidDb
      .version(1)
      .stores({ users: "&username, hashedPassword, recoveryKey, backupHash" });

    const kaironDb = new Dexie("KaironAppCache");
    kaironDb
      .version(1)
      .stores({
        tasks: "++id",
        interests: "++id",
        settings: "key",
        inspirations: "++id",
      });

    // 3. Get user credentials and all app data
    const user = await portidDb.users.get(currentUser);
    if (!user || !user.recoveryKey)
      throw new Error("Credentials not found in SDK DB.");

    const [tasks, interests, inspirations, settings] = await Promise.all([
      kaironDb.tasks.toArray(),
      kaironDb.interests.toArray(),
      kaironDb.inspirations.toArray(),
      kaironDb.settings.get(`${currentUser}_settings`),
    ]);

    const dataToBackup = {
      tasks,
      interests,
      inspirations,
      settings: settings.value,
    };
    const secretKey = user.recoveryKey;

    // 4. Encrypt and call the backup API
    const dataString = JSON.stringify(dataToBackup);
    const encryptedData = CryptoJS.AES.encrypt(
      dataString,
      secretKey
    ).toString();

    const backupResponse = await fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encryptedData, username: currentUser }),
    });

    if (!backupResponse.ok) throw new Error("Backup API call failed.");

    const backupData = await backupResponse.json();
    const ipfsHash = backupData.ipfsHash;

    // 5. Update the hashes in both databases
    await portidDb.users.update(currentUser, { backupHash: ipfsHash });
    await fetch("/api/set-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: "kairon-v1",
        username: currentUser,
        hash: ipfsHash,
      }),
    });

    console.log("Auto-backup successful.");
  } catch (error) {
    console.error("Auto-backup failed:", error);
  }
}
