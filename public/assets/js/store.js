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

  /* --------------------------------------------------------------- user (mock) */
  const User = {
    current: () => read(KEYS.session, null),
    isLoggedIn: () => !!read(KEYS.session, null),
    register(data) {
      const users = read(KEYS.user, []);
      if (users.some((u) => u.email === data.email.toLowerCase()))
        throw new Error("An account with this email already exists.");
      const user = {
        name: data.name, email: data.email.toLowerCase(), password: btoa(data.password),
        phone: data.phone || "", city: data.city || "", address: data.address || "",
      };
      users.push(user); write(KEYS.user, users);
      write(KEYS.session, { name: user.name, email: user.email });
      return user;
    },
    login(email, password) {
      const users = read(KEYS.user, []);
      const u = users.find((x) => x.email === email.toLowerCase() && x.password === btoa(password));
      if (!u) throw new Error("Invalid email or password.");
      write(KEYS.session, { name: u.name, email: u.email });
      return u;
    },
    logout() { localStorage.removeItem(KEYS.session); },
    profile() {
      const s = User.current(); if (!s) return null;
      return read(KEYS.user, []).find((u) => u.email === s.email) || null;
    },
    update(patch) {
      const s = User.current(); if (!s) return;
      const users = read(KEYS.user, []).map((u) => (u.email === s.email ? { ...u, ...patch } : u));
      write(KEYS.user, users);
      if (patch.name) write(KEYS.session, { ...s, name: patch.name });
    },
  };

  window.VW = { Cart, Wishlist, User, money };
})();
