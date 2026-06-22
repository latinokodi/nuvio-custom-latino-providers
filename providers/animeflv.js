const cheerio = require("cheerio");
const { resolveUrl, UA } = require("./anime_resolver");

const TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://www3.animeflv.net";

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
        console.error("[AnimeFLV] TMDB es-ES error:", e.message);
    }
    
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=es-MX`).then(r => r.json());
        titleEsMX = type === "movie" ? res.title : res.name;
    } catch (e) {
        console.error("[AnimeFLV] TMDB es-MX error:", e.message);
    }
    
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`).then(r => r.json());
        titleEn = type === "movie" ? res.title : res.name;
    } catch (e) {
        console.error("[AnimeFLV] TMDB en-US error:", e.message);
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
        const url = `${BASE_URL}/browse?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) return [];
        const html = await res.text();
        const $ = cheerio.load(html);
        const results = [];
        
        $("ul.ListAnimes li").each((i, el) => {
            const a = $(el).find("a");
            const href = a.attr("href") || "";
            const slug = href.replace("/anime/", "");
            const title = $(el).find("h3").text().trim();
            const type = $(el).find("span.Type").text().trim();
            
            if (slug) {
                results.push({ slug, title, type });
            }
        });
        return results;
    } catch (e) {
        console.error(`[AnimeFLV] Search site error for "${query}":`, e.message);
        return [];
    }
}

async function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[AnimeFLV] Resolving TMDB ID: ${tmdbId}, Season: ${season}, Episode: ${episode}`);
    
    const info = await getTmdbTitles(tmdbId, mediaType);
    if (!info.titleEsES && !info.titleEsMX && !info.titleOriginal && !info.titleEn) {
        console.log("[AnimeFLV] Failed to fetch titles from TMDB.");
        return [];
    }

    const uniqueQueries = generateQueries(info);
    let matchedAnime = null;
    let bestScore = -1;

    for (const q of uniqueQueries) {
        console.log(`[AnimeFLV] Searching with query: "${q}"`);
        const results = await searchOnSite(q);
        
        for (const res of results) {
            let score = 0;
            const cleanedResult = cleanTitle(res.title);
            
            // Score by TMDB title matches
            const matchTitles = [info.titleEsMX, info.titleEsES, info.titleOriginal, info.titleEn].filter(Boolean);
            for (const t of matchTitles) {
                const cleanedT = cleanTitle(t);
                if (cleanedResult === cleanedT) {
                    score = Math.max(score, 100);
                } else if (cleanedResult.includes(cleanedT) || cleanedT.includes(cleanedResult)) {
                    score = Math.max(score, 50);
                }
            }

            // Boost score based on type alignment
            const isMovieType = res.type.toLowerCase().includes("pelicula") || res.type.toLowerCase().includes("especial");
            if (mediaType === "movie" && isMovieType) {
                score += 10;
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
        console.log("[AnimeFLV] No matching anime found on site.");
        return [];
    }

    console.log(`[AnimeFLV] Matched Anime: "${matchedAnime.title}" (Score: ${bestScore}) -> ${matchedAnime.slug}`);

    // Verify episode availability first by reading anime detail page if needed,
    // but usually we can directly predict the ver URL: /ver/slug-episode.
    // For movies, episode number is 1, but ver URL is usually just `/ver/slug-1` or `/ver/slug`.
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
            console.error(`[AnimeFLV] Error fetching ${url}:`, e.message);
        }
    }

    if (!episodeHtml) {
        console.log(`[AnimeFLV] Episode ${epNum} page not found.`);
        return [];
    }

    const $ = cheerio.load(episodeHtml);
    const scripts = $("script");
    const serversFind = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("var videos ="));
    const serversObjMatch = serversFind?.match(/var videos = (\{.*\})/);
    if (!serversObjMatch) {
        console.log("[AnimeFLV] No videos script block found.");
        return [];
    }

    let serversObj;
    try {
        serversObj = JSON.parse(serversObjMatch[1]);
    } catch (err) {
        console.error("[AnimeFLV] Failed parsing videos JSON:", err.message);
        return [];
    }

    const streams = [];
    const list = [...(serversObj.SUB || []), ...(serversObj.DUB || [])];

    for (const s of list) {
        const serverName = s.title || s.server || "Mirror";
        const embedUrl = s.code || s.url;
        if (!embedUrl) continue;

        // Skip Mega URLs
        if (embedUrl.includes("mega.nz") || embedUrl.includes("mega.co")) {
            continue;
        }

        console.log(`[AnimeFLV] Resolving server ${serverName}: ${embedUrl}`);
        const resolved = await resolveUrl(serverName, embedUrl);

        if (resolved) {
            streams.push({
                name: "AnimeFLV",
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
                name: "AnimeFLV",
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

    console.log(`[AnimeFLV] Resolved ${streams.length} streams.`);
    return streams;
}

module.exports = { getStreams };
