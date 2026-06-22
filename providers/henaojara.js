const cheerio = require("cheerio");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const HTML_HEADERS_RESOLVER = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

async function fetchText(url, headers = HTML_HEADERS_RESOLVER) {
    try {
        const resp = await fetch(url, { headers });
        if (!resp.ok) return null;
        return await resp.text();
    } catch (e) { return null; }
}

function normalizeExtractedUrl(value) {
    if (!value || typeof value !== "string") return null;
    return value.replace(/\\u0026/g, "&").replace(/\\\//g, "/").replace(/&amp;/g, "&")
        .replace(/%3A/gi, ":").replace(/%2F/gi, "/").replace(/%3F/gi, "?").replace(/%3D/gi, "=").trim();
}

function findFirstUrl(payload, patterns) {
    if (!payload || typeof payload !== "string") return null;
    for (const pattern of patterns) {
        try {
            const match = payload.match(pattern);
            if (match && match[1]) { const c = normalizeExtractedUrl(match[1]); if (c) return c; }
        } catch (_e) {}
    }
    return null;
}

function isLikelyVideoUrl(url) {
    if (!url || typeof url !== "string") return false;
    const lower = url.toLowerCase();
    for (const p of ["cloudflareinsights","google-analytics","googletagmanager","facebook.net","beacon.min.js",".js?","analytics","pixel","bigbuckbunny","test-videos","sample-video","placeholder"]) {
        if (lower.includes(p)) return false;
    }
    return /\.(mp4|m3u8)$/i.test(url) || lower.includes("video") || lower.includes("stream") || lower.includes(".mp4") || lower.includes(".m3u8");
}

async function resolveUrl(serverName, embedUrl) {
    if (!embedUrl) return null;
    if (embedUrl.includes("mega.nz") || embedUrl.includes("mega.co")) return null;
    const name = serverName.toLowerCase();
    let resolved = null;
    try {
        if (name.includes("yourupload")) {
            const html = await fetchText(embedUrl);
            if (html) { const m = /property\s*=\s*"og:video"/g.exec(html); if (m) { const v = /content\s*=\s*"(\S+)"/g.exec(html.substring(m.index)); if (v) resolved = v[1]; } }
        } else if (name.includes("mp4upload")) {
            const html = await fetchText(embedUrl);
            if (html) { const m = /<script(?:.|\n)+?src:(?:.|\n)*?"(.+?\.mp4)"/g.exec(html); if (m) resolved = m[1]; }
        } else if (name.includes("voe")) {
            let html = await fetchText(embedUrl);
            if (html) { const r = html.match(/window\.location\.href\s*=\s*['"](https?:\/\/[^'"]+)['"]]/i); if (r) html = await fetchText(r[1]); }
            if (html) resolved = findFirstUrl(html, [/sources?\s*:\s*\[\s*\{[^}]*src\s*:\s*["']([^"']+)["']/i, /"file"\s*:\s*"([^"]+)"/i, /(https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8)[^\s"'<>]*)/i]);
            if (!isLikelyVideoUrl(resolved)) resolved = null;
        } else if (name.includes("vidhide")) {
            const html = await fetchText(embedUrl);
            if (html) resolved = findFirstUrl(html, [/sources?\s*:\s*\[\s*\{[^}]*(?:file|src)\s*:\s*["'](https?:\/\/[^"']+)["']/i, /"file"\s*:\s*"([^"]+)"/i, /"source"\s*:\s*"([^"]+)"/i, /file\s*:\s*'([^']+)'/i]);
            if (!isLikelyVideoUrl(resolved)) resolved = null;
        } else if (name.includes("okru") || name.includes("ok.ru") || name.includes("odnoklassniki")) {
            const html = await fetchText(embedUrl);
            if (html) resolved = findFirstUrl(html, [/"metadata"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/i, /flashvars\s*=\s*\{[^}]*src\s*:\s*"([^"]+)"/i, /videoUrl\s*=\s*"([^"]+)"/i]);
            if (!isLikelyVideoUrl(resolved)) resolved = null;
        } else if (name.includes("filemoon")) {
            const html = await fetchText(embedUrl);
            if (html) resolved = findFirstUrl(html, [/sources?\s*:\s*\[\s*\{[^}]*src\s*:\s*["']([^"']+)["']/i, /file\s*:\s*"([^"\)]+)"/i]);
            if (!isLikelyVideoUrl(resolved)) resolved = null;
        } else if (name.includes("streamwish") || name === "sw") {
            const html = await fetchText(embedUrl);
            if (html) {
                const m = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
                if (m && !m[1].startsWith("blob:")) { resolved = m[1]; }
                else {
                    resolved = findFirstUrl(html, [/(https?:[^\s"']+\.m3u8[^\s"']*)/i, /file\s*:\s*["'](https?:[^\s"']+)["']/i, /"file"\s*:\s*"([^"]+)"/i]);
                    if (!resolved || resolved.startsWith("blob:") || !isLikelyVideoUrl(resolved)) resolved = null;
                }
            }
        } else if (name.includes("pdrain") || name.includes("pixeldrain")) {
            const mm = /(.+?:\/\/.+?)\/.+?\/(.+?)(?:\?embed)?$/.exec(embedUrl);
            if (mm) resolved = `${mm[1]}/api/file/${mm[2]}`;
        } else if (name.includes("hls")) {
            if (embedUrl.includes("/play/") || embedUrl.includes("/m3u8/")) resolved = embedUrl.replace("/play/", "/m3u8/");
        }
    } catch (err) {}
    if (resolved && (resolved.includes("mega.nz") || resolved.includes("mega.co"))) return null;
    return resolved;
}

const TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://ww1.henaojara.net";

const HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/"
};

function cleanTitle(title) {
    if (!title) return "";
    return title.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

async function getTmdbTitles(tmdbId, type) {
    let titleEsES = null;
    let titleEsMX = null;
    let titleOriginal = null;
    let titleEn = null;
    let year = null;
    
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=es-ES`).then(r => r.json());
        titleEsES = type === "movie" ? res.title : res.name;
        titleOriginal = type === "movie" ? res.original_title : res.original_name;
        const dateStr = type === "movie" ? res.release_date : res.first_air_date;
        if (dateStr) {
            year = dateStr.split("-")[0];
        }
    } catch (e) {
        console.error("[Henaojara] TMDB es-ES error:", e.message);
    }
    
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=es-MX`).then(r => r.json());
        titleEsMX = type === "movie" ? res.title : res.name;
    } catch (e) {
        console.error("[Henaojara] TMDB es-MX error:", e.message);
    }
    
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`).then(r => r.json());
        titleEn = type === "movie" ? res.title : res.name;
    } catch (e) {
        console.error("[Henaojara] TMDB en-US error:", e.message);
    }
    
    return { titleEsES, titleEsMX, titleOriginal, titleEn, year };
}

function generateQueries(info) {
    const queries = [];
    const addQuery = (q) => {
        if (!q) return;
        const cleanQ = q.replace(/[,;.:!\?]/g, "").replace(/\s+/g, " ").trim();
        queries.push(cleanQ);
        
        const stripped = cleanQ.replace(/^(the|los|las|el|la|lo|un|una|unos|unas)\s+/i, "");
        if (stripped !== cleanQ) {
            queries.push(stripped);
        }
    };
    
    if (info.titleEsMX) addQuery(info.titleEsMX);
    if (info.titleEsES && info.titleEsES !== info.titleEsMX) addQuery(info.titleEsES);
    if (info.titleEn) addQuery(info.titleEn);
    if (info.titleOriginal) addQuery(info.titleOriginal);
    
    return [...new Set(queries)];
}

async function searchOnSite(query) {
    try {
        const url = `${BASE_URL}/animes?buscar=${encodeURIComponent(query).replaceAll('%20', '+')}`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) return [];
        const html = await res.text();
        const $ = cheerio.load(html);
        const results = [];
        
        $("#m > section > div > article").each((i, el) => {
            const a = $(el).find("a");
            let href = a.attr("href") || "";
            if (href.startsWith("./")) {
                href = href.replace("./", "/");
            }
            if (!href.startsWith("/anime/")) return;
            const slug = href.replace("/anime/", "");
            const title = $(el).find("h3").text().trim() || $(el).find("figure > a > img").attr("alt") || "";
            const type = $(el).find("figure > a > b").text().trim();
            
            if (slug) {
                results.push({ slug, title, type });
            }
        });
        return results;
    } catch (e) {
        console.error(`[Henaojara] Search site error for "${query}":`, e.message);
        return [];
    }
}

const getServerTitle = (serverDomain) => {
    const cleanDom = serverDomain.replace("bysesukior", "Filemoon").replace("movearnpre", "Vidhide")
        .replace("luluvdo", "Lulustream").replace("dhcplay", "Streamwish").replace("listeamed", "Vidguard")
        .replace("rpmvip", "RPMshare").replace("yourupload", "YourUpload").replace("mp4upload", "MP4Upload")
        .replace("pdrain", "PDrain").replace("hls", "HLS")
        .replace(".com", "").replace(".net", "").replace(".org", "").replace(".top", "")
        .replace(".to", "").replace(".ac", "").replace(".sx", "").replace(".ps", "");
    return cleanDom.charAt(0).toUpperCase() + cleanDom.slice(1);
};

const hex2a = (hex) => {
    var str = '';
    for (var i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
};

async function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[Henaojara] Resolving TMDB ID: ${tmdbId}, Season: ${season}, Episode: ${episode}`);
    
    const info = await getTmdbTitles(tmdbId, mediaType);
    if (!info.titleEsES && !info.titleEsMX && !info.titleOriginal && !info.titleEn) {
        console.log("[Henaojara] Failed to fetch titles from TMDB.");
        return [];
    }

    const uniqueQueries = generateQueries(info);
    let matchedAnime = null;
    let bestScore = -1;

    for (const q of uniqueQueries) {
        console.log(`[Henaojara] Searching with query: "${q}"`);
        const results = await searchOnSite(q);
        
        for (const res of results) {
            let score = 0;
            const cleanedResult = cleanTitle(res.title);
            
            const matchTitles = [info.titleEsMX, info.titleEsES, info.titleOriginal, info.titleEn].filter(Boolean);
            for (const t of matchTitles) {
                const cleanedT = cleanTitle(t);
                if (cleanedResult === cleanedT) {
                    score = Math.max(score, 100);
                } else if (cleanedResult.includes(cleanedT) || cleanedT.includes(cleanedResult)) {
                    score = Math.max(score, 50);
                }
            }

            const normType = res.type.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const isPelicula = normType.includes("pelicula");
            const isEspecial = normType.includes("especial");
            const isMovieType = isPelicula || isEspecial;
            if (mediaType === "movie" && isPelicula) {
                score += 15; // strong bonus — real movies must outrank specials/OVAs
            } else if (mediaType === "movie" && isEspecial) {
                score += 5; // lower bonus so real movies outrank OVA specials
            } else if (mediaType === "movie" && !isMovieType) {
                score = Math.max(score - 20, 0); // penalise TV series when searching for a movie
            } else if (mediaType === "tv" && !isMovieType) {
                score += 10;
            }

            console.log(`  - Candidate: "${res.title}" (${res.type}) -> Score: ${score} -> ${res.slug}`);
            if (score > bestScore && score >= 40) {
                bestScore = score;
                matchedAnime = res;
            }
        }
        if (bestScore >= 100) break;
    }

    if (!matchedAnime) {
        console.log("[Henaojara] No matching anime found on site.");
        return [];
    }

    console.log(`[Henaojara] Matched Anime: "${matchedAnime.title}" (Score: ${bestScore}) -> ${matchedAnime.slug}`);

    const epNum = mediaType === "movie" ? 1 : episode;
    const urlsToTry = [
        `${BASE_URL}/ver/${matchedAnime.slug}-${epNum}`,
        `${BASE_URL}/ver/${matchedAnime.slug}`
    ];

    let episodeHtml = null;
    let successfulUrl = null;

    for (const url of urlsToTry) {
        try {
            const res = await fetch(url, { headers: HEADERS });
            if (res.ok) {
                episodeHtml = await res.text();
                successfulUrl = url;
                break;
            }
        } catch (e) {
            console.error(`[Henaojara] Error fetching ${url}:`, e.message);
        }
    }

    if (!episodeHtml) {
        console.log(`[Henaojara] Episode page not found.`);
        return [];
    }

    const $ = cheerio.load(episodeHtml);
    const serversDIV = $("div.dwn");
    const downloadObj = JSON.parse(serversDIV.attr("data-dwn") || "null");

    const encryptValue = $(".opt").attr("data-encrypt");
    let serverHtml = null;
    if (encryptValue) {
        try {
            const postRes = await fetch(`${BASE_URL}/hj`, {
                headers: {
                    "accept": "*/*",
                    "accept-language": "es-ES,es;q=0.9,en;q=0.8",
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "x-requested-with": "XMLHttpRequest",
                    "Referer": successfulUrl
                },
                body: `acc=opt&i=${encryptValue}`,
                method: "POST"
            });
            if (postRes.ok) {
                serverHtml = await postRes.text();
            }
        } catch (e) {
            console.error("[Henaojara] Failed fetching `/hj` servers:", e.message);
        }
    }

    const candidates = [];

    if (serverHtml) {
        const $2 = cheerio.load(serverHtml);
        $2("li").each((_, el) => {
            const hex = $2(el).attr("encrypt");
            if (hex) {
                try {
                    const dec = hex2a(hex);
                    const sURL = new URL(dec);
                    candidates.push({
                        server: getServerTitle(sURL.hostname),
                        url: dec
                    });
                } catch (e) {}
            }
        });
    }

    if (downloadObj) {
        for (const s of downloadObj) {
            try {
                const sURL = new URL(s);
                candidates.push({
                    server: getServerTitle(sURL.hostname),
                    url: s
                });
            } catch (e) {}
        }
    }

    const streams = [];
    for (const c of candidates) {
        const serverName = c.server;
        const embedUrl = c.url;
        if (!embedUrl) continue;

        // Skip Mega URLs
        if (embedUrl.includes("mega.nz") || embedUrl.includes("mega.co")) {
            continue;
        }

        console.log(`[Henaojara] Resolving server ${serverName}: ${embedUrl}`);
        const resolved = await resolveUrl(serverName, embedUrl);

        if (resolved) {
            streams.push({
                name: "Henaojara",
                title: `${serverName} \xB7 Direct`,
                url: resolved,
                quality: "720p",
                headers: {
                    "Referer": BASE_URL + "/",
                    "User-Agent": UA
                }
            });
        } else {
            streams.push({
                name: "Henaojara",
                title: `${serverName} (Embed)`,
                url: embedUrl,
                quality: "720p",
                headers: {
                    "Referer": BASE_URL + "/",
                    "User-Agent": UA
                }
            });
        }
    }

    console.log(`[Henaojara] Resolved ${streams.length} streams.`);
    return streams;
}

module.exports = { getStreams };
