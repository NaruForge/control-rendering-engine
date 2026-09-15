import './viewport.css';

/** Viewport only: zoom never changes model data, layout geometry or exported SVG. */
export function createViewport() {
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const scroller = get<HTMLDivElement>('canvas-scroll'), canvas = get<HTMLDivElement>('canvas');
  const slider = get<HTMLInputElement>('zoom'), readout = get<HTMLOutputElement>('zoom-value');
  let width = 1, height = 1, scale = 1, fit = true;
  const padding = () => { const s = getComputedStyle(scroller); return { x: parseFloat(s.paddingLeft), y: parseFloat(s.paddingTop) }; };
  function apply(next: number, reset = false, anchor?: { x: number; y: number }) {
    const p = padding();
    const a = anchor ?? { x: scroller.clientWidth / 2, y: scroller.clientHeight / 2 };
    const point = { x: (scroller.scrollLeft + a.x - p.x) / scale, y: (scroller.scrollTop + a.y - p.y) / scale };
    scale = Math.max(0.01, Math.min(4, next));
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;
    scroller.scrollLeft = reset ? 0 : point.x * scale + p.x - a.x;
    scroller.scrollTop = reset ? 0 : point.y * scale + p.y - a.y;
    slider.value = String(scale * 100);
    readout.value = `${Math.round(scale * 100)}%${fit ? ' · Fit' : ''}`;
    get('fit').setAttribute('aria-pressed', String(fit));
    get('actual-size').setAttribute('aria-pressed', String(!fit && Math.abs(scale - 1) < 0.001));
  }
  function fitSize() {
    const p = padding();
    // Reserve scrollbar rounding space; Fit considers both dimensions and never upscales.
    return Math.min(1, Math.max(1, scroller.clientWidth - p.x * 2 - 2) / width, Math.max(1, scroller.clientHeight - p.y * 2 - 2) / height);
  }
  function manual(next: number, anchor?: { x: number; y: number }) { fit = false; apply(next, false, anchor); }
  get('fit').addEventListener('click', () => { fit = true; apply(fitSize(), true); });
  get('actual-size').addEventListener('click', () => manual(1));
  get('zoom-in').addEventListener('click', () => manual(scale * 1.25));
  get('zoom-out').addEventListener('click', () => manual(scale / 1.25));
  slider.addEventListener('input', () => manual(Number(slider.value) / 100));
  scroller.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return; // ordinary wheel/trackpad scrolling remains native
    e.preventDefault();
    const r = scroller.getBoundingClientRect();
    manual(scale * Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.01), { x: e.clientX - r.left, y: e.clientY - r.top });
  }, { passive: false });
  let drag: { id: number; x: number; y: number; left: number; top: number } | undefined;
  scroller.addEventListener('pointerdown', e => {
    // Touch uses native two-axis scrolling; no custom touch gesture recognizer.
    if (e.pointerType !== 'mouse' || (e.button !== 0 && e.button !== 1)) return;
    const r = scroller.getBoundingClientRect();
    if (e.clientX - r.left >= scroller.clientWidth || e.clientY - r.top >= scroller.clientHeight) return;
    e.preventDefault(); scroller.focus({ preventScroll: true });
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
    scroller.setPointerCapture(e.pointerId); scroller.classList.add('panning');
  });
  scroller.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    scroller.scrollLeft = drag.left - (e.clientX - drag.x);
    scroller.scrollTop = drag.top - (e.clientY - drag.y);
  });
  function release(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = undefined; scroller.classList.remove('panning');
    if (scroller.hasPointerCapture(e.pointerId)) scroller.releasePointerCapture(e.pointerId);
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) scroller.addEventListener(event, release);
  new ResizeObserver(() => { if (fit) apply(fitSize(), true); }).observe(scroller);
  get('toggle-sidebar').addEventListener('click', () => {
    const hidden = document.querySelector('.workspace')!.classList.toggle('sidebar-hidden');
    get('toggle-sidebar').setAttribute('aria-expanded', String(!hidden));
  });
  return {
    setSize(w: number, h: number) { width = w; height = h; apply(fit ? fitSize() : scale, fit); },
  };
}
