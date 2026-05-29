const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://seriesretro.com";
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
        console.log(`[SeriesRetro] TMDB Error: ${e.message}`);
        return null;
    }
}

async function search(query) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query).replace(/%20/g, "+")}`;
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const matches = [];
        const regex = /<article.*?<h3 class="Title">([^<]+)<\/h3>.*?<a href="([^"]+)"/gs;
        let match;
        while ((match = regex.exec(html)) !== null) {
            matches.push({
                url: match[2],
                title: match[1].trim()
            });
        }
        return matches;
    } catch (e) {
        console.log(`[SeriesRetro] Search Error: ${e.message}`);
        return [];
    }
}

async function extractStreams(url) {
    try {
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const streams = [];
        
        // Match player options
        const regex = /data-tplayernv="Opt(.*?)"><span>(.*?)<\/span>.*?<span>(.*?)<\/span>/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            const optId = match[1];
            const rawServer = match[2].replace(/<[^>]+>/g, '').trim();
            const rawLangQual = match[3].trim();
            
            const server = rawServer.split("-")[0]?.trim() || "Directo";
            
            let lang = "Lat";
            if (rawLangQual.includes("Castellano")) lang = "Esp";
            else if (rawLangQual.includes("Subtitulado") || rawLangQual.includes("Vose")) lang = "Vose";
            else if (rawLangQual.includes("Original")) lang = "VO";

            // Extract the stream URL for this option
            let streamUrl = null;
            const srcMatch = html.match(new RegExp(`id="Opt${optId}".*?src="(.*?)"`));
            if (srcMatch) streamUrl = srcMatch[1];
            
            if (!streamUrl) {
                const xsrcMatch = html.match(new RegExp(`id="Opt${optId}".*?data-xsrc="(.*?)"`));
                if (xsrcMatch) streamUrl = xsrcMatch[1];
            }
            
            if (streamUrl) {
                if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
                
                streams.push({
                    name: "SeriesRetro",
                    title: `${server} (${lang})`,
                    url: streamUrl,
                    quality: "SD/HD",
                    headers: { Referer: url }
                });
            }
        }

        return streams;
    } catch (e) {
        console.log(`[SeriesRetro] Extract Error: ${e.message}`);
        return [];
    }
}

async function getStreams(id, type, season, episode) {
    if (type !== "tv") return [];

    console.log(`[SeriesRetro] Resolving: ${type} ${id}`);
    const info = await getTMDBInfo(id, type);
    if (!info) return [];

    const results = await search(info.title);
    if (results.length === 0) return [];

    const target = results[0];
    const seriesHtml = await fetch(target.url, { headers: HEADERS }).then(r => r.text());
    
    // Find the specific episode URL in the season tab
    const seasonRegex = new RegExp(`data-tab="${season}">.*?<tbody>(.*?)</tbody>`, 's');
    const seasonMatch = seriesHtml.match(seasonRegex);
    if (!seasonMatch) return [];
    
    const epRegex = new RegExp(`<a href="([^"]+)".*?<span class="Num">${episode}</span>`, 'is');
    const epMatch = seasonMatch[1].match(epRegex);
    if (!epMatch) return [];
    
    const epUrl = epMatch[1];
    return await extractStreams(epUrl);
}

module.exports = { getStreams };
