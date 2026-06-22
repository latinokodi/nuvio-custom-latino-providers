const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const DEFAULT_HEADERS = {
  "User-Agent": UA,
  "Accept": "*/*",
};

const HTML_HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

async function fetchText(url, headers = HTML_HEADERS) {
  try {
    const resp = await fetch(url, { headers });
    if (!resp.ok) return null;
    return await resp.text();
  } catch (e) {
    console.error(`[Anime Resolver] Fetch failed for ${url}:`, e.message);
    return null;
  }
}

function normalizeExtractedUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  return value
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/%3A/gi, ":")
    .replace(/%2F/gi, "/")
    .replace(/%3F/gi, "?")
    .replace(/%3D/gi, "=")
    .trim();
}

function findFirstUrl(payload, patterns) {
  if (!payload || typeof payload !== "string") {
    return null;
  }
  for (const pattern of patterns) {
    try {
      const match = payload.match(pattern);
      if (match && match[1]) {
        const candidate = normalizeExtractedUrl(match[1]);
        if (candidate) return candidate;
      }
    } catch (_e) {}
  }
  return null;
}

function isLikelyVideoUrl(url) {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();
  const excludePatterns = [
    "cloudflareinsights", "google-analytics", "googletagmanager",
    "facebook.net", "beacon.min.js", ".js?", "analytics", "pixel",
    "bigbuckbunny", "test-videos", "sample-video", "placeholder",
  ];
  for (const pattern of excludePatterns) {
    if (lower.includes(pattern)) return false;
  }
  return /\.(mp4|m3u8)$/i.test(url) || lower.includes("video") || lower.includes("stream") || lower.includes(".mp4") || lower.includes(".m3u8");
}

async function resolveYourUpload(url) {
  const html = await fetchText(url);
  if (!html) return null;
  const metaMatch = /property\s*=\s*"og:video"/g.exec(html);
  if (metaMatch) {
    const vidMatch = /content\s*=\s*"(\S+)"/g.exec(html.substring(metaMatch.index));
    if (vidMatch && vidMatch[1]) {
      return vidMatch[1];
    }
  }
  return null;
}

async function resolveMP4Upload(url) {
  const html = await fetchText(url);
  if (!html) return null;
  const metaMatch = /<script(?:.|\n)+?src:(?:.|\n)*?"(.+?\.mp4)"/g.exec(html);
  if (metaMatch && metaMatch[1]) {
    return metaMatch[1];
  }
  return null;
}

async function resolveVoe(url) {
  let html = await fetchText(url);
  if (!html) return null;
  const redirectMatch = html.match(/window\.location\.href\s*=\s*['"](https?:\/\/[^'"]+)['"]/i);
  if (redirectMatch && redirectMatch[1]) {
    html = await fetchText(redirectMatch[1]);
    if (!html) return null;
  }
  const link = findFirstUrl(html, [
    /sources?\s*:\s*\[\s*\{[^}]*src\s*:\s*["']([^"']+)["']/i,
    /"file"\s*:\s*"([^"]+)"/i,
    /(https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8)[^\s"'<>]*)/i,
  ]);
  return isLikelyVideoUrl(link) ? link : null;
}

async function resolveVidhide(url) {
  const html = await fetchText(url);
  if (!html) return null;
  const link = findFirstUrl(html, [
    /sources?\s*:\s*\[\s*\{[^}]*(?:file|src)\s*:\s*["'](https?:\/\/[^"']+)["']/i,
    /"file"\s*:\s*"([^"]+)"/i,
    /"source"\s*:\s*"([^"]+)"/i,
    /file\s*:\s*'([^']+)'/i,
    /setup\([^)]*file[^)]*\)/i,
  ]);
  return isLikelyVideoUrl(link) ? link : null;
}

async function resolveOkru(url) {
  const html = await fetchText(url);
  if (!html) return null;
  const link = findFirstUrl(html, [
    /"metadata"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/i,
    /flashvars\s*=\s*\{[^}]*src\s*:\s*"([^"]+)"/i,
    /videoUrl\s*=\s*"([^"]+)"/i,
  ]);
  return isLikelyVideoUrl(link) ? link : null;
}

async function resolveFilemoon(url) {
  const html = await fetchText(url);
  if (!html) return null;
  const link = findFirstUrl(html, [
    /sources?\s*:\s*\[\s*\{[^}]*src\s*:\s*["']([^"']+)["']/i,
    /file\s*:\s*"([^"\)]+)"/i,
  ]);
  return isLikelyVideoUrl(link) ? link : null;
}

async function resolveStreamwish(url) {
  const html = await fetchText(url);
  if (!html) return null;
  const m3u8Match = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
  if (m3u8Match && m3u8Match[1]) {
    const candidate = m3u8Match[1];
    if (!candidate.startsWith("blob:")) {
      return candidate;
    }
  }
  const link = findFirstUrl(html, [
    /(https?:[^\s"']+\.m3u8[^\s"']*)/i,
    /file\s*:\s*["'](https?:[^\s"']+)["']/i,
    /sources\s*:\s*\[\s*\{[^}]*file\s*:\s*["'](https?:[^\s"']+)["']/i,
    /"file"\s*:\s*"([^"]+)"/i,
    /sources\s*:\s*\[([^\]]+)\]/i,
    /player\.config\s*=\s*\{[^}]*file\s*:\s*["']([^"']+)["']/i,
    /player\.setup\(\{[^}]*file\s*:\s*["']([^"']+)["']/i,
    /player\.setup\([\s\S]*?sources\s*:\s*\[[\s\S]*?src\s*:\s*["']([^"']+)["']/i,
  ]);
  if (link && !link.startsWith("blob:") && isLikelyVideoUrl(link)) return link;

  const dataMatch = html.match(/data-src=["']([^"']+\.m3u8[^"']*)["']/i);
  if (dataMatch && dataMatch[1] && !dataMatch[1].startsWith("blob:")) return normalizeExtractedUrl(dataMatch[1]);

  const scriptMatch = html.match(/<script[^>]*>([\s\S]*?var\s+sources\s*=\s*\[[\s\S]*?\];[\s\S]*?)<\/script>/i);
  if (scriptMatch) {
    const sourcesLines = scriptMatch[1];
    const urlInScript = sourcesLines.match(/src\s*:\s*["'](https?:\/\/[^'']+)["']/i);
    if (urlInScript && urlInScript[1] && !urlInScript[1].startsWith("blob:")) return normalizeExtractedUrl(urlInScript[1]);
  }
  return null;
}

function resolvePDrain(url) {
  const metaMatch = /(.+?:\/\/.+?)\/.+?\/(.+?)(?:\?embed)?$/g.exec(url);
  if (metaMatch && metaMatch[1] && metaMatch[2]) {
    return `${metaMatch[1]}/api/file/${metaMatch[2]}`;
  }
  return null;
}

function resolveHLS(url) {
  if (url.includes("/play/") || url.includes("/m3u8/")) {
    return url.replace("/play/", "/m3u8/");
  }
  return null;
}

async function resolveUrl(serverName, embedUrl) {
  if (!embedUrl) return null;
  
  // Exclude Mega links
  if (embedUrl.includes("mega.nz") || embedUrl.includes("mega.co")) {
    return null;
  }

  const name = serverName.toLowerCase();
  let resolvedUrl = null;

  try {
    if (name.includes("yourupload")) {
      resolvedUrl = await resolveYourUpload(embedUrl);
    } else if (name.includes("mp4upload")) {
      resolvedUrl = await resolveMP4Upload(embedUrl);
    } else if (name.includes("voe")) {
      resolvedUrl = await resolveVoe(embedUrl);
    } else if (name.includes("vidhide")) {
      resolvedUrl = await resolveVidhide(embedUrl);
    } else if (name.includes("okru") || name.includes("ok.ru") || name.includes("odnoklassniki")) {
      resolvedUrl = await resolveOkru(embedUrl);
    } else if (name.includes("filemoon")) {
      resolvedUrl = await resolveFilemoon(embedUrl);
    } else if (name.includes("streamwish") || name === "sw") {
      resolvedUrl = await resolveStreamwish(embedUrl);
    } else if (name.includes("pdrain") || name.includes("pixeldrain")) {
      resolvedUrl = resolvePDrain(embedUrl);
    } else if (name.includes("hls")) {
      resolvedUrl = resolveHLS(embedUrl);
    }
  } catch (err) {
    console.error(`[Anime Resolver] Failed resolving ${serverName} URL: ${embedUrl}`, err.message);
  }

  if (resolvedUrl && (resolvedUrl.includes("mega.nz") || resolvedUrl.includes("mega.co"))) {
    return null; // Ensure the final resolved URL is also not Mega
  }

  return resolvedUrl;
}

module.exports = {
  resolveUrl,
  UA
};
