const API_KEY = process.env.EMERGING_TRAVEL_API_KEY || "8317";
const API_SECRET =
  process.env.EMERGING_TRAVEL_API_SECRET ||
  "13b36e90-d7f6-45a1-9eb0-c0a561369f17";

export const authHeader = Buffer.from(`${API_KEY}:${API_SECRET}`).toString(
  "base64"
);
