const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://online.historiadelcine.es";
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
        console.log(`[RetroCinema] TMDB Error: ${e.message}`);
        return null;
    }
}

async function searchRetroCinema(query) {
    try {
        // WordPress ajax search with zeus theme configuration
        const ajaxUrl = `${BASE_URL}/wp-admin/admin-ajax.php`;
        
        // Use URLSearchParams for form-data body
        const body = new URLSearchParams();
        body.append("action", "zeus_ajax_search");
        body.append("nonce", "8dd2cfb37b"); // Hardcoded nonce from theme
        body.append("search", query);
        body.append("type", "post");

        const res = await fetch(ajaxUrl, {
            method: "POST",
            headers: Object.assign({}, HEADERS, {
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": BASE_URL + "/"
            }),
            body: body.toString()
        }).then(r => r.text());

        const matches = [];
        const regex = /<li>.*?href="([^"]+)".*?alt="([^"]+)"/gs;
        let match;
        while ((match = regex.exec(res)) !== null) {
            matches.push({
                url: match[1],
                title: match[2].trim()
            });
        }
        return matches;
    } catch (e) {
        console.log(`[RetroCinema] Search Error: ${e.message}`);
        return [];
    }
}

async function extractStreams(url) {
    try {
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const cleanHtml = html.replace(/\n|\r|\t|\s{2}/g, '');
        const streams = [];
        
        const isEsp = html.includes("Película completa en español");
        const lang = isEsp ? "Esp" : "?";

        // Option 1: iframe data-src
        const iframeRegex = /<iframe[^>]*?data-src="([^"]+)"/g;
        let match;
        while ((match = iframeRegex.exec(cleanHtml)) !== null) {
            let embedUrl = match[1];
            if (embedUrl.startsWith("//")) {
                embedUrl = "https:" + embedUrl;
            }
            
            let serverName = "Direct";
            if (embedUrl.includes("youtube.com")) serverName = "YouTube";
            else if (embedUrl.includes("ok.ru")) serverName = "OkRu";
            else if (embedUrl.includes("streamwish")) serverName = "StreamWish";
            
            streams.push({
                name: "RetroCinema",
                title: `${serverName} (${lang})`,
                url: embedUrl,
                quality: "720p",
                headers: { Referer: url }
            });
        }

        // Option 2: Fallback to inline youtube_url
        if (streams.length === 0) {
            const ytRegex = /youtube_url\\?":\\?"([^"]+)\\?",\\?"/g;
            let ytMatch;
            while ((ytMatch = ytRegex.exec(cleanHtml)) !== null) {
                let embedUrl = ytMatch[1].replace(/\\/g, "");
                if (embedUrl.startsWith("//")) {
                    embedUrl = "https:" + embedUrl;
                }
                
                streams.push({
                    name: "RetroCinema",
                    title: `YouTube (${lang})`,
                    url: embedUrl,
                    quality: "1080p",
                    headers: { Referer: url }
                });
            }
        }
        
        return streams;
    } catch (e) {
        console.log(`[RetroCinema] Extract Error: ${e.message}`);
        return [];
    }
}

async function getStreams(id, type, season, episode) {
    console.log(`[RetroCinema] Resolving: ${type} ${id}`);
    const info = await getTMDBInfo(id, type);
    if (!info) return [];

    const results = await searchRetroCinema(info.title);
    if (results.length === 0) return [];

    // Select first result as target
    const target = results[0];
    return await extractStreams(target.url);
}

module.exports = { getStreams };
