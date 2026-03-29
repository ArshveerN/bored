const API_URL = "https://bob0uiabw6.execute-api.us-east-1.amazonaws.com";

export interface Location {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

export async function getLocations(): Promise<Location[]> {
  const res = await fetch(`${API_URL}/locations`);
  if (!res.ok) throw new Error(`GET /locations failed: ${res.status}`);
  return res.json();
}

export async function postLocation(
  data: Omit<Location, "id">
): Promise<Location> {
  const res = await fetch(`${API_URL}/locations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`POST /locations failed: ${res.status}`);
  return res.json();
}

export async function deleteLocation(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/locations/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`DELETE /locations/${id} failed: ${res.status}`);
}
