const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://ww3.gnulahd.nu";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-MX,es;q=0.9",
    "Connection": "keep-alive"
};

/**
 * TMDB lookup to get title and year
 */
async function getTMDBInfo(id, type) {
    const langs = [{ lang: "es-MX", name: "Latino" }, { lang: "es-ES", name: "España" }, { lang: "en-US", name: "Inglés" }];
    for (const { lang } of langs) {
        try {
            const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}`;
            const res = await fetch(url, { headers: HEADERS }).then(r => r.json());
            const title = type === "movie" ? res.title : res.name;
            const originalTitle = type === "movie" ? res.original_title : res.original_name;
            if (!title) continue;
            return {
                title,
                originalTitle,
                year: (res.release_date || res.first_air_date || "").substring(0, 4)
            };
        } catch (e) {
            console.log(`[Gnula] TMDB Error: ${e.message}`);
        }
    }
    return null;
}

/**
 * Search on Gnula by title
 */
async function searchGnula(query) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const matches = [];
        const regex = /<article class="bs".*?<a href="([^"]+)".*?title="([^"]+)".*?<div class="typez([^"]*)<\/div>/gs;
        let match;
        while ((match = regex.exec(html)) !== null) {
            matches.push({
                url: match[1],
                title: match[2],
                isMovie: match[3].includes("Pelicula")
            });
        }
        return matches;
    } catch (e) {
        console.log(`[Gnula] Search Error: ${e.message}`);
        return [];
    }
}

/**
 * Extract embeds from a page
 */
async function extractEmbeds(url) {
    try {
        const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const embeds = [];
        
        // Option 1: Direct iframes in players
        const iframeRegex = /<div class="player-embed".*?<iframe.*?src="([^"]+)"/g;
        let match;
        while ((match = iframeRegex.exec(html)) !== null) {
            embeds.push(match[1]);
        }

        // Option 2: Embed links in tabs/list
        const listRegex = /<li data-index="[^"]+".*?<a href="([^"]+)"/g;
        while ((match = listRegex.exec(html)) !== null) {
            const optionHtml = await fetch(match[1], { headers: HEADERS }).then(r => r.text());
            const optIframe = optionHtml.match(/<div class="player-embed".*?<iframe.*?src="([^"]+)"/);
            if (optIframe) embeds.push(optIframe[1]);
        }

        return [...new Set(embeds)];
    } catch (e) {
        console.log(`[Gnula] Extract Error: ${e.message}`);
        return [];
    }
}

/**
 * Resolve an embed URL to a stream
 */
async function resolveEmbed(url) {
    // This is a simplified resolver. In a real scenario, you'd use common resolvers.
    // Luvio seems to have some internal resolvers or we can implement them.
    // For now, let's just return the URL if it's a known host.
    if (url.includes("embed.php?id=")) {
        try {
            const html = await fetch(url, { headers: HEADERS }).then(r => r.text());
            const videoRegex = /var videos\s*=\s*\[(.*?)\]/s;
            const videoMatch = html.match(videoRegex);
            if (videoMatch) {
                // Extract URLs from the array
                const urls = videoMatch[1].split(",").map(s => s.trim().replace(/^"|"$/g, ""));
                // For simplicity, pick the first one or all
                return urls.map(u => ({
                    name: "Gnula",
                    title: "Direct",
                    url: u,
                    quality: "1080p",
                    headers: { Referer: url }
                }));
            }
        } catch (e) {}
    }
    
    // Fallback for other hosts
    return [{
        name: "Gnula",
        title: "Link",
        url: url,
        quality: "720p",
        headers: { Referer: BASE_URL }
    }];
}

/**
 * Main export for Luvio
 */
async function getStreams(id, type, season, episode) {
    console.log(`[Gnula] Resolving: ${type} ${id}`);
    const info = await getTMDBInfo(id, type);
    if (!info) return [];

    const results = await searchGnula(info.title);
    const target = results.find(r => 
        (type === "movie" && r.isMovie) || (type === "tv" && !r.isMovie)
    );

    if (!target) return [];

    let url = target.url;
    if (type === "tv") {
        // Find specific episode
        const episodesHtml = await fetch(url, { headers: HEADERS }).then(r => r.text());
        const epRegex = new RegExp(`<a href="([^"]+)".*?<div class="epl-num">${season}x${episode}<\/div>`, 'i');
        const epMatch = episodesHtml.match(epRegex);
        if (!epMatch) return [];
        url = epMatch[1];
    }

    const embeds = await extractEmbeds(url);
    const streams = [];
    for (const embed of embeds) {
        const resolved = await resolveEmbed(embed);
        if (resolved) streams.push(...resolved);
    }

    return streams;
}

module.exports = { getStreams };
