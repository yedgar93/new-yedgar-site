export function textureUrl(url: string) {
  if (
    url.startsWith("https://f4.bcbits.com/") ||
    url.startsWith("https://i1.sndcdn.com/")
  ) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}
