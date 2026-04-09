const API_KEY = process.env.EMERGING_TRAVEL_API_KEY as string
const API_SECRET = process.env.EMERGING_TRAVEL_API_SECRET as string

export const authHeader = Buffer.from(`${API_KEY}:${API_SECRET}`).toString(
  "base64"
);
