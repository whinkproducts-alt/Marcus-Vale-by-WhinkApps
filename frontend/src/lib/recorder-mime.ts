/** Picks a recording type this browser supports (Safari records audio/mp4). Copied from ECHELON-INTEGRATIONS apps/web/lib/voice-audio.ts. */
export function recorderMime(): string | undefined {
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
}
