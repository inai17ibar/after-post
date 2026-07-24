(function () {
  function resolveEventId(pathname = window.location.pathname, search = window.location.search) {
    const pathMatch = pathname.match(/\/e\/([^/]+)/);
    if (pathMatch) return decodeURIComponent(pathMatch[1]);
    const queryEventId = new URLSearchParams(search).get('event');
    if (queryEventId) return queryEventId;
    return null;
  }

  function resolveAdminParams(pathname = window.location.pathname) {
    const match = pathname.match(/\/admin\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    return { eventId: decodeURIComponent(match[1]), adminToken: decodeURIComponent(match[2]) };
  }

  async function fetchEvent(eventId) {
    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to load event: ${response.status}`);
    return response.json();
  }

  async function fetchDashboard(eventId, adminToken) {
    const response = await fetch(`/api/admin/${encodeURIComponent(eventId)}/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (response.status === 403) return { error: 'forbidden' };
    if (response.status === 404) return { error: 'not_found' };
    if (!response.ok) throw new Error(`Failed to load dashboard: ${response.status}`);
    return { stats: await response.json() };
  }

  window.resolveAfterPostEventId = resolveEventId;
  window.resolveAfterPostAdminParams = resolveAdminParams;
  window.fetchAfterPostEvent = fetchEvent;
  window.fetchAfterPostDashboard = fetchDashboard;
})();
