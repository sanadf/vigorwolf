/* VIGORWOLF — thin API client over the Cloudflare Functions backend. */
(function () {
  async function request(path, options = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    let data = {};
    try { data = await res.json(); } catch { /* non-json (csv) */ }
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  window.API = {
    // public
    products: () => request("/api/products"),
    product: (slug) => request("/api/products?slug=" + encodeURIComponent(slug)),
    currentDrop: () => request("/api/drops?current=1"),
    drops: () => request("/api/drops"),
    signup: (email, source) => request("/api/signups", { method: "POST", body: JSON.stringify({ email, source }) }),
    contact: (payload) => request("/api/contact", { method: "POST", body: JSON.stringify(payload) }),
    createOrder: (payload) => request("/api/orders/create", { method: "POST", body: JSON.stringify(payload) }),
    order: (number) => request("/api/orders?number=" + encodeURIComponent(number)),
    ordersByEmail: (email) => request("/api/orders?email=" + encodeURIComponent(email)),
    userPoints: (email) => request("/api/user/points?email=" + encodeURIComponent(email)),
    validateCoupon: (code, subtotal) => request("/api/coupons/validate", { method: "POST", body: JSON.stringify({ code, subtotal }) }),

    // customer accounts (real, D1-backed)
    auth: {
      register: (data) => request("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
      login: (email, password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
      logout: () => request("/api/auth/logout", { method: "POST" }),
      me: () => request("/api/auth/me"),
      updateProfile: (patch) => request("/api/auth/profile", { method: "PATCH", body: JSON.stringify(patch) }),
    },

    // admin
    admin: {
      login: (email, password) => request("/api/admin/login", { method: "POST", body: JSON.stringify({ email, password }) }),
      logout: () => request("/api/admin/logout", { method: "POST" }),
      me: () => request("/api/admin/me"),
      stats: () => request("/api/admin/stats"),
      orders: (q = "", status = "") => request(`/api/admin/orders?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`),
      setOrderStatus: (id, status) => request(`/api/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
      products: () => request("/api/admin/products"),
      createProduct: (p) => request("/api/admin/products", { method: "POST", body: JSON.stringify(p) }),
      updateProduct: (id, p) => request(`/api/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(p) }),
      deleteProduct: (id) => request(`/api/admin/products/${id}`, { method: "DELETE" }),
      drops: () => request("/api/admin/drops"),
      createDrop: (d) => request("/api/admin/drops", { method: "POST", body: JSON.stringify(d) }),
      updateDrop: (id, d) => request(`/api/admin/drops/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
      signups: () => request("/api/admin/signups"),
      signupsCsvUrl: "/api/admin/signups?format=csv",
      coupons: () => request("/api/admin/coupons"),
      createCoupon: (c) => request("/api/admin/coupons", { method: "POST", body: JSON.stringify(c) }),
      updateCoupon: (id, c) => request(`/api/admin/coupons/${id}`, { method: "PATCH", body: JSON.stringify(c) }),
      deleteCoupon: (id) => request(`/api/admin/coupons/${id}`, { method: "DELETE" }),
      testEmail: () => request("/api/admin/test-email", { method: "POST" }),
      loyaltyTransactions: () => request("/api/admin/loyalty-transactions"),
      users: () => request("/api/admin/users"),
      adjustPoints: (id, points, note) => request(`/api/admin/users/${id}/points`, { method: "PATCH", body: JSON.stringify({ points, note }) }),
      dbInfo: () => request("/api/admin/db-info"),
    },
  };
})();
