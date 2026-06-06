// Handles API calls for paragraph deletion
import { authenticatedFetch } from '/modules/authTokenManager.js';

export async function deleteParagraph({ id }) {
  if (!id) throw new Error('Missing id');
  const url = `/api/1.0/data/delete?object=paragraph&id=${encodeURIComponent(id)}`;
  const res = await authenticatedFetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Delete failed');
  }
  return true;
}
