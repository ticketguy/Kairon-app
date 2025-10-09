import { sql } from "@vercel/postgres";

export default async function handler(request, response) {
  // --- CORS BLOCK ---
  const allowedOrigin =
    process.env.NODE_ENV === "production"
      ? "kaironapp.vercel.app"
      : "http://localhost:5173";
  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Credentials", true);
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") {
    response.status(200).end();
    return;
  }
  // --- END OF CORS BLOCK ---

  if (request.method !== "POST") {
    return response.status(405).json({ message: "Method not allowed" });
  }
  try {
    const { app_id, username, hash } = request.body;
    await sql`
            INSERT INTO user_backups (app_id, username, ipfs_hash)
            VALUES (${app_id}, ${username}, ${hash})
            ON CONFLICT (app_id, username)
            DO UPDATE SET ipfs_hash = EXCLUDED.ipfs_hash;
        `;
    response.status(200).json({ message: "Hash updated successfully" });
  } catch (error) {
    response
      .status(500)
      .json({ message: `Error updating hash: ${error.message}` });
  }
}
