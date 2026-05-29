const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://cinehindi.com";
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
        console.log(`[CineHindi] TMDB Error: ${e.message}`);
        return null;
    }
}

async function searchCineHindi(query) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const matches = [];
        const regex = /<article[^>]*>.*?<a href="([^"]+)".*?<h2 class="entry-title">([^<]+)<\/h2>/gs;
        let match;
        while ((match = regex.exec(html)) !== null) {
            matches.push({
                url: match[1],
                title: match[2].trim()
            });
        }
        return matches;
    } catch (e) {
        console.log(`[CineHindi] Search Error: ${e.message}`);
        return [];
    }
}

async function extractStreams(url) {
    try {
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const cleanHtml = html.replace(/\n|\r|\t|\s{2}/g, '');
        const streams = [];
        
        // Find options blocks
        const optionRegex = /<div id="options-([^"]+)"[^>]*>(.*?)<\/div>/g;
        let match;
        while ((match = optionRegex.exec(cleanHtml)) !== null) {
            const optId = match[1];
            const optContent = match[2];
            
            // Find iframe URL
            const iframeMatch = optContent.match(/<iframe.*?src="([^"]+)"/) || optContent.match(/<iframe.*?data-src="([^"]+)"/);
            if (!iframeMatch) continue;
            
            let streamUrl = iframeMatch[1];
            if (streamUrl.startsWith("//")) {
                streamUrl = "https:" + streamUrl;
            }
            
            // Find corresponding server name in page headers
            const serverNameRegex = new RegExp(`href="#options-${optId}".*?<span class="server">([^<]+)</span>`);
            const serverMatch = cleanHtml.match(serverNameRegex);
            const serverName = serverMatch ? serverMatch[1].trim() : "Unknown";
            
            if (serverName.toLowerCase().includes("youtube")) continue;
            
            streams.push({
                name: "CineHindi",
                title: `${serverName} (Vose)`,
                url: streamUrl,
                quality: "720p",
                headers: { Referer: url }
            });
        }
        
        return streams;
    } catch (e) {
        console.log(`[CineHindi] Extract Error: ${e.message}`);
        return [];
    }
}

async function getStreams(id, type, season, episode) {
    console.log(`[CineHindi] Resolving: ${type} ${id}`);
    const info = await getTMDBInfo(id, type);
    if (!info) return [];

    const results = await searchCineHindi(info.title);
    if (results.length === 0) return [];

    // Select first result as target
    const target = results[0];
    return await extractStreams(target.url);
}

module.exports = { getStreams };
