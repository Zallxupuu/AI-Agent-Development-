export async function checkMLNickname(userId: string, zoneId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.isan.eu.org/nickname/ml?id=${userId}&server=${zoneId}`);
    if (!res.ok) return null;
    
    const data = await res.json();
    if (data.success && data.name) {
      // Sometimes the API returns URI encoded names like Zallxupuu%20, let's try decoding
      try {
         return decodeURIComponent(data.name);
      } catch (e) {
         return data.name;
      }
    }
    return null;
  } catch (err) {
    console.error("Error checking ML nickname:", err);
    return null;
  }
}
