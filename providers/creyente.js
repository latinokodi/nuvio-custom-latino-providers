const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://creyente.digital";
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
        console.log(`[Creyente] TMDB Error: ${e.message}`);
        return null;
    }
}

async function searchCreyente(query) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const cleanHtml = html.replace(/\n|\r|\t|\s{2}/g, '');
        
        // Find Results section
        const resultsMatch = cleanHtml.match(/>Resultados (.*?)<\/section>/s);
        if (!resultsMatch) return [];
        
        const matches = [];
        const regex = /<article[^>]*>.*?<a href="([^"]+)".*?alt="([^"]+)".*?<h2 class="entry-title">([^<]+)<\/h2>/gs;
        let match;
        while ((match = regex.exec(resultsMatch[1])) !== null) {
            const url = match[1];
            const title = match[2].trim();
            const heading = match[3];
            
            const isTv = heading.includes("Series") || heading.includes("Temporada") || url.includes("/series-cristianas/");
            matches.push({
                url,
                title,
                isTv
            });
        }
        return matches;
    } catch (e) {
        console.log(`[Creyente] Search Error: ${e.message}`);
        return [];
    }
}

async function extractStreams(url) {
    try {
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const cleanHtml = html.replace(/\n|\r|\t|\s{2}/g, '');
        const streams = [];
        
        const isVose = url.includes("/subtitulada/");
        const lang = isVose ? "Vose" : "Lat";
        
        // Match iframes
        const iframeRegex = /<iframe[^>]*?data-litespeed-src="([^"]+)"|<iframe[^>]*?src="([^"]+)"/g;
        let match;
        while ((match = iframeRegex.exec(cleanHtml)) !== null) {
            let embedUrl = match[1] || match[2];
            if (!embedUrl || embedUrl.includes(".youtube.")) continue;
            
            if (embedUrl.startsWith("//")) {
                embedUrl = "https:" + embedUrl;
            }
            
            let serverName = "Direct";
            if (embedUrl.includes("ok.ru")) serverName = "OkRu";
            else if (embedUrl.includes("drive.google")) serverName = "GVideo";
            else if (embedUrl.includes("streamwish")) serverName = "StreamWish";
            else if (embedUrl.includes("voe.sx")) serverName = "VOE";
            
            streams.push({
                name: "Creyente",
                title: `${serverName} (${lang})`,
                url: embedUrl,
                quality: "720p",
                headers: { Referer: url }
            });
        }
        
        return streams;
    } catch (e) {
        console.log(`[Creyente] Extract Error: ${e.message}`);
        return [];
    }
}

async function getStreams(id, type, season, episode) {
    console.log(`[Creyente] Resolving: ${type} ${id}`);
    const info = await getTMDBInfo(id, type);
    if (!info) return [];

    const results = await searchCreyente(info.title);
    if (results.length === 0) return [];

    // Filter by type
    const target = results.find(r => (type === "tv" && r.isTv) || (type === "movie" && !r.isTv)) || results[0];
    let url = target.url;
    
    if (type === "tv") {
        try {
            const seriesHtml = await fetch(url, { headers: HEADERS }).then(r => r.text());
            const cleanHtml = seriesHtml.replace(/\n|\r|\t|\s{2}/g, '');
            
            // Try to find the block for the requested season
            const blockRegex = new RegExp(`id="(?:temporada|h-temporadas)-${season}"(.*?)(?:<h2 class="wp-block-heading|<center>|$)`, 'i');
            const blockMatch = cleanHtml.match(blockRegex);
            const searchBlock = blockMatch ? blockMatch[1] : cleanHtml;
            
            // Extract episodes
            const epRegex = /<article[^>]*>.*?<a href="([^"]+)".*?alt="([^"]+)"/g;
            let match;
            let epUrl = null;
            while ((match = epRegex.exec(searchBlock)) !== null) {
                const link = match[1];
                const alt = match[2];
                if (alt.includes(`Capitulo ${episode}`) || alt.includes(`Capítulo ${episode}`)) {
                    epUrl = link;
                    break;
                }
            }
            if (epUrl) url = epUrl;
        } catch (e) {
            console.log(`[Creyente] Episode resolution error: ${e.message}`);
        }
    }

    return await extractStreams(url);
}

module.exports = { getStreams };
