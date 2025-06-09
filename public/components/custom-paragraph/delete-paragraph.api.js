// Handles API calls for paragraph deletion
export async function deleteParagraph({ id, token }) {
  if (!id || !token) throw new Error('Missing id or token');
  const url = `/api/1.0/data/delete?object=paragraph&id=${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Delete failed');
  }
  return true;
}
