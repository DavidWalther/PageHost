// Handles API calls for chapter deletion
import { authenticatedFetch } from '/modules/authTokenManager.js';

export async function deleteChapter({ id }) {
  if (!id) throw new Error('Missing id');
  const url = `/api/1.0/data/delete?object=chapter&id=${encodeURIComponent(id)}`;
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
