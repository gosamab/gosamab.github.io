/* Lightweight window manager — vanilla TS, no deps. */

type Rect = { x: number; y: number; w: number; h: number };

type WinKind = "page" | "pdf" | "image" | "external";

type Win = {
	id: string;
	kind: WinKind;
	href: string;
	title: string;
	rect: Rect;
	prevRect: Rect | null;
	z: number;
	minimized: boolean;
	maximized: boolean;
	el: HTMLElement;
	menuItem: HTMLButtonElement;
};

const DEFAULT_W = 880;
const DEFAULT_H = 600;
const CASCADE_STEP = 30;
const CASCADE_MAX = 240;
const MENUBAR_H = 28; // 1.75rem
const ICON_GUTTER = 132; // desktop icon column (24 padding + 92 icon) + 16 gap
const MIN_FIT_W = 480;

export class WindowManager {
	private windows = new Map<string, Win>();
	private zCounter = 100;
	private root: HTMLElement;
	private menuList: HTMLElement;
	private menuWrap: HTMLElement | null;

	constructor(root: HTMLElement, menuList: HTMLElement, menuWrap: HTMLElement | null) {
		this.root = root;
		this.menuList = menuList;
		this.menuWrap = menuWrap;
		this.refreshMenuVisibility();
		window.addEventListener("resize", this.onResize);
	}

	async open(href: string): Promise<void> {
		if (href.startsWith("mailto:") || href.startsWith("tel:")) {
			window.location.href = href;
			return;
		}

		const kind = this.kindFor(href);
		const matchKey = this.matchKey(href, kind);

		const existing = [...this.windows.values()].find(
			(w) => this.matchKey(w.href, w.kind) === matchKey,
		);
		if (existing) {
			if (existing.minimized) this.toggleMinimize(existing.id, false);
			this.focus(existing.id);
			if (kind === "page") {
				const hash = splitHash(href)[1];
				existing.href = href;
				if (hash) this.scrollToHash(existing.el, hash);
			}
			return;
		}

		const win = await this.create(href, kind);
		if (!win) return;
		const hash = kind === "page" ? splitHash(href)[1] : "";
		if (hash) requestAnimationFrame(() => this.scrollToHash(win.el, hash));
	}

	close(id: string): void {
		const w = this.windows.get(id);
		if (!w) return;
		w.el.classList.add("win-closing");
		setTimeout(() => {
			w.el.remove();
			w.menuItem.remove();
			this.windows.delete(id);
			this.refreshMenuVisibility();
		}, 120);
	}

	focus(id: string): void {
		const w = this.windows.get(id);
		if (!w) return;
		w.z = ++this.zCounter;
		w.el.style.zIndex = String(w.z);
		for (const other of this.windows.values()) {
			other.el.classList.toggle("win-active", other.id === id);
			other.menuItem.classList.toggle("win-menu-item-active", other.id === id);
		}
	}

	toggleMinimize(id: string, force?: boolean): void {
		const w = this.windows.get(id);
		if (!w) return;
		const next = force ?? !w.minimized;
		w.minimized = next;
		w.el.classList.toggle("win-minimized", next);
		w.menuItem.classList.toggle("win-menu-item-minimized", next);
		if (!next) this.focus(id);
	}

	toggleMaximize(id: string): void {
		const w = this.windows.get(id);
		if (!w) return;
		if (w.maximized) {
			if (w.prevRect) this.applyRect(w.el, w.prevRect);
			w.rect = w.prevRect ?? w.rect;
			w.prevRect = null;
			w.maximized = false;
			w.el.classList.remove("win-maximized");
		} else {
			w.prevRect = { ...w.rect };
			const rect = this.maximizedRect();
			this.applyRect(w.el, rect);
			w.rect = rect;
			w.maximized = true;
			w.el.classList.add("win-maximized");
		}
		this.focus(id);
	}

	private maximizedRect(): Rect {
		return {
			x: 0,
			y: MENUBAR_H,
			w: window.innerWidth,
			h: window.innerHeight - MENUBAR_H,
		};
	}

	private kindFor(href: string): WinKind {
		if (/\.pdf(\?|#|$)/i.test(href)) return "pdf";
		if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(href)) return "image";
		if (/^https?:\/\//.test(href)) {
			try {
				const u = new URL(href);
				if (u.hostname !== window.location.hostname) return "external";
			} catch {
				/* fallthrough */
			}
		}
		return "page";
	}

	private matchKey(href: string, kind: WinKind): string {
		if (kind === "page") return splitHash(href)[0];
		return href;
	}

	private async create(href: string, kind: WinKind): Promise<Win | null> {
		let title: string;
		let bodyHtml: string;

		if (kind === "page") {
			const fetched = await this.fetchContent(splitHash(href)[0]);
			if (!fetched) {
				title = filenameOf(href) || "404";
				bodyHtml = this.notFoundBody(href);
			} else {
				title = fetched.title;
				bodyHtml = fetched.body;
			}
		} else if (kind === "pdf") {
			title = filenameOf(href);
			bodyHtml = `<iframe src="${escapeAttr(href)}" class="win-iframe" title="${escapeHtml(title)}"></iframe>`;
		} else if (kind === "image") {
			title = filenameOf(href);
			bodyHtml = `<div class="win-image-wrap"><img src="${escapeAttr(href)}" alt=""/></div>`;
		} else {
			// external
			const host = hostnameOf(href);
			title = host;
			bodyHtml = `
				<div class="win-external-card">
					<svg class="win-external-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M9 5h10v10"/>
						<path d="M19 5L8 16"/>
						<path d="M9 19H5a1 1 0 0 1-1-1v-4"/>
					</svg>
					<strong class="win-external-card-host">${escapeHtml(host)}</strong>
					<p class="win-external-card-note">External link, opens in your browser.</p>
					<a class="win-external-card-btn" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">Open ${escapeHtml(host)} ↗</a>
					<p class="win-external-card-url">${escapeHtml(href)}</p>
				</div>
			`;
		}

		const id = "win-" + Math.random().toString(36).slice(2, 9);
		const cascade = (this.windows.size * CASCADE_STEP) % CASCADE_MAX;

		const viewportW = window.innerWidth;
		const viewportH = window.innerHeight;
		// Fit between the two icon columns when there's room, so the desktop
		// stays visible on tablets and small laptops.
		const between = viewportW - 2 * ICON_GUTTER;
		const w = Math.min(DEFAULT_W, between >= MIN_FIT_W ? between : viewportW - 40);
		// Portrait screens (tablets) have height to spare; use it.
		const h =
			viewportH > viewportW
				? viewportH - MENUBAR_H - 140
				: Math.min(DEFAULT_H, viewportH - 120);
		const isFirst = this.windows.size === 0;
		const maxX = Math.max(20, viewportW - w - 20);
		const maxY = Math.max(MENUBAR_H, viewportH - h - 20);
		const rect: Rect = isFirst
			? {
					x: Math.max(20, Math.round((viewportW - w) / 2)),
					y: MENUBAR_H + 80,
					w,
					h,
				}
			: {
					x: Math.min(140 + cascade, maxX),
					y: Math.min(MENUBAR_H + 20 + cascade, maxY),
					w,
					h,
				};

		const el = this.buildWindow(id, title, bodyHtml, kind);
		this.applyRect(el, rect);
		el.style.zIndex = String(++this.zCounter);
		this.root.appendChild(el);

		const menuItem = this.buildMenuItem(id, title);
		this.menuList.appendChild(menuItem);

		const win: Win = {
			id,
			kind,
			href,
			title,
			rect,
			prevRect: null,
			z: this.zCounter,
			minimized: false,
			maximized: false,
			el,
			menuItem,
		};
		this.windows.set(id, win);
		this.wireWindow(win);
		this.refreshMenuVisibility();
		this.focus(id);
		return win;
	}

	private notFoundBody(href: string): string {
		return `
			<div class="win-notfound">
				<svg class="win-notfound-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
					<path d="M14 3v5h5"/>
					<path d="M9 14l4 4M13 14l-4 4"/>
				</svg>
				<strong class="win-notfound-title">File not found</strong>
				<p class="win-notfound-path">${escapeHtml(href)}</p>
				<p class="win-notfound-note">Couldn't find anything at that path.</p>
			</div>
		`;
	}

	private async fetchContent(
		href: string,
	): Promise<{ body: string; title: string } | null> {
		try {
			const res = await fetch(href, { headers: { Accept: "text/html" } });
			const html = await res.text();
			const doc = new DOMParser().parseFromString(html, "text/html");
			const body = doc.querySelector(".window-body");
			if (!body) return null;
			const titleEl = doc.querySelector(".window-title span");
			const title = (titleEl?.textContent ?? href).trim();
			return { body: body.innerHTML, title };
		} catch {
			return null;
		}
	}

	private buildWindow(
		id: string,
		title: string,
		bodyHtml: string,
		kind: WinKind,
	): HTMLElement {
		const el = document.createElement("div");
		el.className = `win win-active win-kind-${kind}`;
		el.dataset.winId = id;
		el.innerHTML = `
			<div class="win-titlebar" data-drag-handle>
				<div class="win-controls">
					<button class="win-btn win-close" aria-label="Close" data-action="close"><span></span></button>
					<button class="win-btn win-min" aria-label="Minimize" data-action="minimize"><span></span></button>
					<button class="win-btn win-max" aria-label="Maximize" data-action="maximize"><span></span></button>
				</div>
				<div class="win-title-text">${escapeHtml(title)}</div>
				<div class="win-controls-spacer"></div>
			</div>
			<div class="win-body window-body"></div>
		`;
		const bodyEl = el.querySelector(".win-body");
		if (bodyEl) bodyEl.innerHTML = bodyHtml;
		return el;
	}

	private buildMenuItem(id: string, title: string): HTMLButtonElement {
		const btn = document.createElement("button");
		btn.className = "win-menu-item";
		btn.dataset.winId = id;
		btn.innerHTML = `<span class="win-menu-item-dot"></span><span class="win-menu-item-label">${escapeHtml(title)}</span>`;
		btn.addEventListener("click", (e) => {
			e.preventDefault();
			const w = this.windows.get(id);
			if (!w) return;
			if (w.minimized) {
				this.toggleMinimize(id, false);
			} else {
				const isTop = w.z === this.zCounter;
				if (isTop) this.toggleMinimize(id, true);
				else this.focus(id);
			}
			this.closeMenuBar();
		});
		return btn;
	}

	private closeMenuBar(): void {
		document
			.querySelectorAll<HTMLDetailsElement>(".menubar-menu[open]")
			.forEach((d) => d.removeAttribute("open"));
	}

	private refreshMenuVisibility(): void {
		if (!this.menuWrap) return;
		this.menuWrap.style.display = this.windows.size > 0 ? "" : "none";
	}

	private wireWindow(win: Win): void {
		const titlebar = win.el.querySelector<HTMLElement>("[data-drag-handle]");
		titlebar?.addEventListener("pointerdown", (e) => this.onDragStart(e, win));
		titlebar?.addEventListener("dblclick", (e) => {
			const target = e.target as HTMLElement;
			if (target.closest("[data-action]")) return;
			this.toggleMaximize(win.id);
		});

		win.el.addEventListener("pointerdown", () => this.focus(win.id));
		win.el.querySelectorAll<HTMLElement>("[data-action]").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const action = btn.dataset.action;
				if (action === "close") this.close(win.id);
				else if (action === "minimize") this.toggleMinimize(win.id, true);
				else if (action === "maximize") this.toggleMaximize(win.id);
			});
		});

		// Intercept link clicks within the window body — open as windows.
		// Honor target="_blank" for non-icon links so explicit new-tab links
		// escape to the browser. Icons (data-desktop-icon) always intercept.
		win.el.querySelectorAll<HTMLAnchorElement>(".win-body a[href]").forEach((a) => {
			const href = a.getAttribute("href") ?? "";
			if (!href || href.startsWith("javascript:") || href === "#") return;
			const isIcon = a.hasAttribute("data-desktop-icon");
			if (a.target === "_blank" && !isIcon) return;
			a.addEventListener("click", (e) => {
				const me = e as MouseEvent;
				if (me.metaKey || me.ctrlKey || me.shiftKey || me.button !== 0) return;
				if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
				e.preventDefault();
				if (href === "/") {
					this.close(win.id);
					return;
				}
				void this.open(href);
			});
		});
	}

	private onDragStart = (e: PointerEvent, win: Win): void => {
		if (win.maximized) return;
		const target = e.target as HTMLElement;
		if (target.closest("[data-action]")) return;
		this.focus(win.id);
		const startX = e.clientX;
		const startY = e.clientY;
		const startRect = { ...win.rect };
		win.el.classList.add("win-dragging");
		(e.target as HTMLElement).setPointerCapture(e.pointerId);

		const move = (ev: PointerEvent): void => {
			const dx = ev.clientX - startX;
			const dy = ev.clientY - startY;
			win.rect = {
				...startRect,
				x: Math.max(-startRect.w + 80, Math.min(window.innerWidth - 80, startRect.x + dx)),
				y: Math.max(MENUBAR_H, Math.min(window.innerHeight - 60, startRect.y + dy)),
			};
			this.applyRect(win.el, win.rect);
		};
		const up = (): void => {
			win.el.classList.remove("win-dragging");
			document.removeEventListener("pointermove", move);
			document.removeEventListener("pointerup", up);
		};
		document.addEventListener("pointermove", move);
		document.addEventListener("pointerup", up);
	};

	private onResize = (): void => {
		const max = this.maximizedRect();
		for (const w of this.windows.values()) {
			if (w.maximized) {
				this.applyRect(w.el, max);
				w.rect = max;
			} else {
				w.rect.x = Math.min(w.rect.x, window.innerWidth - 80);
				w.rect.y = Math.min(Math.max(w.rect.y, MENUBAR_H), window.innerHeight - 60);
				this.applyRect(w.el, w.rect);
			}
		}
	};

	private scrollToHash(el: HTMLElement, hash: string): void {
		const target = el.querySelector<HTMLElement>(hash);
		if (!target) return;
		const body = el.querySelector<HTMLElement>(".win-body");
		if (!body) return;
		const offset =
			target.getBoundingClientRect().top -
			body.getBoundingClientRect().top +
			body.scrollTop -
			12;
		body.scrollTo({ top: offset, behavior: "smooth" });
	}

	private applyRect(el: HTMLElement, r: Rect): void {
		el.style.left = r.x + "px";
		el.style.top = r.y + "px";
		el.style.width = r.w + "px";
		el.style.height = r.h + "px";
	}

}

function splitHash(href: string): [string, string] {
	const i = href.indexOf("#");
	if (i === -1) return [href, ""];
	return [href.slice(0, i), href.slice(i)];
}

function filenameOf(href: string): string {
	try {
		const u = href.startsWith("http")
			? new URL(href)
			: new URL(href, window.location.origin);
		const parts = u.pathname.split("/").filter(Boolean);
		return parts[parts.length - 1] ?? href;
	} catch {
		return href.split("/").filter(Boolean).pop() ?? href;
	}
}

function hostnameOf(href: string): string {
	try {
		return new URL(href).hostname;
	} catch {
		return href;
	}
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
	return escapeHtml(s);
}

export function bootDesktop(): void {
	const isDesktop = window.matchMedia("(min-width: 768px)").matches;
	if (!isDesktop) return;

	const root = document.getElementById("window-root");
	const menuList = document.getElementById("window-list");
	const menuWrap = document.getElementById("window-menu");
	if (!root || !menuList) return;

	const wm = new WindowManager(root, menuList, menuWrap);

	const intercept = (e: MouseEvent, a: HTMLAnchorElement): void => {
		const href = a.getAttribute("href") ?? "";
		if (!href || href.startsWith("javascript:") || href === "#") return;
		if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		e.preventDefault();
		void wm.open(href);
	};

	document
		.querySelectorAll<HTMLAnchorElement>("[data-desktop-icon]")
		.forEach((a) => {
			a.addEventListener("click", (e) => intercept(e, a));
		});

	void wm.open("/home");
}
