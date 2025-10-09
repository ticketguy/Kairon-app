import { sql } from "@vercel/postgres";

export default async function handler(request, response) {
  // --- CORS BLOCK ---
  const allowedOrigin =
    process.env.NODE_ENV === "production"
      ? "https://kairon-eta.vercel.app"
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

  try {
    const { app_id, username } = request.query;
    const { rows } = await sql`
            SELECT ipfs_hash FROM user_backups WHERE app_id = ${app_id} AND username = ${username};
        `;
    if (rows.length === 0) {
      return response
        .status(404)
        .json({ message: "No backup found for this user." });
    }
    response.status(200).json({ ipfsHash: rows[0].ipfs_hash });
  } catch (error) {
    response
      .status(500)
      .json({ message: `Error retrieving hash: ${error.message}` });
  }
}
