/**
 * Loads shared partials: partials/nav-shell.html + partials/footer.html
 * Bootstrap 5 navbar (mobile collapse). Requires Bootstrap CSS + bundle JS before this script.
 * Expects <body data-page="...">, <div id="navMount"></div>, optional <div id="footerMount"></div>.
 */
(function () {
  const page = document.body.getAttribute("data-page") || "";
  const mount = document.getElementById("navMount");
  if (!mount) return;

  const publicItems = [
    { href: "/login", label: "Sign in", key: "login" },
    { href: "/register", label: "Register", key: "register" },
    { href: "/forgot-password", label: "Forgot password", key: "forgot-password" },
  ];

  const baseAppItems = [
    { href: "/", label: "Dashboard", key: "dashboard" },
    { href: "/connection", label: "Connection", key: "connection" },
    { href: "/api", label: "API", key: "api" },
    { href: "/profile", label: "Profile", key: "profile" },
  ];

  const appPages = ["dashboard", "connection", "api", "profile", "admin"];

  const navLinkClass = (key) => {
    const active = page === key ? " active" : "";
    return `nav-link${active}`;
  };

  const loadNavShell = async () => {
    const r = await fetch("/partials/nav-shell.html", { cache: "no-store" });
    if (!r.ok) throw new Error("Failed to load nav partial");
    mount.innerHTML = await r.text();
  };

  const loadFooter = async () => {
    const el = document.getElementById("footerMount");
    if (!el) return;
    const r = await fetch("/partials/footer.html", { cache: "no-store" });
    if (!r.ok) throw new Error("Failed to load footer partial");
    el.outerHTML = (await r.text()).trim();
  };

  const renderPublic = () => {
    const brand = document.getElementById("navBrandLink");
    if (brand) brand.setAttribute("href", "/login");

    const ul = document.getElementById("navLinksMount");
    if (!ul) return;
    ul.innerHTML = publicItems
      .map(
        (i) =>
          `<li class="nav-item"><a class="${navLinkClass(i.key)}" href="${i.href}">${i.label}</a></li>`
      )
      .join("");
  };

  const renderApp = (items) => {
    const brand = document.getElementById("navBrandLink");
    if (brand) brand.setAttribute("href", "/");

    const ul = document.getElementById("navLinksMount");
    if (!ul) return;
    const linksHtml = items
      .map(
        (i) =>
          `<li class="nav-item"><a class="${navLinkClass(i.key)}" href="${i.href}">${i.label}</a></li>`
      )
      .join("");
    ul.innerHTML = `${linksHtml}
              <li class="nav-item ms-lg-2 mt-1 mt-lg-0">
                <button type="button" class="btn btn-outline-secondary btn-sm" id="navLogoutBtn">Logout</button>
              </li>`;

    document.getElementById("navLogoutBtn")?.addEventListener("click", async () => {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
      } catch (_) {
        /* redirect anyway */
      }
      window.location.href = "/login";
    });
  };

  (async () => {
    try {
      await loadNavShell();
    } catch (err) {
      console.error(err);
      mount.innerHTML =
        '<p class="text-danger p-2 small">Navigation failed to load. Check /partials/nav-shell.html</p>';
      return;
    }

    if (!appPages.includes(page)) {
      renderPublic();
      try {
        await loadFooter();
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    let isAdmin = false;
    try {
      const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      isAdmin = !!(data?.user?.isAdmin);
    } catch (_) {
      /* ignore */
    }

    const items = [...baseAppItems];
    if (isAdmin) {
      items.push({ href: "/admin", label: "Admin", key: "admin" });
    }
    renderApp(items);

    try {
      await loadFooter();
    } catch (e) {
      console.warn(e);
    }
  })();
})();
