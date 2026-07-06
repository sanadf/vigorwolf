/* ==========================================================================
   VIGORWOLF — admin shell (sidebar, auth guard, helpers)
   Requires: config.js, api.js  (loaded before this file)
   ========================================================================== */
(function () {
  const ICON = {
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    prod: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 7 12 3 4 7v10l8 4 8-4z"/><path d="m4 7 8 4 8-4M12 11v10"/></svg>',
    order: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 2h9l3 3v17H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 12l9-9 9 9-9 9z"/><circle cx="9" cy="9" r="1.3"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l2.6 5.6 6 .8-4.3 4.2 1 6L12 17l-5.3 2.6 1-6L3.4 9.4l6-.8z"/></svg>',
    exit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 21H4V3h5"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>',
  };
  const NAV = [
    ["dashboard.html", "Dashboard", ICON.dash],
    ["products.html", "Products", ICON.prod],
    ["orders.html", "Orders", ICON.order],
    ["drops.html", "Drops", ICON.drop],
    ["coupons.html", "Coupons", ICON.tag],
    ["loyalty.html", "Loyalty", ICON.star],
    ["signups.html", "Signups", ICON.mail],
  ];

  function renderShell(activeFile) {
    const side = document.getElementById("admin-side");
    if (!side) return;
    side.className = "admin-side"; side.id = "admin-side";
    side.innerHTML = `
      <div class="admin-side__logo">
        <img src="/assets/media/logo-white.png" alt=""><b>VIGOR<span>WOLF</span></b>
      </div>
      <nav class="admin-nav">
        ${NAV.map(([f, t, ic]) => `<a href="/admin/${f}"${f === activeFile ? ' aria-current="page"' : ""}>${ic}<span>${t}</span></a>`).join("")}
        <div class="divider"></div>
        <a href="/" target="_blank">${ICON.exit}<span>View Site</span></a>
        <a href="#" data-admin-logout>${ICON.exit}<span>Logout</span></a>
      </nav>`;
    side.querySelector("[data-admin-logout]").addEventListener("click", async (e) => {
      e.preventDefault();
      try { await API.admin.logout(); } catch {}
      location.href = "/admin/";
    });
    // mobile toggle
    const btn = document.querySelector("[data-admin-menu]");
    if (btn) btn.addEventListener("click", () => {
      const open = side.getAttribute("data-open") === "1";
      side.setAttribute("data-open", open ? "0" : "1");
    });
  }

  // Guard: verify session, then render page. Returns admin email or redirects.
  async function guard(activeFile, onReady) {
    try {
      const me = await API.admin.me();
      renderShell(activeFile);
      onReady(me);
    } catch (e) {
      location.href = "/admin/?next=" + encodeURIComponent(location.pathname);
    }
  }

  const money = (n) => `${Number(n || 0).toFixed(2)} ${window.VW_CONFIG.currency}`;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtDate = (s) => { try { return new Date(s + " UTC").toLocaleString(); } catch { return s; } };

  window.ADMIN = { guard, renderShell, money, esc, fmtDate, ICON };
})();
