export default async function handler(request, response) {

    // --- CORS BLOCK ---
    const allowedOrigin = process.env.NODE_ENV === 'production' ? 'https://kairon-eta.vercel.app' : 'http://localhost:5173';
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }
    // --- END OF CORS BLOCK ---

    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method not allowed' });
    }

  try {
    const { encryptedData, username } = request.body;
    const PINATA_JWT = process.env.PINATA_JWT; // Securely access the environment variable from Vercel

    if (!PINATA_JWT) {
      throw new Error("Server configuration error: PINATA_JWT not found.");
    }

    const pinataResponse = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({
          pinataContent: {
            kaironBackup: encryptedData,
          },
          pinataMetadata: {
            name: `${username}_kairon_backup.json`,
          },
        }),
      }
    );

    if (!pinataResponse.ok) {
      const errorBody = await pinataResponse.text();
      throw new Error(
        `IPFS upload failed: ${pinataResponse.statusText} - ${errorBody}`
      );
    }

    const responseData = await pinataResponse.json();
    // Send the IPFS hash back to the browser
    response.status(200).json({ ipfsHash: responseData.IpfsHash });
  } catch (error) {
    console.error("Backup API Error:", error);
    response
      .status(500)
      .json({ message: `An error occurred during backup: ${error.message}` });
  }
}
