import type { CalibrationStatus } from './calibration';

/**
 * "Stand in the box" guide: a silhouette box that turns green when the full body is in
 * frame, plus a progress bar while capturing. Plain canvas so it can sit over the test
 * video or over Phaser. `getStatus` returns null to hide it.
 */
export function createCalibrationGuide(
  host: HTMLElement,
  getStatus: () => CalibrationStatus | null,
  getPrompt: () => string | null = () => null,
  width = 640,
  height = 480,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  let raf = 0;

  const draw = () => {
    raf = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, width, height);
    const st = getStatus();
    if (!st || st.phase === 'idle' || st.phase === 'done') return;

    const color = st.bodyInFrame ? '#00e676' : '#ff5252';
    const bw = width * 0.45;
    const bh = height * 0.92;
    const x = (width - bw) / 2;
    const y = (height - bh) / 2;

    ctx.lineWidth = 4;
    ctx.strokeStyle = color;
    ctx.setLineDash([14, 10]);
    ctx.strokeRect(x, y, bw, bh);
    ctx.setLineDash([]);

    // simple head + body silhouette hint
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(width / 2, y + bh * 0.12, bh * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(width / 2 - bw * 0.3, y + bh * 0.2, bw * 0.6, bh * 0.45);
    ctx.globalAlpha = 1;

    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    const msg = st.phase === 'capturing' ? 'Hold still...' : getPrompt() ?? 'Stand in the box';
    ctx.strokeText(msg, width / 2, height - 36);
    ctx.fillText(msg, width / 2, height - 36);

    if (st.phase === 'capturing') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, height - 24, bw, 10);
      ctx.fillStyle = color;
      ctx.fillRect(x, height - 24, bw * st.progress, 10);
    }
  };
  raf = requestAnimationFrame(draw);

  return { destroy() { cancelAnimationFrame(raf); canvas.remove(); } };
}
