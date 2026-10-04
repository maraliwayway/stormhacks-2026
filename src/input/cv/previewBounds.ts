/** Match object-fit: contain so the video, landmarks, and steering zones line up. */
export function previewBounds(
  video: HTMLVideoElement | undefined,
  width: number,
  height: number,
) {
  const videoWidth = video?.videoWidth || width;
  const videoHeight = video?.videoHeight || height;
  const scale = Math.min(width / videoWidth, height / videoHeight);
  const frameWidth = videoWidth * scale;
  const frameHeight = videoHeight * scale;
  return {
    x: (width - frameWidth) / 2,
    y: (height - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight,
  };
}
