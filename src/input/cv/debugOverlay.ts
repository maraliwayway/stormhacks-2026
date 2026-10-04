import { PoseLandmarker } from '@mediapipe/tasks-vision';
import { getLatest } from './poseTracker';

/**
 * Canvas overlay: skeleton + FPS + inference ms. Toggle with `D`.
 * Plain canvas, so it works over the test page's <video> or on top of Phaser.
 * Landmarks are drawn mirrored (x flipped) to match a mirrored video.
 */
export function createDebugOverlay(host: HTMLElement, width = 640, height = 480) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  let visible = true;
  let raf = 0;

  const draw = () => {
    raf = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, width, height);
    if (!visible) return;

    const s = getLatest();
    const lm = s.landmarks;

    if (lm) {
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 3;
      for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
        const a = lm[start];
        const b = lm[end];
        ctx.beginPath();
        ctx.moveTo((1 - a.x) * width, a.y * height);
        ctx.lineTo((1 - b.x) * width, b.y * height);
        ctx.stroke();
      }
      ctx.fillStyle = '#ff4081';
      for (const p of lm) {
        ctx.beginPath();
        ctx.arc((1 - p.x) * width, p.y * height, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.font = '16px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, 230, 48);
    ctx.fillStyle = s.fps >= 25 ? '#69f0ae' : '#ff5252';
    ctx.fillText(`FPS ${s.fps.toFixed(1)}`, 8, 20);
    ctx.fillStyle = '#fff';
    ctx.fillText(`inference ${s.inferenceMs.toFixed(1)} ms${lm ? '' : '  (no body)'}`, 8, 40);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'd' || e.key === 'D') visible = !visible;
  };
  window.addEventListener('keydown', onKey);
  raf = requestAnimationFrame(draw);

  return {
    setVisible(v: boolean) { visible = v; },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      canvas.remove();
    },
  };
}
