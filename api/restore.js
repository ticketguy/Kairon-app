export default async function handler(request, response) {
  // --- CORS BLOCK ---
  const allowedOrigin =
    process.env.NODE_ENV === "production"
      ? "https://kaironapp.vercel.app" // NOTE: I've updated this to your new URL
      : "http://localhost:5173";

  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(200).end();
    return;
  }
  // --- END OF CORS BLOCK ---

  const { hash } = request.query;
  if (!hash) {
    return response.status(400).json({ message: "Missing hash" });
  }

  const url = `https://gateway.pinata.cloud/ipfs/${hash}`;

  try {
    // CORRECTED: No Authorization header is needed to fetch a public file.
    const fileResponse = await fetch(url);

    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch from IPFS: ${fileResponse.statusText}`);
    }

    const data = await fileResponse.json();
    response.status(200).json(data);
  } catch (error) {
    console.error("Restore API Error:", error);
    response
      .status(500)
      .json({ message: "Error fetching backup from network." });
  }
}
