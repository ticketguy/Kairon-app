import { sql } from "@vercel/postgres";

export default async function handler(request, response) {
  // --- CORS BLOCK ---
  const allowedOrigins = ["https://kaironapp.vercel.app", "http://localhost:5173", "http://localhost:3000"];
  const origin = request.headers.origin;
  if (allowedOrigins.includes(origin) || !origin) {
    response.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") {
    response.status(200).end();
    return;
  }
  // --- END CORS ---

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { app_id, username } = request.body;
    if (!app_id || !username) {
      return response.status(400).json({ error: "app_id and username required" });
    }

    // Check if user already exists
    const existing = await sql`
      SELECT username FROM user_backups WHERE app_id = ${app_id} AND username = ${username}
    `;

    if (existing.rows.length > 0) {
      return response.status(409).json({ error: "Username already registered for this app" });
    }

    // Create user entry with null hash (will be set on first backup)
    await sql`
      INSERT INTO user_backups (app_id, username, ipfs_hash)
      VALUES (${app_id}, ${username}, NULL)
    `;

    response.status(200).json({ status: "registered", app_id, username });
  } catch (error) {
    console.error("Register error:", error);
    response.status(500).json({ error: `Registration failed: ${error.message}` });
  }
}
