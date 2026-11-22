/* Clean-URL adapter: /about, /grid, /contact and /projects/<slug> map to
   the template's internal hash views, and the title follows the view. */

const projectPath = (slug) => `/projects/${slug}`;

export const pathFor = (hash) => {
  if (!hash || hash === "#" || hash === "#index") return "/";
  if (hash === "#about") return "/about";
  if (hash === "#grid") return "/grid";
  if (hash === "#contact") return "/contact";
  return projectPath(hash.slice(1));
};

export const routeHash = () => {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/about") return "#about";
  if (path === "/grid") return "#grid";
  if (path === "/contact") return "#contact";
  const project = path.match(/^\/projects\/([^/]+)$/);
  return project ? `#${project[1]}` : "";
};

const titleFor = (hash) => {
  if (!hash) return "Dylan Calluy — Photographer";
  if (hash === "#about") return "About — Dylan Calluy";
  if (hash === "#grid") return "Grid — Dylan Calluy";
  if (hash === "#contact") return "Contact — Dylan Calluy";
  const row = document.querySelector(
    `.project[data-project="${hash.slice(1)}"] .project__name`
  );
  return row
    ? `${row.textContent.trim()} — Dylan Calluy`
    : "Dylan Calluy — Photographer";
};

export const syncTitle = () => {
  document.title = titleFor(routeHash());
};

export const navigate = (hash) => {
  const path = pathFor(hash);
  if (location.pathname !== path) history.pushState(null, "", path);
  document.title = titleFor(hash);
};

document.addEventListener("DOMContentLoaded", syncTitle);
window.addEventListener("popstate", syncTitle);
