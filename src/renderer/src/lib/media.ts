/** URL медиа-ассета для <img>/<video>/<audio>: обслуживается собственным протоколом main-процесса. */
export function mediaUrl(assetId: string): string {
  return `quizmedia://asset/${encodeURIComponent(assetId)}`;
}
