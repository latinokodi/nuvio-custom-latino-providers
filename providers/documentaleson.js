const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://documentaleson.com";
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
        console.log(`[DocumentalesOn] TMDB Error: ${e.message}`);
        return null;
    }
}

async function searchDocOn(query) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const matches = [];
        const regex = /<article[^>]*>.*?<a href="([^"]+)".*?(?:title="([^"]+)"|rel="bookmark">([^<]+)<\/a>)/gs;
        let match;
        while ((match = regex.exec(html)) !== null) {
            matches.push({
                url: match[1],
                title: (match[2] || match[3] || "").trim()
            });
        }
        return matches;
    } catch (e) {
        console.log(`[DocumentalesOn] Search Error: ${e.message}`);
        return [];
    }
}

async function extractStreams(url) {
    try {
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const iframeRegex = /<iframe[^>]*?data-src="([^"]+)"|<iframe[^>]*?src="([^"]+)"/g;
        const streams = [];
        let match;
        while ((match = iframeRegex.exec(html)) !== null) {
            let embedUrl = match[1] || match[2];
            if (!embedUrl || embedUrl.includes("amazon-adsystem")) continue;
            
            if (embedUrl.startsWith("//")) {
                embedUrl = "https:" + embedUrl;
            }
            
            let serverName = "Direct";
            if (embedUrl.includes("youtube.com") || embedUrl.includes("youtu.be")) serverName = "YouTube";
            else if (embedUrl.includes("ok.ru")) serverName = "OkRu";
            else if (embedUrl.includes("streamwish")) serverName = "StreamWish";
            else if (embedUrl.includes("voe.sx")) serverName = "VOE";
            
            streams.push({
                name: "DocumentalesOn",
                title: `${serverName} (Esp)`,
                url: embedUrl,
                quality: "720p",
                headers: { Referer: url }
            });
        }
        return streams;
    } catch (e) {
        console.log(`[DocumentalesOn] Extract Error: ${e.message}`);
        return [];
    }
}

async function getStreams(id, type, season, episode) {
    console.log(`[DocumentalesOn] Resolving: ${type} ${id}`);
    const info = await getTMDBInfo(id, type);
    if (!info) return [];

    const results = await searchDocOn(info.title);
    if (results.length === 0) return [];

    // Select first result as target
    const target = results[0];
    return await extractStreams(target.url);
}

module.exports = { getStreams };
