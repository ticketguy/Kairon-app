export default async function handler(request, response) {
  // --- CORS ---
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") { response.status(200).end(); return; }

  // Device registration is a no-op for now (tracked client-side)
  // This endpoint exists so the SDK doesn't error on restore
  response.status(200).json({ status: "device_registered", device_count: 1 });
}
