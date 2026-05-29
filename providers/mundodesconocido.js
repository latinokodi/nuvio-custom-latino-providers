const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://www.mundodesconocido.es";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-MX,es;q=0.9",
    "Connection": "keep-alive"
};

async function getTMDBInfo(id, type) {
    try {
        const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=es-MX`;
        const res = await fetch(url, { headers: HEADERS }).then(r => r.json());
        return {
            title: type === "movie" ? res.title : res.name,
            year: (res.release_date || res.first_air_date || "").substring(0, 4)
        };
    } catch (e) {
        console.log(`[MundoDesconocido] TMDB Error: ${e.message}`);
        return null;
    }
}

async function searchMundo(query) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const cleanHtml = html.replace(/\n|\r|\t|\s{2}/g, '');
        const matches = [];
        
        // Match the custom wordpress theme structure
        const regex = /by: <a href=.*?data-a2a-url="([^"]+)".*?data-a2a-title="([^"]+)"/gs;
        let match;
        while ((match = regex.exec(cleanHtml)) !== null) {
            matches.push({
                url: match[1],
                title: match[2].trim()
            });
        }
        return matches;
    } catch (e) {
        console.log(`[MundoDesconocido] Search Error: ${e.message}`);
        return [];
    }
}

async function extractStreams(url) {
    try {
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const streams = [];
        
        // Find custom lazy-loaded video attribute
        const videoMatch = html.match(/data-src-cmplz="([^"]+)"/);
        if (videoMatch) {
            let embedUrl = videoMatch[1];
            const embedIdMatch = embedUrl.match(/\/embed\/([^?"]+)/);
            if (embedIdMatch) {
                const videoId = embedIdMatch[1];
                streams.push({
                    name: "MundoDesconocido",
                    title: "YouTube (Esp)",
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    quality: "1080p",
                    headers: { Referer: url }
                });
            }
        }
        
        // Direct youtube iframe fallback
        if (streams.length === 0) {
            const ytRegex = /<iframe[^>]*?src="([^"]+youtube\.com\/embed\/([^?"]+))"/g;
            let ytMatch;
            while ((ytMatch = ytRegex.exec(html)) !== null) {
                streams.push({
                    name: "MundoDesconocido",
                    title: "YouTube (Esp)",
                    url: `https://www.youtube.com/watch?v=${ytMatch[2]}`,
                    quality: "1080p",
                    headers: { Referer: url }
                });
            }
        }
        
        return streams;
    } catch (e) {
        console.log(`[MundoDesconocido] Extract Error: ${e.message}`);
        return [];
    }
}

async function getStreams(id, type, season, episode) {
    console.log(`[MundoDesconocido] Resolving: ${type} ${id}`);
    const info = await getTMDBInfo(id, type);
    if (!info) return [];

    const results = await searchMundo(info.title);
    if (results.length === 0) return [];

    // Select first result as target
    const target = results[0];
    return await extractStreams(target.url);
}

module.exports = { getStreams };
