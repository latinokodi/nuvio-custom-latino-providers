const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://luciferdonghua.in/";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive"
};

async function getTMDBInfo(id, type) {
    try {
        const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US`;
        const res = await fetch(url, { headers: HEADERS }).then(r => r.json());
        return {
            title: type === "movie" ? res.title : res.name,
            original_title: type === "movie" ? res.original_title : res.original_name,
            year: (res.release_date || res.first_air_date || "").substring(0, 4)
        };
    } catch (e) {
        console.log(`[LuciferDonghua] TMDB Error: ${e.message}`);
        return null;
    }
}

function cleanTitle(title) {
    if (!title) return "";
    return title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

async function searchAnime(query, originalTitle) {
    const searchUrl = `${BASE_URL}?s=${encodeURIComponent(query)}`;
    console.log(`[LuciferDonghua] Searching query: "${query}" -> ${searchUrl}`);
    
    try {
        const html = await fetch(searchUrl, { headers: HEADERS }).then(r => r.text());
        const regex = /<a\s+[^>]*href=["'](https:\/\/luciferdonghua\.in\/anime\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        const results = [];
        const seen = new Set();
        
        const cleanedQuery = cleanTitle(query);
        const cleanedOrig = cleanTitle(originalTitle);

        while ((match = regex.exec(html)) !== null) {
            let url = match[1];
            let titleText = match[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
            
            if (url.includes("/wp-content/") || url.includes("/wp-includes/") || seen.has(url)) {
                continue;
            }
            
            seen.add(url);
            
            const cleanedTitle = cleanTitle(titleText);
            let score = 0;
            
            if (!cleanedTitle) {
                continue;
            }
            
            if (cleanedTitle === cleanedQuery) {
                score += 100;
            } else if (cleanedTitle.includes(cleanedQuery) || cleanedQuery.includes(cleanedTitle)) {
                score += 40;
            }
            
            if (cleanedOrig) {
                if (cleanedTitle === cleanedOrig) {
                    score += 80;
                } else if (cleanedTitle.includes(cleanedOrig) || cleanedOrig.includes(cleanedTitle)) {
                    score += 30;
                }
            }
            
            // Strict number/season matching
            const queryNumbers = [...new Set(cleanedQuery.match(/\d/g) || [])].sort().join("");
            const titleNumbers = [...new Set(cleanedTitle.match(/\d/g) || [])].sort().join("");
            if (queryNumbers !== titleNumbers) {
                score -= 80;
            } else if (queryNumbers.length > 0) {
                score += 30;
            }
            
            const lengthDiff = Math.abs(cleanedTitle.length - cleanedQuery.length);
            score -= lengthDiff * 0.05;

            console.log(`  - Candidate: "${titleText}" (Cleaned: "${cleanedTitle}", Score: ${score}) -> ${url}`);
            results.push({ url, title: titleText, score });
        }
        
        return results.sort((a, b) => b.score - a.score);
    } catch (e) {
        console.log(`[LuciferDonghua] Search Error: ${e.message}`);
        return [];
    }
}

async function getStreams(id, type, season, episode) {
    console.log(`[LuciferDonghua] Resolving: TMDB ${id} (${type}), Season: ${season}, Episode: ${episode}`);
    const info = await getTMDBInfo(id, type);
    if (!info) {
        console.log("[LuciferDonghua] Could not retrieve TMDB info.");
        return [];
    }

    console.log(`[LuciferDonghua] TMDB Title: "${info.title}", Original: "${info.original_title}", Year: ${info.year}`);

    // Fallback queries
    const queries = [info.title];
    if (info.title.includes(":")) {
        queries.push(info.title.split(":")[0].trim());
    }
    if (info.title.includes("-")) {
        queries.push(info.title.split("-")[0].trim());
    }
    
    if (info.title.toLowerCase().includes("soul land")) {
        queries.push("soul land");
    }
    if (info.title.toLowerCase().includes("perfect world")) {
        queries.push("perfect world");
    }
    
    if (info.original_title && info.original_title !== info.title) {
        queries.push(info.original_title);
    }

    let results = [];
    for (const q of queries) {
        results = await searchAnime(q, info.original_title);
        if (results.length > 0 && results[0].score > 10) {
            break;
        }
    }

    if (results.length === 0) {
        console.log(`[LuciferDonghua] No anime matches found for: ${info.title}`);
        return [];
    }

    const matchedAnime = results[0];
    console.log(`[LuciferDonghua] Chosen Best Match: "${matchedAnime.title}" (Score: ${matchedAnime.score}) -> ${matchedAnime.url}`);

    let targetUrl = matchedAnime.url;

    if (type === "tv") {
        console.log(`[LuciferDonghua] Fetching series page to find episode ${episode}...`);
        try {
            const seriesHtml = await fetch(matchedAnime.url, { headers: HEADERS }).then(r => r.text());
            
            const epUrls = [];
            const epSeen = new Set();
            // Matching any Lucifer Donghua post URLs in the series listing
            const epRegex = /href=["'](https:\/\/luciferdonghua\.in\/[^"']+)["']/gi;
            let match;
            
            while ((match = epRegex.exec(seriesHtml)) !== null) {
                let u = match[1];
                if (u.includes("-episode-") && !epSeen.has(u)) {
                    epSeen.add(u);
                    epUrls.push(u);
                }
            }

            console.log(`[LuciferDonghua] Found ${epUrls.length} episode links on series page.`);

            let matchedEpUrl = null;
            
            // Try strict episode number checks: e.g. -episode-271- or -episode-271/ or ending in -episode-271
            const targetPattern1 = new RegExp(`-episode-${episode}(?:-|\\/|$)`, 'i');
            matchedEpUrl = epUrls.find(u => targetPattern1.test(u));
            
            if (!matchedEpUrl) {
                const paddedEp = String(episode).padStart(2, '0');
                const targetPattern2 = new RegExp(`-episode-${paddedEp}(?:-|\\/|$)`, 'i');
                matchedEpUrl = epUrls.find(u => targetPattern2.test(u));
            }
            
            if (!matchedEpUrl) {
                const targetPattern3 = new RegExp(`episode-${episode}`, 'i');
                matchedEpUrl = epUrls.find(u => targetPattern3.test(u));
            }

            if (!matchedEpUrl) {
                console.log(`[LuciferDonghua] Could not find episode ${episode} link in list.`);
                return [];
            }

            console.log(`[LuciferDonghua] Matched Episode URL: ${matchedEpUrl}`);
            targetUrl = matchedEpUrl;

        } catch (e) {
            console.log(`[LuciferDonghua] Episode navigation error: ${e.message}`);
            return [];
        }
    }

    console.log(`[LuciferDonghua] Fetching play page: ${targetUrl}`);
    const streams = [];

    try {
        const pageHtml = await fetch(targetUrl, { headers: HEADERS }).then(r => r.text());
        
        // Find player options dropdown sub-pages (e.g. /v/1/, /v/2/, etc.)
        const optionRegex = /<option\s+[^>]*value=["'](https:\/\/luciferdonghua\.in\/[^"']+\/v\/\d+\/?)["'][^>]*>([\s\S]*?)<\/option>/gi;
        const relativeOptionRegex = /<option\s+[^>]*value=["'](\/?v\/\d+\/?)["'][^>]*>([\s\S]*?)<\/option>/gi;
        
        const serverOptions = [];
        const seenUrls = new Set();
        let match;
        
        // Parse absolute player option links
        while ((match = optionRegex.exec(pageHtml)) !== null) {
            let u = match[1];
            let label = match[2].trim().replace(/\s+/g, ' ');
            if (!seenUrls.has(u)) {
                seenUrls.add(u);
                serverOptions.push({ url: u, label });
            }
        }
        
        // Parse relative option links if none found
        if (serverOptions.length === 0) {
            while ((match = relativeOptionRegex.exec(pageHtml)) !== null) {
                let path = match[1];
                let label = match[2].trim().replace(/\s+/g, ' ');
                let absoluteUrl = targetUrl.endsWith('/') ? targetUrl + path.replace(/^\//, '') : targetUrl + '/' + path.replace(/^\//, '');
                if (!seenUrls.has(absoluteUrl)) {
                    seenUrls.add(absoluteUrl);
                    serverOptions.push({ url: absoluteUrl, label });
                }
            }
        }

        console.log(`[LuciferDonghua] Found ${serverOptions.length} player server subpages.`);

        // Helper to extract iframes from a page
        const extractIframesFromPage = (htmlText, label) => {
            const iframeRegex = /<iframe[^>]*src=["']([^"']+)["']/gi;
            let subMatch;
            let pageStreamsCount = 0;
            while ((subMatch = iframeRegex.exec(htmlText)) !== null) {
                let embedUrl = subMatch[1];
                
                // Strict decoy, shortener, and advertisement filters
                const lowerUrl = embedUrl.toLowerCase();
                if (lowerUrl.includes("youtube.com") || 
                    lowerUrl.includes("doubleclick") || 
                    lowerUrl.includes("ads") || 
                    lowerUrl.includes("saroadexchange") || 
                    lowerUrl.includes("cashzilla") ||
                    lowerUrl.includes("t.co") ||
                    lowerUrl.includes("blogspot.com") ||
                    lowerUrl.includes("luciferdonghua.in") || // Filters local decoy pages
                    lowerUrl.includes("cryptojobss.com") ||
                    lowerUrl.includes("nextbitcoins.com") ||
                    lowerUrl.includes("coinprediction.ai")) {
                    continue;
                }
                
                if (embedUrl.startsWith("//")) embedUrl = "https:" + embedUrl;
                
                let quality = "720p";
                if (label.toLowerCase().includes("4k") || label.toLowerCase().includes("2160p")) {
                    quality = "2160p";
                } else if (label.toLowerCase().includes("1080p") || label.toLowerCase().includes("fhd")) {
                    quality = "1080p";
                } else if (label.toLowerCase().includes("720p") || label.toLowerCase().includes("hd")) {
                    quality = "720p";
                }

                streams.push({
                    name: "LuciferDonghua",
                    title: label || "Mirror",
                    url: embedUrl,
                    quality: quality,
                    headers: {
                        "Referer": BASE_URL
                    }
                });
                pageStreamsCount++;
            }
            return pageStreamsCount;
        };

        if (serverOptions.length > 0) {
            // Fetch and resolve streams from each sub-page
            for (const opt of serverOptions) {
                console.log(`[LuciferDonghua] Fetching server option: "${opt.label}" -> ${opt.url}`);
                try {
                    const subHtml = await fetch(opt.url, { headers: HEADERS }).then(r => r.text());
                    const extracted = extractIframesFromPage(subHtml, opt.label);
                    console.log(`  - Extracted ${extracted} stream(s) from subpage.`);
                } catch (subErr) {
                    console.log(`[LuciferDonghua] Failed to fetch server option ${opt.url}: ${subErr.message}`);
                }
            }
        } else {
            // Fallback: extract iframes from the main play page
            console.log("[LuciferDonghua] No player server options dropdown found. Extracting from main page...");
            extractIframesFromPage(pageHtml, "Direct Embed");
        }

        console.log(`[LuciferDonghua] Resolved ${streams.length} streams successfully.`);
        return streams;

    } catch (e) {
        console.log(`[LuciferDonghua] Error resolving streams: ${e.message}`);
        return [];
    }
}

module.exports = { getStreams };
