const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://www.documentales-online.com";
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
        console.log(`[DocumentalesOnline] TMDB Error: ${e.message}`);
        return null;
    }
}

async function searchDocOnline(query) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const matches = [];
        const regex = /<article[^>]*>.*?<a href="([^"]+)".*?rel="bookmark">([^<]+)<\/a>/gs;
        let match;
        while ((match = regex.exec(html)) !== null) {
            matches.push({
                url: match[1],
                title: match[2].replace(/&#8211;/g, '-').replace(/&#8230;/g, '').trim()
            });
        }
        return matches;
    } catch (e) {
        console.log(`[DocumentalesOnline] Search Error: ${e.message}`);
        return [];
    }
}

async function extractStreams(url) {
    try {
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const streams = [];
        
        // Find iframes
        const iframeRegex = /<iframe[^>]*?src="([^"]+)"/g;
        let match;
        const iframes = [];
        while ((match = iframeRegex.exec(html)) !== null) {
            iframes.push(match[1]);
        }
        
        // Fallback to param src
        if (iframes.length === 0) {
            const paramMatch = html.match(/<param name="src" value="([^"]+)"/);
            if (paramMatch) iframes.push(paramMatch[1]);
        }
        
        for (let embedUrl of iframes) {
            if (embedUrl.includes("amazon-adsystem")) continue;
            
            if (embedUrl.startsWith("//")) {
                embedUrl = "https:" + embedUrl;
            }
            
            embedUrl = embedUrl.replace("/www.youtube-nocookie.com/", "/www.youtube.com/");
            
            let serverName = "Direct";
            if (embedUrl.includes("youtube.com") || embedUrl.includes("youtu.be")) serverName = "YouTube";
            else if (embedUrl.includes("ok.ru")) serverName = "OkRu";
            else if (embedUrl.includes("streamwish")) serverName = "StreamWish";
            
            streams.push({
                name: "DocumentalesOnline",
                title: `${serverName} (Esp)`,
                url: embedUrl,
                quality: "720p",
                headers: { Referer: url }
            });
        }
        
        return streams;
    } catch (e) {
        console.log(`[DocumentalesOnline] Extract Error: ${e.message}`);
        return [];
    }
}

async function getStreams(id, type, season, episode) {
    console.log(`[DocumentalesOnline] Resolving: ${type} ${id}`);
    const info = await getTMDBInfo(id, type);
    if (!info) return [];

    const results = await searchDocOnline(info.title);
    if (results.length === 0) return [];

    // Select first result as target
    const target = results[0];
    return await extractStreams(target.url);
}

module.exports = { getStreams };
