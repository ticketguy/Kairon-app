export default async function handler(request, response) {

   const allowedOrigin =
     process.env.NODE_ENV === "production"
       ? "kaironapp.vercel.app" // Your live app's URL
       : "http://localhost:5173"; // Your local dev server's URL

   // Set the secure CORS headers
   response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
   response.setHeader("Access-Control-Allow-Credentials", true);
   response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
   response.setHeader("Access-Control-Allow-Headers", "Content-Type");

   // Handle the browser's preflight request
   if (request.method === "OPTIONS") {
     response.status(200).end();
     return;
   }
   
  const { hash } = request.query; // Get the IPFS hash from the URL
  const PINATA_JWT = process.env.PINATA_JWT; // Get the secret key

  if (!hash || !PINATA_JWT) {
    return response
      .status(400)
      .json({ message: "Missing hash or server API key" });
  }

  // This is the Pinata gateway URL to retrieve a file
  const url = `https://gateway.pinata.cloud/ipfs/${hash}`;

  try {
    const fileResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
    });

    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch from IPFS: ${fileResponse.statusText}`);
    }

    const data = await fileResponse.json();
    // Send the encrypted data back to the browser
    response.status(200).json(data);
  } catch (error) {
    console.error("Restore API Error:", error);
    response
      .status(500)
      .json({ message: "Error fetching backup from network." });
  }
}
