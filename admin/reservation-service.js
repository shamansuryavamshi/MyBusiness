/* ============================================
   RESERVATION SERVICE — read / confirm / cancel / delete
   Backed by api/reservations.js (GitHub repo reservations.json).
   Customer-created reservations appear here instantly.
   ============================================ */

const ReservationService = (() => {
  let cache = [];
  let cacheDessert = { quantity: 5, remaining: 5 };

  async function refresh() {
    const res = await ApiService.getReservations();
    if (res && Array.isArray(res.reservations)) cache = res.reservations;
    try {
      const pub = await ApiService.get();
      if (pub && pub.weeklyDessert) cacheDessert = pub.weeklyDessert;
    } catch (_) {}
    return cache;
  }

  function all() {
    return cache;
  }

  function dessert() {
    return cacheDessert;
  }

  function reservedQty() {
    return cache
      .filter((r) => r.status === 'pending' || r.status === 'confirmed')
      .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  }

  function remaining() {
    return Math.max(0, (Number(cacheDessert.quantity) || 5) - reservedQty());
  }

  function counts() {
    const reserved = reservedQty();
    return {
      available: Number(cacheDessert.quantity) || 5,
      reserved,
      remaining: remaining(),
      pending: cache.filter((r) => r.status === 'pending').length,
      confirmed: cache.filter((r) => r.status === 'confirmed').length,
      cancelled: cache.filter((r) => r.status === 'cancelled').length,
    };
  }

  async function setStatus(id, status) {
    await ApiService.postReservation({ action: 'update', id, status });
    await refresh();
  }

  async function remove(id) {
    await ApiService.postReservation({ action: 'delete', id });
    await refresh();
  }

  async function reset() {
    await ApiService.postReservation({ action: 'reset' });
    await refresh();
  }

  return { refresh, all, dessert, reservedQty, remaining, counts, setStatus, remove, reset };
})();
