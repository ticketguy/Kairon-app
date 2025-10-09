export default async function handler(request, response) {
  // --- CORS BLOCK ---
  const allowedOrigin =
    process.env.NODE_ENV === "production"
      ? "https://kairon-eta.vercel.app"
      : "http://localhost:5173";
  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); // Only GET is needed
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") {
    response.status(200).end();
    return;
  }
  // --- END OF CORS BLOCK ---

  const { location } = request.query;
  const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

  if (!location || !WEATHER_API_KEY) {
    return response
      .status(400)
      .json({ message: "Missing location or server API key" });
  }

  const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${WEATHER_API_KEY}&units=metric`;

  try {
    const weatherResponse = await fetch(apiUrl);
    if (!weatherResponse.ok) {
      throw new Error(
        `Failed to fetch weather data: ${weatherResponse.statusText}`
      );
    }
    const weatherData = await weatherResponse.json();
    response.status(200).json(weatherData);
  } catch (error) {
    console.error(error);
    response.status(500).json({ message: "Error fetching weather data" });
  }
}
