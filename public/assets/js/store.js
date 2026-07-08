/* ==========================================================================
   VIGORWOLF — client-side state
   - Cart + wishlist live in localStorage (pre-checkout only).
   - User accounts are a MOCK localStorage system (this is a demo storefront
     account layer; the real/hashed auth is admin-only via the backend).
   - Orders themselves are persisted server-side in Cloudflare D1.
   ========================================================================== */
(function () {
  const KEYS = { cart: "vw_cart", user: "vw_users", session: "vw_session", wish: "vw_wishlist" };
  const read = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const emit = () => document.dispatchEvent(new CustomEvent("vw:cart-changed"));

  const money = (n) => `${Number(n || 0).toFixed(2)} ${window.VW_CONFIG.currency}`;

  /* --------------------------------------------------------------- cart */
  const Cart = {
    all: () => read(KEYS.cart, []),
    count() { return this.all().reduce((s, i) => s + i.qty, 0); },
    subtotal() { return this.all().reduce((s, i) => s + i.price * i.qty, 0); },
    _key: (i) => `${i.productId}|${i.size}|${i.color}`,
    add(item) {
      const items = this.all();
      const found = items.find((i) => this._key(i) === this._key(item));
      if (found) found.qty += item.qty || 1;
      else items.push({ ...item, qty: item.qty || 1 });
      write(KEYS.cart, items); emit();
    },
    setQty(key, qty) {
      const items = this.all().map((i) => (this._key(i) === key ? { ...i, qty: Math.max(1, qty) } : i));
      write(KEYS.cart, items); emit();
    },
    remove(key) { write(KEYS.cart, this.all().filter((i) => this._key(i) !== key)); emit(); },
    clear() { write(KEYS.cart, []); emit(); },
  };

  /* --------------------------------------------------------------- wishlist */
  const Wishlist = {
    all: () => read(KEYS.wish, []),
    has: (slug) => Wishlist.all().includes(slug),
    toggle(slug) {
      let list = Wishlist.all();
      list = list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
      write(KEYS.wish, list);
      document.dispatchEvent(new CustomEvent("vw:wish-changed"));
      return list.includes(slug);
    },
  };

  /* --------------------------------------------------------------- user (real, D1-backed)
     Accounts live in Cloudflare D1 and the session is an HttpOnly cookie set by
     the server — so one account works across every device/browser. The tiny
     `vw_session` cache below holds ONLY {name,email} for instant header rendering;
     it is never used for auth decisions (the server validates the cookie). */
  const authChanged = () => document.dispatchEvent(new CustomEvent("vw:auth"));
  const User = {
    // Cached identity for instant UI (may be stale until me() reconciles).
    current: () => read(KEYS.session, null),
    isLoggedIn: () => !!read(KEYS.session, null),

    async register(data) {
      const r = await window.API.auth.register(data);
      write(KEYS.session, r.user); authChanged();
      return r.user;
    },
    async login(email, password) {
      const r = await window.API.auth.login(String(email).trim(), password);
      write(KEYS.session, r.user); authChanged();
      return r.user;
    },
    async logout() {
      try { await window.API.auth.logout(); } catch {}
      localStorage.removeItem(KEYS.session); authChanged();
    },
    // Validate the session with the server; returns the full profile or null.
    async me() {
      try {
        const r = await window.API.auth.me();
        write(KEYS.session, { name: r.user.name, email: r.user.email });
        return r.user;
      } catch {
        localStorage.removeItem(KEYS.session);
        return null;
      }
    },
    // Full profile (server round-trip).
    async profile() { return this.me(); },
    async update(patch) {
      await window.API.auth.updateProfile(patch);
      const s = read(KEYS.session, {}) || {};
      if (patch.name) write(KEYS.session, { ...s, name: patch.name });
      authChanged();
    },
  };

  window.VW = { Cart, Wishlist, User, money };
})();
