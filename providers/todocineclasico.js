const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://leyendasdelcine.com";
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
        console.log(`[TodoCineClasico] TMDB Error: ${e.message}`);
        return null;
    }
}

async function searchClasico(query) {
    try {
        const url = `${BASE_URL}/search_elastic?s=${encodeURIComponent(query)}`;
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const cleanHtml = html.replace(/\n|\r|\t|\s{2}/g, '');
        const matches = [];
        const regex = /<div class="single-video">.*?href="([^"]+)".*?title="([^"]+)"/gs;
        let match;
        while ((match = regex.exec(cleanHtml)) !== null) {
            matches.push({
                url: match[1].startsWith("http") ? match[1] : `${BASE_URL}${match[1]}`,
                title: match[2].replace(/&#8211;/g, '').replace(/\\&#039;s/g, "'s").trim()
            });
        }
        return matches;
    } catch (e) {
        console.log(`[TodoCineClasico] Search Error: ${e.message}`);
        return [];
    }
}

async function extractStreams(url) {
    try {
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        
        let lang = "?";
        if (html.includes("?lang_id=8")) lang = "Esp";
        else if (html.includes("?lang_id=9")) lang = "Vose";
        else if (html.includes("?lang_id=4")) lang = "Fr";
        else if (html.includes("?lang_id=2")) lang = "Ing";
        
        // Convert details page to watch page
        const watchUrl = url.replace("/details/", "/watch/");
        const watchHtml = await fetch(watchUrl, { headers: HEADERS }).then(r => r.text());
        const cleanWatchHtml = watchHtml.replace(/\n|\r|\t|\s{2}/g, '');
        
        const streams = [];
        const iframeRegex = /<iframe[^>]*?src="([^"]+)"/g;
        let match;
        while ((match = iframeRegex.exec(cleanWatchHtml)) !== null) {
            let embedUrl = match[1];
            if (embedUrl.startsWith("//")) {
                embedUrl = "https:" + embedUrl;
            }
            
            let serverName = "Direct";
            if (embedUrl.includes("ok.ru")) serverName = "OkRu";
            else if (embedUrl.includes("youtube.com")) serverName = "YouTube";
            else if (embedUrl.includes("streamwish")) serverName = "StreamWish";
            else if (embedUrl.includes("voe.sx")) serverName = "VOE";
            
            streams.push({
                name: "TodoCineClasico",
                title: `${serverName} (${lang})`,
                url: embedUrl,
                quality: "720p",
                headers: { Referer: watchUrl }
            });
        }
        
        return streams;
    } catch (e) {
        console.log(`[TodoCineClasico] Extract Error: ${e.message}`);
        return [];
    }
}

async function getStreams(id, type, season, episode) {
    console.log(`[TodoCineClasico] Resolving: ${type} ${id}`);
    const info = await getTMDBInfo(id, type);
    if (!info) return [];

    const results = await searchClasico(info.title);
    if (results.length === 0) return [];

    // Select first result as target
    const target = results[0];
    return await extractStreams(target.url);
}

module.exports = { getStreams };
