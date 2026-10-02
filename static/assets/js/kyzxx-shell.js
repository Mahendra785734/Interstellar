// kyzxx-shell.js — app layout shell: sidebar, bottom bar, theme toggle
(function () {
  "use strict";

  const navItems = [
    { path: "/", icon: "fa-house", label: "Home" },
    { path: "/a", icon: "fa-gamepad", label: "Play" },
    { path: "/b", icon: "fa-th-large", label: "Apps" },
    { path: "/chat", icon: "fa-comments", label: "Chat" },
    { path: "/ai", icon: "fa-robot", label: "AI" },
    { path: "/listen", icon: "fa-music", label: "Listen" },
    { path: "/watch", icon: "fa-tv", label: "Watch" },
    { path: "/d", icon: "fa-compass", label: "Browse" },
  ];

  const settingsItem = { path: "/c", icon: "fa-gear", label: "Settings" };

  function currentPath() {
    return window.location.pathname;
  }

  function navHtml(items) {
    return items
      .map((item) => {
        const active = currentPath() === item.path ? " active" : "";
        return `<a href="${item.path}" class="kz-nav-item${active}" aria-label="${item.label}">
          <i class="fa-solid ${item.icon}"></i>
          <span>${item.label}</span>
        </a>`;
      })
      .join("");
  }

  function injectSidebar() {
    const sidebar = document.createElement("nav");
    sidebar.className = "kz-sidebar";
    sidebar.innerHTML = `
      <div class="kz-sidebar-logo">K</div>
      <div class="kz-sidebar-nav">${navHtml(navItems)}</div>
      <button class="kz-theme-toggle" id="kz-theme-btn" aria-label="Toggle theme">
        <i class="fa-solid fa-moon"></i>
      </button>
    `;
    document.body.insertBefore(sidebar, document.body.firstChild);

    document.getElementById("kz-theme-btn").addEventListener("click", toggleTheme);
  }

  function injectBottomBar() {
    const bar = document.createElement("nav");
    bar.className = "kz-bottom-bar";
    bar.innerHTML = navHtml(navItems);
    document.body.appendChild(bar);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("kz-theme", theme);
    const btn = document.getElementById("kz-theme-btn");
    if (btn) {
      btn.querySelector("i").className = theme === "dark" ? "fa-solid fa-moon" : "fa-solid fa-sun";
    }
  }

  function toggleTheme() {
    const current = localStorage.getItem("kz-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  function init() {
    const theme = localStorage.getItem("kz-theme") || "dark";
    applyTheme(theme);
    injectSidebar();
    injectBottomBar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
