/** Öffnet ein als Data-URL gespeichertes Bild oder Dokument in einem neuen Tab. */
export function openDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]*)(;base64)?,(.*)$/s);
  if (!match) {
    window.open(dataUrl, '_blank', 'noopener');
    return;
  }

  const [, mimeType, isBase64, payload] = match;
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType || 'application/octet-stream' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
