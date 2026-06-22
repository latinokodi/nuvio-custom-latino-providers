const cheerio = require("cheerio");

const TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://retrotve.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Connection": "close"
};

// Packer Unpacker Helper for resolvers
function unpackPacker(e) {
    try {
        let n = e.match(/eval\(function\(p,a,c,k,e,[rd]\)\{.*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
        if (!n) return null;
        let [, t, u, r, l] = n;
        u = parseInt(u), r = parseInt(r), l = l.split("|");
        let a = (i, s) => {
            let o = "0123456789abcdefghijklmnopqrstuvwxyz", c = "";
            for (; i > 0; )
                c = o[i % s] + c, i = Math.floor(i / s);
            return c || "0";
        };
        return t = t.replace(/\b\w+\b/g, (i) => {
            let s = parseInt(i, 36);
            return s < l.length && l[s] ? l[s] : a(s, u);
        }), t;
    } catch (n) {
        return null;
    }
}

async function resolveOkRu(embedUrl) {
    try {
        let e = await fetch(embedUrl, {
            headers: { "User-Agent": UA, "Accept": "text/html", "Referer": "https://ok.ru/" },
            redirect: "follow"
        }).then((n) => n.text());

        if (e.includes("copyrightsRestricted") || e.includes("COPYRIGHTS_RESTRICTED") || e.includes("LIMITED_ACCESS") || e.includes("notFound") || !e.includes("urls")) {
            return null;
        }

        let cleaned = e.replace(/\\&quot;/g, '"').replace(/\\u0026/g, "&").replace(/\\/g, "");
        let r = [...cleaned.matchAll(/"name":"([^"]+)","url":"([^"]+)"/g)];
        let s = ["full", "hd", "sd", "low", "lowest"];
        let i = r.map((n) => ({ type: n[1], url: n[2] })).filter((n) => !n.type.toLowerCase().includes("mobile") && n.url.startsWith("http"));

        if (i.length === 0) return null;

        let l = i.sort((n, u) => {
            let f = s.findIndex((p) => n.type.toLowerCase().includes(p)), d = s.findIndex((p) => u.type.toLowerCase().includes(p));
            return (f === -1 ? 99 : f) - (d === -1 ? 99 : d);
        })[0];

        let c = { full: "1080p", hd: "720p", sd: "480p", low: "360p", lowest: "240p" };
        return {
            url: l.url,
            server: "OkRu",
            quality: c[l.type] || l.type,
            headers: { "User-Agent": UA, Referer: "https://ok.ru/" }
        };
    } catch (err) {
        return null;
    }
}

async function resolveFilemoon(embedUrl) {
    try {
        let res = await fetch(embedUrl, { headers: { "User-Agent": UA, Referer: BASE_URL } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let text = await res.text();
        let evalMatch = text.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
        if (evalMatch) {
            let unpacked = unpackPacker(evalMatch[0]);
            if (unpacked) {
                let m3 = unpacked.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
                if (m3) return { url: m3[0], server: "FileMoon", quality: "1080p", headers: { "User-Agent": UA, Referer: embedUrl } };
            }
        }
        let m3 = text.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
        if (m3) {
            return { url: m3[0], server: "FileMoon", quality: "720p", headers: { "User-Agent": UA, Referer: embedUrl } };
        }
    } catch (err) {
        // ignore
    }
    return null;
}

async function resolveEmbed(url) {
    const u = url.toLowerCase();
    if (u.includes("ok.ru") || u.includes("odnoklassniki")) {
        return resolveOkRu(url);
    }
    if (u.includes("filemoon") || u.includes("fmoon")) {
        return resolveFilemoon(url);
    }
    return null;
}

function cleanTitle(title) {
    if (!title) return "";
    return title.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
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
        console.error("[Colección 2] TMDB es-ES error:", e.message);
    }
    
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=es-MX`).then(r => r.json());
        titleEsMX = type === "movie" ? res.title : res.name;
    } catch (e) {
        console.error("[Colección 2] TMDB es-MX error:", e.message);
    }
    
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`).then(r => r.json());
        titleEn = type === "movie" ? res.title : res.name;
    } catch (e) {
        console.error("[Colección 2] TMDB en-US error:", e.message);
    }
    
    return { titleEsES, titleEsMX, titleOriginal, titleEn, year };
}

function parseSearchPage($, baseUrl) {
    const list = [];
    $("article, .item").each((i, el) => {
        const linkTag = $(el).find("a").first();
        if (linkTag.length === 0) return;

        const href = linkTag.attr("href");
        if (!href) return;

        const titleTag = $(el).find("h2, h3").first();
        const title = titleTag.length > 0 ? titleTag.text().trim() : linkTag.text().trim();

        const imgTag = $(el).find("img").first();
        const poster = imgTag.length > 0 ? (imgTag.attr("src") || imgTag.attr("data-src") || "") : "";

        const is_series = href.includes("/serie/") || href.includes("/lista-de-series/");

        list.push({
            id: href,
            title: title,
            poster: poster,
            is_series: is_series
        });
    });
    return list.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
}

async function searchOnSite(query) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) return [];
        const html = await res.text();
        const $ = cheerio.load(html);
        return parseSearchPage($, BASE_URL);
    } catch (e) {
        console.error(`[Colección 2] Search site error for query "${query}":`, e.message);
        return [];
    }
}

function cleanQueryString(q) {
    return q.replace(/[,;.:!\?]/g, "").replace(/\s+/g, " ").trim();
}

async function extractVideoLinks(pageUrl) {
    const streams = [];
    try {
        const res = await fetch(pageUrl, { headers: HEADERS });
        if (!res.ok) return [];
        const html = await res.text();
        const $ = cheerio.load(html);

        const trembedUrls = new Set();
        const seenUrls = new Set();

        // 1. DooPlay option buttons
        $("li.dooplay_player_option").each((i, el) => {
            const trid = $(el).attr("data-post");
            const trembed = $(el).attr("data-nume");
            const trtype = $(el).attr("data-type") || "1";
            if (trid && trembed) {
                trembedUrls.add(`${BASE_URL}/?trembed=${trembed}&trid=${trid}&trtype=${trtype}`);
            }
        });

        // 2. Regex scan for hidden/escaped trembed links
        const regexPattern = /https?:\/\/[^\s\"\'<>]+/g;
        let match;
        while ((match = regexPattern.exec(html)) !== null) {
            const matchedUrl = match[0].replace(/&amp;/g, '&').replace(/&#038;/g, '&');
            if (matchedUrl.includes("trembed=") && matchedUrl.includes("trid=")) {
                trembedUrls.add(matchedUrl);
            }
        }

        // 3. Resolve trembed URLs
        for (const embedUrl of trembedUrls) {
            try {
                const embedRes = await fetch(embedUrl, { headers: HEADERS });
                if (!embedRes.ok) continue;
                const embedHtml = await embedRes.text();
                const $embed = cheerio.load(embedHtml);
                const iframe = $embed("iframe[src]").first();
                if (iframe.length > 0) {
                    let src = iframe.attr("src") || "";
                    if (src.startsWith("//")) src = "https:" + src;
                    if (src && !seenUrls.has(src)) {
                        seenUrls.add(src);
                        const resolved = await resolveEmbed(src);
                        if (resolved) {
                            streams.push({
                                name: "Colección 2",
                                title: `${resolved.quality} \xB7 ${resolved.server} \xB7 Direct`,
                                url: resolved.url,
                                quality: resolved.quality,
                                headers: resolved.headers
                            });
                        } else if (!src.includes("mega.nz") && !src.includes("mega.co")) {
                            let server = "Mirror";
                            try { server = new URL(src).hostname.split(".")[0]; } catch(e){}
                            server = server.charAt(0).toUpperCase() + server.slice(1);
                            streams.push({
                                name: "Colección 2",
                                title: `${server} (Embed)`,
                                url: src,
                                quality: "720p",
                                headers: { Referer: pageUrl }
                            });
                        }
                    }
                }
            } catch (err) {
                console.log(`[Colección 2] Embed resolution error for ${embedUrl}: ${err.message}`);
            }
        }

        // 4. Fallback direct iframes
        $("iframe[src]").each((i, el) => {
            let src = $(el).attr("src") || "";
            if (src.startsWith("//")) src = "https:" + src;
            if (src && !seenUrls.has(src)) {
                if (src.includes("yourupload") || src.includes("sendvid")) {
                    seenUrls.add(src);
                    let server = "Mirror";
                    try { server = new URL(src).hostname.split(".")[0]; } catch(e){}
                    server = server.charAt(0).toUpperCase() + server.slice(1);
                    streams.push({
                        name: "Colección 2",
                        title: `${server} (Embed)`,
                        url: src,
                        quality: "720p",
                        headers: { Referer: pageUrl }
                    });
                }
            }
        });

    } catch (e) {
        console.error(`[Colección 2] Link extraction error:`, e.message);
    }
    return streams;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[Colección 2] Resolving: TMDB ${tmdbId} (${mediaType})${mediaType === 'tv' ? ` S${season}E${episode}` : ''}`);
    
    // Step 1: Query TMDB for titles
    const info = await getTmdbTitles(tmdbId, mediaType);
    if (!info.titleEsES && !info.titleEsMX && !info.titleOriginal && !info.titleEn) {
        console.log("[Colección 2] Failed to fetch titles from TMDB.");
        return [];
    }

    // Generate queries
    const queries = [];
    if (info.titleEsMX) queries.push(cleanQueryString(info.titleEsMX));
    if (info.titleEsES && info.titleEsES !== info.titleEsMX) queries.push(cleanQueryString(info.titleEsES));
    if (info.titleEn) queries.push(cleanQueryString(info.titleEn));
    if (info.titleOriginal && info.titleOriginal !== info.titleEsES && info.titleOriginal !== info.titleEn) {
        queries.push(cleanQueryString(info.titleOriginal));
    }
    const uniqueQueries = [...new Set(queries)];

    let matchedContent = null;
    let bestScore = -1;

    for (const q of uniqueQueries) {
        console.log(`[Colección 2] Searching query: "${q}"`);
        const results = await searchOnSite(q);
        console.log(`[Colección 2] Found ${results.length} matches`);

        for (const res of results) {
            let score = 0;
            const cleanedResult = cleanTitle(res.title);

            const checkTitles = [info.titleEsMX, info.titleEsES, info.titleOriginal, info.titleEn];
            for (const t of checkTitles) {
                if (!t) continue;
                const cleanedT = cleanTitle(t);
                if (cleanedResult === cleanedT) {
                    score = Math.max(score, 100);
                } else if (cleanedResult.includes(cleanedT) || cleanedT.includes(cleanedResult)) {
                    score = Math.max(score, 50);
                }
            }

            if (score > bestScore && score >= 40) {
                bestScore = score;
                matchedContent = res;
            }
        }
        if (bestScore === 100) break;
    }

    if (!matchedContent) {
        console.log("[Colección 2] No matching content found on site.");
        return [];
    }

    console.log(`[Colección 2] Best Match: "${matchedContent.title}" (Score: ${bestScore}) -> ${matchedContent.id}`);

    // Step 2: Extract streams
    if (mediaType === "movie") {
        return extractVideoLinks(matchedContent.id);
    } else {
        let seriesHtml = "";
        try {
            seriesHtml = await fetch(matchedContent.id, { headers: HEADERS }).then(r => r.text());
        } catch (e) {
            console.error("[Colección 2] Failed to load series page:", e.message);
            return [];
        }

        const $ = cheerio.load(seriesHtml);
        
        let targetContainer = null;
        $(".AA-Season").each((i, el) => {
            const text = $(el).text().trim();
            const match = text.match(/Temporada\s+(\d+)/i);
            if (match && parseInt(match[1], 10) === season) {
                targetContainer = $(el).next(".TPTblCn");
                return false;
            }
        });

        if (!targetContainer || targetContainer.length === 0) {
            console.log(`[Colección 2] Season ${season} not found.`);
            return [];
        }

        const uniqueEpUrls = [];
        const seenUrls = new Set();

        targetContainer.find("a[href*='/seriestv/']").each((i, el) => {
            const href = $(el).attr("href");
            if (href && !seenUrls.has(href)) {
                seenUrls.add(href);
                uniqueEpUrls.push(href);
            }
        });

        console.log(`[Colección 2] Found ${uniqueEpUrls.length} episodes in Season ${season}`);

        if (episode > uniqueEpUrls.length || episode < 1) {
            console.log(`[Colección 2] Episode ${episode} is out of bounds.`);
            return [];
        }

        const episodeUrl = uniqueEpUrls[episode - 1];
        console.log(`[Colección 2] Matched Episode URL: ${episodeUrl}`);

        return extractVideoLinks(episodeUrl);
    }
}

module.exports = { getStreams };
