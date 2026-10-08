/* Drag-to-reposition desktop icons with localStorage persistence. */

type Pos = { x: number; y: number };
type State = Record<string, Pos>;

const STORAGE_KEY = "desktop-icon-positions";
const DRAG_THRESHOLD = 4;
const ICON_W = 92;
const STEP_Y = 96;
const PADDING = 24;

function load(): State {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return typeof parsed === "object" && parsed !== null ? (parsed as State) : {};
	} catch {
		return {};
	}
}

function save(state: State): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		/* ignore */
	}
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

function setPos(el: HTMLElement, p: Pos): void {
	el.style.left = p.x + "px";
	el.style.top = p.y + "px";
}

function defaultPos(icon: HTMLElement, canvas: HTMLElement): Pos {
	const side = icon.dataset.defaultSide ?? "left";
	const idx = parseInt(icon.dataset.defaultIdx ?? "0", 10);
	const y = PADDING + idx * STEP_Y;
	const x =
		side === "right"
			? Math.max(PADDING, canvas.clientWidth - PADDING - ICON_W)
			: PADDING;
	return { x, y };
}

export function bootArranger(): void {
	const isDesktop = window.matchMedia("(min-width: 768px)").matches;
	if (!isDesktop) return;

	const canvas = document.querySelector<HTMLElement>("[data-arrange-canvas]");
	if (!canvas) return;

	canvas.dataset.arrangeActive = "true";

	const state = load();
	const icons = Array.from(
		canvas.querySelectorAll<HTMLElement>("[data-icon-id]"),
	);

	for (const icon of icons) {
		const id = icon.dataset.iconId ?? "";
		const saved = state[id];
		setPos(icon, saved ?? defaultPos(icon, canvas));
	}

	for (const icon of icons) {
		let pStartX = 0;
		let pStartY = 0;
		let originX = 0;
		let originY = 0;
		let dragging = false;
		let moved = false;

		icon.addEventListener("pointerdown", (e) => {
			if (e.button !== 0) return;
			// Avoid initiating drag on inner interactive elements (none currently)
			dragging = true;
			moved = false;
			originX = parseFloat(icon.style.left) || 0;
			originY = parseFloat(icon.style.top) || 0;
			pStartX = e.clientX;
			pStartY = e.clientY;
			icon.setPointerCapture(e.pointerId);
			icon.classList.add("desktop-icon-dragging");
		});

		icon.addEventListener("pointermove", (e) => {
			if (!dragging) return;
			const dx = e.clientX - pStartX;
			const dy = e.clientY - pStartY;
			if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
				moved = true;
			}
			if (moved) {
				const x = clamp(originX + dx, 0, canvas.clientWidth - icon.offsetWidth);
				const y = clamp(originY + dy, 0, canvas.clientHeight - icon.offsetHeight);
				setPos(icon, { x, y });
			}
		});

		const finishDrag = (e: PointerEvent): void => {
			if (!dragging) return;
			dragging = false;
			icon.classList.remove("desktop-icon-dragging");
			try {
				icon.releasePointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
			if (moved) {
				const id = icon.dataset.iconId ?? "";
				const x = parseFloat(icon.style.left) || 0;
				const y = parseFloat(icon.style.top) || 0;
				if (id) {
					state[id] = { x, y };
					save(state);
				}
				icon.dataset.justDragged = "1";
				window.setTimeout(() => {
					delete icon.dataset.justDragged;
				}, 50);
			}
		};

		icon.addEventListener("pointerup", finishDrag);
		icon.addEventListener("pointercancel", finishDrag);

		// Suppress click navigation when a drag actually happened.
		icon.addEventListener(
			"click",
			(e) => {
				if (icon.dataset.justDragged === "1") {
					e.preventDefault();
					e.stopImmediatePropagation();
				}
			},
			true,
		);
	}
}

export function resetDesktopPositions(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		/* ignore */
	}
}
