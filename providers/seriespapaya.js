const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://magistv24.com";
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
        console.log(`[SeriesPapaya] TMDB Error: ${e.message}`);
        return null;
    }
}

async function search(query) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query).replace(/%20/g, "+")}`;
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const matches = [];
        const regex = /<article.*?<a href="([^"]+)" class="lnk-blk".*?<h2 class="entry-title">([^<]+)<\/h2>/gs;
        let match;
        while ((match = regex.exec(html)) !== null) {
            matches.push({
                url: match[1],
                title: match[2].trim()
            });
        }
        return matches;
    } catch (e) {
        console.log(`[SeriesPapaya] Search Error: ${e.message}`);
        return [];
    }
}

async function extractStreams(url) {
    try {
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const streams = [];
        
        // Find languages and servers mapped to options
        // href="#options-(.*?)">.*?<span class="server">(.*?)</span>
        const langRegex = /href="#options-([^"]+)".*?<span class="server">([^<]+)<\/span>/g;
        let lMatch;
        const opts = {};
        while ((lMatch = langRegex.exec(html)) !== null) {
            const id = lMatch[1];
            const raw = lMatch[2]; // e.g. "Directo - Español Latino"
            let lang = "Lat";
            if (raw.includes("Castellano")) lang = "Esp";
            else if (raw.includes("Sub")) lang = "Vose";
            
            let server = raw.split("-")[0]?.trim() || "Directo";
            opts[id] = { server, lang };
        }

        // iframes are usually direct in the options or base64 encoded
        const iframeRegex = /<iframe.*?src="([^"]+)"/g;
        let iMatch;
        let i = 1;
        while ((iMatch = iframeRegex.exec(html)) !== null) {
            const streamUrl = iMatch[1];
            // Simplistic mapping, assuming iframes appear in same order as options if they aren't explicitly linked by id in DOM easily
            const meta = opts[i.toString()] || { server: "Video", lang: "Lat" };
            i++;
            
            streams.push({
                name: "SeriesPapaya",
                title: `${meta.server} (${meta.lang})`,
                url: streamUrl,
                quality: "HD",
                headers: { Referer: url }
            });
        }

        return streams;
    } catch (e) {
        console.log(`[SeriesPapaya] Extract Error: ${e.message}`);
        return [];
    }
}

async function getStreams(id, type, season, episode) {
    if (type !== "tv") return []; 

    console.log(`[SeriesPapaya] Resolving: ${type} ${id}`);
    const info = await getTMDBInfo(id, type);
    if (!info) return [];

    const results = await search(info.title);
    if (results.length === 0) return [];

    const target = results[0];
    const seriesHtml = await fetch(target.url, { headers: HEADERS }).then(r => r.text());
    
    // Find dpost for AJAX call
    const postMatch = seriesHtml.match(new RegExp(`data-post="([^"]+)" data-season="${season}"`));
    if (!postMatch) return [];
    
    const dpost = postMatch[1];
    
    // Call AJAX endpoint
    const ajaxRes = await fetch(`${BASE_URL}/wp-admin/admin-ajax.php`, {
        method: "POST",
        headers: {
            ...HEADERS,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        },
        body: `action=action_select_season&post=${dpost}&season=${season}`
    }).then(r => r.text());
    
    // Find episode URL
    // Format is usually <span class="num-epi">SxE</span>... <a href="...">
    const epRegex = new RegExp(`<article.*?<a href="([^"]+)".*?<span class="num-epi">.*?x${episode}</span>`, 'is');
    const epMatch = ajaxRes.match(epRegex);
    if (!epMatch) return [];
    
    const epUrl = epMatch[1];
    return await extractStreams(epUrl);
}

module.exports = { getStreams };
