export class Router {
  constructor(rootElement, routes) {
    this.rootElement = rootElement;
    this.routes = routes;
    this.currentView = null;
  }

  /**
   * @description Converts a pattern (a path) to a regular expression
   * @param {string} pattern The pattern to convert
   * @returns {RegExp} The regular expression
   */
  #handleParams(pattern) {
    const regexStr = pattern
      .replace(/\/$/, "")
      .replace(/:([^/]+)/g, "(?<$1>[^/]+)");
    return new RegExp(`^${regexStr}$`);
  }

  handleRoute() {
    let rawPath = window.location.hash.slice(1) || "/";
    if (!rawPath.startsWith('/')) rawPath = '/' + rawPath;

    const [pathPart, queryString = ""] = rawPath.split("?");
    const path = pathPart.replace(/\/$/, "") || "/";
    const queryParams = Object.fromEntries(new URLSearchParams(queryString).entries());

    let matched = false;
    for (const { pattern, handler } of this.routes) {
      const regex = this.#handleParams(pattern);
      const match = path.match(regex);
      if (match) {
        const params = { ...(match.groups || {}), ...queryParams };

        if (
          this.currentView &&
          typeof this.currentView.unmount === "function"
        ) {
          this.currentView.unmount();
        }

        this.rootElement.innerHTML = "";
        this.currentView = handler(params);

        if (this.currentView && typeof this.currentView.mount === "function") {
          this.currentView.mount(this.rootElement);
        }

        matched = true;
        break;
      }
    }

    if (!matched) {
      const homeHandler = this.routes.find((r) => r.pattern === "/");
      if (homeHandler) {
        if (
          this.currentView &&
          typeof this.currentView.unmount === "function"
        ) {
          this.currentView.unmount();
        }
        this.rootElement.innerHTML = "";
        this.currentView = homeHandler.handler({});
        if (this.currentView && typeof this.currentView.mount === "function") {
          this.currentView.mount(this.rootElement);
        }
      }
    }
  }

  start() {
    window.addEventListener("hashchange", () => this.handleRoute());
    this.handleRoute();
  }

  navigateTo(path) {
    window.location.hash = path;
  }
}
