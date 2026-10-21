export async function restoreSession(token, request = fetch) {
  if (!token) return null;
  try {
    const response = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function clearStoredSession(storage) {
  storage.removeItem('token');
  storage.removeItem('user');
}
