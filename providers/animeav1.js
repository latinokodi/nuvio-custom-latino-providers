const cheerio = require("cheerio");
const { resolveUrl, UA } = require("./anime_resolver");

const TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://animeav1.com";

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
        console.error("[AnimeAV1] TMDB es-ES error:", e.message);
    }
    
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=es-MX`).then(r => r.json());
        titleEsMX = type === "movie" ? res.title : res.name;
    } catch (e) {
        console.error("[AnimeAV1] TMDB es-MX error:", e.message);
    }
    
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`).then(r => r.json());
        titleEn = type === "movie" ? res.title : res.name;
    } catch (e) {
        console.error("[AnimeAV1] TMDB en-US error:", e.message);
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
        const url = `${BASE_URL}/catalogo?search=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) return [];
        const html = await res.text();
        const $ = cheerio.load(html);
        const results = [];
        
        $("main section div article").each((i, el) => {
            const a = $(el).find("a");
            const href = a.attr("href") || "";
            if (!href.startsWith("/media/")) return;
            const slug = href.replace("/media/", "");
            const title = $(el).find("header h3").text().trim();
            const type = $(el).find("div > figure + div > div").text().trim();
            
            if (slug) {
                results.push({ slug, title, type });
            }
        });
        return results;
    } catch (e) {
        console.error(`[AnimeAV1] Search site error for "${query}":`, e.message);
        return [];
    }
}

function parseAnimeAV1Servers(scriptContent) {
    const servers = [];
    const blockRegex = /\{[^{}]*?server\s*:\s*"([^"]+)"[^{}]*?url\s*:\s*"([^"]+)"[^{}]*?\}/g;
    
    const subEmbedBlock = scriptContent.match(/embeds:\s?\{[^{}]*?SUB:\s?(\[[^\]]+\])/)?.[1] || "";
    const dubEmbedBlock = scriptContent.match(/embeds:\s?\{[^{}]*?DUB:\s?(\[[^\]]+\])/)?.[1] || "";
    const subDownloadBlock = scriptContent.match(/downloads:\s?\{[^{}]*?SUB:\s?(\[[^\]]+\])/)?.[1] || "";
    const dubDownloadBlock = scriptContent.match(/downloads:\s?\{[^{}]*?DUB:\s?(\[[^\]]+\])/)?.[1] || "";

    const extract = (block, isDub) => {
        let m;
        blockRegex.lastIndex = 0;
        while ((m = blockRegex.exec(block)) !== null) {
            servers.push({
                title: m[1],
                url: m[2],
                dub: isDub
            });
        }
    };

    extract(subEmbedBlock, false);
    extract(subDownloadBlock, false);
    extract(dubEmbedBlock, true);
    extract(dubDownloadBlock, true);

    return servers;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[AnimeAV1] Resolving TMDB ID: ${tmdbId}, Season: ${season}, Episode: ${episode}`);
    
    const info = await getTmdbTitles(tmdbId, mediaType);
    if (!info.titleEsES && !info.titleEsMX && !info.titleOriginal && !info.titleEn) {
        console.log("[AnimeAV1] Failed to fetch titles from TMDB.");
        return [];
    }

    const uniqueQueries = generateQueries(info);
    let matchedAnime = null;
    let bestScore = -1;

    for (const q of uniqueQueries) {
        console.log(`[AnimeAV1] Searching with query: "${q}"`);
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
        console.log("[AnimeAV1] No matching anime found on site.");
        return [];
    }

    console.log(`[AnimeAV1] Matched Anime: "${matchedAnime.title}" (Score: ${bestScore}) -> ${matchedAnime.slug}`);

    const epNum = mediaType === "movie" ? null : episode;
    const url = epNum ? `${BASE_URL}/media/${matchedAnime.slug}/${epNum}` : `${BASE_URL}/media/${matchedAnime.slug}`;

    console.log(`[AnimeAV1] Fetching episode/media page: ${url}`);
    let episodeHtml = null;
    try {
        const res = await fetch(url, { headers: HEADERS });
        if (res.ok) {
            episodeHtml = await res.text();
        }
    } catch (e) {
        console.error(`[AnimeAV1] Error fetching ${url}:`, e.message);
    }

    if (!episodeHtml) {
        console.log(`[AnimeAV1] Media page not found.`);
        return [];
    }

    const $ = cheerio.load(episodeHtml);
    const scripts = $("script");
    const metadataJSON = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("kit.start(app, element, {"));
    
    if (!metadataJSON) {
        console.log("[AnimeAV1] No kit.start script block found on page.");
        return [];
    }

    const servers = parseAnimeAV1Servers(metadataJSON);
    console.log(`[AnimeAV1] Extracted ${servers.length} server elements from JavaScript.`);

    const streams = [];
    for (const s of servers) {
        const serverName = s.title || "Mirror";
        const embedUrl = s.url;
        if (!embedUrl) continue;

        // Skip Mega URLs
        if (embedUrl.includes("mega.nz") || embedUrl.includes("mega.co")) {
            continue;
        }

        console.log(`[AnimeAV1] Resolving server ${serverName}: ${embedUrl}`);
        const resolved = await resolveUrl(serverName, embedUrl);

        if (resolved) {
            streams.push({
                name: "AnimeAV1",
                title: `${serverName} \xB7 Direct${s.dub ? " \xB7 DUB" : ""}`,
                url: resolved,
                quality: "720p",
                headers: {
                    "Referer": BASE_URL + "/",
                    "User-Agent": UA
                }
            });
        } else {
            streams.push({
                name: "AnimeAV1",
                title: `${serverName} (Embed)${s.dub ? " \xB7 DUB" : ""}`,
                url: embedUrl,
                quality: "720p",
                headers: {
                    "Referer": BASE_URL + "/",
                    "User-Agent": UA
                }
            });
        }
    }

    console.log(`[AnimeAV1] Resolved ${streams.length} streams.`);
    return streams;
}

module.exports = { getStreams };
