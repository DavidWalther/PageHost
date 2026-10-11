// Löscht einen Knoten samt allem, was ohne ihn keinen Bestand hat.
// Die Reihenfolge (Inhalte, Kinder, App-Zeilen, Knoten) macht die Datenschicht;
// hier wird nur die Absicht gemeldet.
import { authenticatedFetch } from '/modules/authTokenManager.js';

export async function deleteNode({ id }) {
  if (!id) throw new Error('Missing id');
  const url = `/api/1.0/data/delete?object=node&id=${encodeURIComponent(id)}`;
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
