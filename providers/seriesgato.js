const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://vip.seriesgato.pw";
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
        console.log(`[SeriesGato] TMDB Error: ${e.message}`);
        return null;
    }
}

async function search(query) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query).replace(/%20/g, "+")}`;
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const matches = [];
        const regex = /<article.*?<a href="([^"]+)".*?<h3 class="Title">([^<]+)<\/h3>/gs;
        let match;
        while ((match = regex.exec(html)) !== null) {
            matches.push({
                url: match[1],
                title: match[2].trim()
            });
        }
        return matches;
    } catch (e) {
        console.log(`[SeriesGato] Search Error: ${e.message}`);
        return [];
    }
}

async function extractStreams(url) {
    try {
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const streams = [];
        
        const playerBlockMatch = html.match(/<div class="TPlayer">(.*?)<\/span>/s);
        if (!playerBlockMatch) return streams;
        const playerBlock = playerBlockMatch[1];
        
        const optionsRegex = /id="Opt.*?src="([^"]+)"/g;
        let optMatch;
        
        // Also extract languages
        const langMap = {};
        const langRegex = /data-tplayernv="Opt([^"]+)".*?alt="([^"]+)"/g;
        let lMatch;
        while ((lMatch = langRegex.exec(html)) !== null) {
            langMap[lMatch[1]] = lMatch[2].split("-")[0]?.trim() || "Latino";
        }
        
        const iframeRegex = /id="Opt([^"]+)".*?src="([^"]+)"/g;
        while ((optMatch = iframeRegex.exec(playerBlock)) !== null) {
            const optId = optMatch[1];
            let streamUrl = optMatch[2];
            const rawLang = langMap[optId] || "Latino";
            
            let lang = "Lat";
            if (rawLang.includes("Castellano")) lang = "Esp";
            if (rawLang.includes("Subtitulado")) lang = "Vose";
            
            if (streamUrl.includes("links")) {
                // Ignore nested links resolver for simple port, just take direct iframes
                continue;
            }

            streams.push({
                name: "SeriesGato",
                title: `Servidor (${lang})`,
                url: streamUrl,
                quality: "HD",
                headers: { Referer: url }
            });
        }
        return streams;
    } catch (e) {
        console.log(`[SeriesGato] Extract Error: ${e.message}`);
        return [];
    }
}

async function getStreams(id, type, season, episode) {
    if (type !== "tv") return []; // SeriesGato mainly for TV

    console.log(`[SeriesGato] Resolving: ${type} ${id}`);
    const info = await getTMDBInfo(id, type);
    if (!info) return [];

    const results = await search(info.title);
    if (results.length === 0) return [];

    const target = results[0];
    const seriesHtml = await fetch(target.url, { headers: HEADERS }).then(r => r.text());
    
    // Find the specific episode URL in the season tab
    const seasonRegex = new RegExp(`data-tab="${season}"(.*?)</table>`, 's');
    const seasonMatch = seriesHtml.match(seasonRegex);
    if (!seasonMatch) return [];
    
    const epRegex = new RegExp(`href="([^"]+)".*?<span class="Num">${episode}</span>`, 'is');
    const epMatch = seasonMatch[1].match(epRegex);
    if (!epMatch) return [];
    
    const epUrl = epMatch[1];
    return await extractStreams(epUrl);
}

module.exports = { getStreams };
