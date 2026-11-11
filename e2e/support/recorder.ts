import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CDPSession, Locator, Page } from "@playwright/test";

/**
 * Records a crisp frame sequence of a page with the Chrome DevTools screencast (Playwright's own
 * video recorder is low-bitrate VP8, which blurs UI text), plus a visible fake cursor so viewers
 * can follow the pointer. `scripts/demo-gif.sh` turns the frames into docs/media/demo.gif.
 */
export class DemoRecorder {
  private readonly frames: { file: string; timestamp: number }[] = [];
  private cdp: CDPSession | undefined;
  private x = 0;
  private y = 0;

  constructor(
    private readonly page: Page,
    private readonly dir: string,
  ) {}

  async start() {
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    await this.page.addInitScript(installCursor);
    await this.page.evaluate(installCursor);
    const viewport = this.page.viewportSize();
    this.x = (viewport?.width ?? 0) / 2;
    this.y = (viewport?.height ?? 0) / 2;

    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on("Page.screencastFrame", (frame) => {
      const file = `frame-${String(this.frames.length).padStart(5, "0")}.png`;
      writeFileSync(join(this.dir, file), Buffer.from(frame.data, "base64"));
      this.frames.push({ file, timestamp: frame.metadata.timestamp ?? Date.now() / 1000 });
      void this.cdp?.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => undefined);
    });
    await this.cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
  }

  /** Stops recording and writes an ffmpeg concat list with each frame's real duration. */
  async stop(holdLastFrameSeconds = 2) {
    await this.cdp?.send("Page.stopScreencast");
    const lines = ["ffconcat version 1.0"];
    this.frames.forEach((frame, i) => {
      const next = this.frames[i + 1];
      const duration = next ? next.timestamp - frame.timestamp : holdLastFrameSeconds;
      lines.push(`file ${frame.file}`, `duration ${Math.max(duration, 0.01).toFixed(3)}`);
    });
    const last = this.frames.at(-1);
    if (last) lines.push(`file ${last.file}`); // the concat demuxer ignores the final duration otherwise
    writeFileSync(join(this.dir, "frames.ffconcat"), `${lines.join("\n")}\n`);
  }

  /** Moves the real and the fake cursor along a smooth path. */
  async moveTo(x: number, y: number, steps = 18) {
    const fromX = this.x;
    const fromY = this.y;
    for (let i = 1; i <= steps; i++) {
      const t = easeInOut(i / steps);
      const px = fromX + (x - fromX) * t;
      const py = fromY + (y - fromY) * t;
      await this.page.mouse.move(px, py);
      await this.cursor(px, py);
    }
    this.x = x;
    this.y = y;
  }

  async moveToLocator(target: Locator, position = { x: 0.5, y: 0.5 }, steps?: number) {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error("Target is not visible");
    await this.moveTo(box.x + box.width * position.x, box.y + box.height * position.y, steps);
  }

  async click(target: Locator, position?: { x: number; y: number }) {
    await this.moveToLocator(target, position);
    await this.cursor(this.x, this.y, true);
    await this.page.mouse.down();
    await this.page.mouse.up();
    await this.page.waitForTimeout(120);
    await this.cursor(this.x, this.y, false);
  }

  /** Drags with stepped pointer moves so dnd-kit's PointerSensor activates (see dnd.ts). */
  async drag(source: Locator, target: Locator, at = 0.5) {
    await this.moveToLocator(source);
    await this.cursor(this.x, this.y, true);
    await this.page.mouse.down();
    await this.moveTo(this.x + 12, this.y + 12, 6);
    const to = await target.boundingBox();
    if (!to) throw new Error("Drop target is not visible");
    await this.moveTo(to.x + to.width / 2, to.y + to.height * at, 40);
    await this.page.waitForTimeout(250);
    await this.page.mouse.up();
    await this.cursor(this.x, this.y, false);
  }

  /** Re-draws the cursor after a full page navigation. */
  async restoreCursor() {
    await this.cursor(this.x, this.y);
  }

  pause(ms: number) {
    return this.page.waitForTimeout(ms);
  }

  private async cursor(x: number, y: number, pressed?: boolean) {
    await this.page.evaluate(
      ([cx, cy, down]) => {
        (
          window as unknown as { __demoCursor?: (x: number, y: number, down?: boolean) => void }
        ).__demoCursor?.(cx, cy, down);
      },
      [x, y, pressed] as const,
    );
  }
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Runs in the page: an arrow cursor that ignores pointer events. */
function installCursor() {
  if (window !== window.top) return;
  const w = window as unknown as { __demoCursor?: (x: number, y: number, down?: boolean) => void };
  if (w.__demoCursor) return;
  const mount = () => {
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;left:0;top:0;width:24px;height:24px;z-index:2147483647;pointer-events:none;" +
      "transition:transform 80ms ease-out;will-change:left,top;";
    el.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">' +
      '<path d="M4 2.5v17.2l4.6-4.4 3 6.6 2.9-1.3-3-6.5h6.4z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(el);
    w.__demoCursor = (x, y, down) => {
      el.style.left = `${String(x - 4)}px`;
      el.style.top = `${String(y - 2)}px`;
      if (down !== undefined) el.style.transform = down ? "scale(0.85)" : "scale(1)";
    };
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
}
