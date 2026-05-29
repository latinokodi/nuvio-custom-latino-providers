const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://verpelis.gratis";
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
        console.log(`[VerPelis] TMDB Error: ${e.message}`);
        return null;
    }
}

async function searchVerPelis(query) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const cleanHtml = html.replace(/\n|\r|\t|\s{2}/g, '');
        const matches = [];
        const regex = /<article[^>]*>.*?<a href="([^"]+)".*?(?:alt="([^"]+)"|<h2 class="entry-title">([^<]+)<\/h2>)/gs;
        let match;
        while ((match = regex.exec(cleanHtml)) !== null) {
            const url = match[1];
            const title = (match[2] || match[3] || "").trim();
            const isTv = url.includes("/series/");
            
            matches.push({
                url,
                title,
                isTv
            });
        }
        return matches;
    } catch (e) {
        console.log(`[VerPelis] Search Error: ${e.message}`);
        return [];
    }
}

async function extractStreams(url) {
    try {
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const cleanHtml = html.replace(/\n|\r|\t|\s{2}/g, '');
        const streams = [];

        // Try data-litespeed-src first, then standard src
        const iframeRegex = /<iframe[^>]*?data-litespeed-src="([^"]+)"|<iframe[^>]*?src="([^"]+)"/g;
        let match;
        while ((match = iframeRegex.exec(cleanHtml)) !== null) {
            let embedUrl = match[1] || match[2];
            if (!embedUrl || embedUrl.includes(".youtube.") || embedUrl.includes("amazon-adsystem")) continue;
            
            if (embedUrl.startsWith("//")) {
                embedUrl = "https:" + embedUrl;
            }
            
            let serverName = "Direct";
            if (embedUrl.includes("ok.ru")) serverName = "OkRu";
            else if (embedUrl.includes("streamwish")) serverName = "StreamWish";
            else if (embedUrl.includes("voe.sx")) serverName = "VOE";
            
            // Extract language if present in standard DooPlay layout option headers
            let lang = "Lat";
            if (cleanHtml.includes("Idioma: Español") || cleanHtml.includes("Español Castellano")) {
                lang = "Esp";
            }
            
            streams.push({
                name: "VerPelis",
                title: `${serverName} (${lang})`,
                url: embedUrl,
                quality: "720p",
                headers: { Referer: url }
            });
        }
        
        return streams;
    } catch (e) {
        console.log(`[VerPelis] Extract Error: ${e.message}`);
        return [];
    }
}

async function getStreams(id, type, season, episode) {
    console.log(`[VerPelis] Resolving: ${type} ${id}`);
    const info = await getTMDBInfo(id, type);
    if (!info) return [];

    const results = await searchVerPelis(info.title);
    if (results.length === 0) return [];

    // Filter by type
    const target = results.find(r => (type === "tv" && r.isTv) || (type === "movie" && !r.isTv)) || results[0];
    let url = target.url;
    
    if (type === "tv") {
        try {
            const seriesHtml = await fetch(url, { headers: HEADERS }).then(r => r.text());
            const cleanHtml = seriesHtml.replace(/\n|\r|\t|\s{2}/g, '');
            
            // Extract the block for the requested season
            const blockRegex = new RegExp(`class=['"]se-t.*?['"]>${season}</span>(.*?)(?:</ul>|<div class=['"]se-q['"]|$)`, 'i');
            const blockMatch = cleanHtml.match(blockRegex);
            if (blockMatch) {
                const searchBlock = blockMatch[1];
                
                // Match the episode url inside DooPlay layout
                const epRegex = /<div class=['"]numerando['"]>([^<]+)<\/div>.*?<a href=['"]([^'"]+)['"]/g;
                let match;
                let epUrl = null;
                while ((match = epRegex.exec(searchBlock)) !== null) {
                    const numerando = match[1].trim(); // e.g. "1 - 1" or "1x1"
                    const link = match[2];
                    if (numerando.endsWith(`- ${episode}`) || numerando.endsWith(`-${episode}`) || numerando.includes(`x${episode}`)) {
                        epUrl = link;
                        break;
                    }
                }
                if (epUrl) url = epUrl;
            }
        } catch (e) {
            console.log(`[VerPelis] Episode resolution error: ${e.message}`);
        }
    }

    return await extractStreams(url);
}

module.exports = { getStreams };
