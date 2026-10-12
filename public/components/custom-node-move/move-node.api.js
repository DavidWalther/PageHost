// Moves a node below a new parent — or to the top level without one.
// Whether the move is allowed (not below itself, not in or out of the feeds)
// the backend decides; its reason comes back as the error message.
import { authenticatedFetch } from '/modules/authTokenManager.js';

export async function moveNode({ id, parentId }) {
  if (!id) throw new Error('Missing id');
  const res = await authenticatedFetch('/api/1.0/data/change/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      object: 'node',
      // No sort number: the node stands at the end of its new siblings.
      payload: { id, parent_node_id: parentId ?? null, sortnumber: null },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Move failed');
  }
  return true;
}
