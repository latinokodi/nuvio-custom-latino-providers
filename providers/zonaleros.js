const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://zona-leros.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-MX,es;q=0.9",
    "Connection": "keep-alive"
};

/**
 * TMDB lookup
 */
async function getTMDBInfo(id, type) {
    try {
        const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=es-MX`;
        const res = await fetch(url, { headers: HEADERS }).then(r => r.json());
        return {
            title: type === "movie" ? res.title : res.name,
            year: (res.release_date || res.first_air_date || "").substring(0, 4)
        };
    } catch (e) {
        console.log(`[ZonaLeros] TMDB Error: ${e.message}`);
        return null;
    }
}

/**
 * Search on ZonaLeros
 */
async function searchZona(query) {
    try {
        const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const matches = [];
        const regex = /<article.*?href="([^"]+)".*?alt="([^"]+)"/gs;
        let match;
        while ((match = regex.exec(html)) !== null) {
            matches.push({
                url: match[1],
                title: match[2].replace(/Ver|Descargar/gi, "").trim()
            });
        }
        return matches;
    } catch (e) {
        console.log(`[ZonaLeros] Search Error: ${e.message}`);
        return [];
    }
}

/**
 * Extract streams from a page
 */
async function extractStreams(url, isMovie) {
    try {
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const streams = [];

        if (isMovie) {
            // ZonaLeros uses an API for qualities in movies
            const tokenMatch = html.match(/name="csrf-token" content="([^"]+)"/);
            if (tokenMatch) {
                const token = tokenMatch[1];
                const qualityMatches = [...html.matchAll(/data-target="#calidad-(\d+)"/g)];
                for (const qMatch of qualityMatches) {
                    const qualityId = qMatch[1];
                    const qualityName = html.match(new RegExp(`data-target="#calidad-${qualityId}">.*?<span>(.*?)<\/span>`, 's'))?.[1] || "HD";
                    
                    const apiRes = await fetch(`${BASE_URL}/api/calidades`, {
                        method: "POST",
                        headers: { ...HEADERS, "X-CSRF-TOKEN": token, "Content-Type": "application/x-www-form-urlencoded" },
                        body: `calidad_id=${qualityId}&_token=${token}`
                    }).then(r => r.text());

                    const optionMatches = [...apiRes.matchAll(/data-id="(\d+)".*?title="([^"]+)"/g)];
                    for (const opt of optionMatches) {
                        const id = opt[1];
                        const server = opt[2];
                        const iframeMatch = apiRes.match(new RegExp(`video\\[${id}\\]\\[\\]" src="([^"]+)"`));
                        if (iframeMatch) {
                            streams.push({
                                name: "ZonaLeros",
                                title: `${server} (${qualityName})`,
                                url: iframeMatch[1],
                                quality: qualityName,
                                headers: { Referer: url }
                            });
                        }
                    }
                }
            }
        } else {
            // Series: extract from the specific episode page
            const serverMatches = [...html.matchAll(/data-id="(\d+)".*?title="([^"]+)"/g)];
            for (const match of serverMatches) {
                const id = match[1];
                const server = match[2];
                const iframeMatch = html.match(new RegExp(`video\\[${id}\\]\\[\\]" src="([^"]+)"`));
                if (iframeMatch) {
                    streams.push({
                        name: "ZonaLeros",
                        title: server,
                        url: iframeMatch[1],
                        quality: "HD",
                        headers: { Referer: url }
                    });
                }
            }
        }

        return streams;
    } catch (e) {
        console.log(`[ZonaLeros] Extract Error: ${e.message}`);
        return [];
    }
}

/**
 * Main export for Luvio
 */
async function getStreams(id, type, season, episode) {
    console.log(`[ZonaLeros] Resolving: ${type} ${id}`);
    const info = await getTMDBInfo(id, type);
    if (!info) return [];

    const results = await searchZona(info.title);
    if (results.length === 0) return [];

    // Filter results (simple heuristic)
    const target = results[0];
    let url = target.url;

    if (type === "tv") {
        // Series need to find the specific episode link
        const seriesHtml = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const epRegex = new RegExp(`<a href="([^"]+)".*?alt="[^"]+".*?class="Capi">${season}x${episode}<\/span>`, 'i');
        const epMatch = seriesHtml.match(epRegex);
        if (!epMatch) return [];
        url = epMatch[1];
    }

    return await extractStreams(url, type === "movie");
}

module.exports = { getStreams };
