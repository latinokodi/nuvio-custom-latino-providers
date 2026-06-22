const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://donghuastream.org/";
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
        console.log(`[DonghuaStream] TMDB Error: ${e.message}`);
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
    console.log(`[DonghuaStream] Searching query: "${query}" -> ${searchUrl}`);
    
    try {
        const html = await fetch(searchUrl, { headers: HEADERS }).then(r => r.text());
        const regex = /<a\s+[^>]*href=["'](https:\/\/donghuastream\.org\/anime\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        const results = [];
        const seen = new Set();
        
        const cleanedQuery = cleanTitle(query);
        const cleanedOrig = cleanTitle(originalTitle);

        while ((match = regex.exec(html)) !== null) {
            let url = match[1];
            let rawText = match[2];
            let titleText = rawText.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
            
            if (url.includes("/wp-content/") || url.includes("/wp-includes/") || seen.has(url)) {
                continue;
            }
            
            seen.add(url);
            
            const cleanedTitle = cleanTitle(titleText);
            let score = 0;
            
            // Skip empty titles to avoid incorrect matching
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
                score -= 80; // Large penalty for mismatched season numbers
            } else if (queryNumbers.length > 0) {
                score += 30; // Boost for exact season number matches
            }
            
            // Minimal length penalty (0.05 instead of 0.5) to prefer closer length matches
            const lengthDiff = Math.abs(cleanedTitle.length - cleanedQuery.length);
            score -= lengthDiff * 0.05;

            console.log(`  - Candidate: "${titleText}" (Cleaned: "${cleanedTitle}", Score: ${score}) -> ${url}`);
            results.push({ url, title: titleText, score });
        }
        
        // Sort by score descending
        return results.sort((a, b) => b.score - a.score);
    } catch (e) {
        console.log(`[DonghuaStream] Search Error: ${e.message}`);
        return [];
    }
}

async function getStreams(id, type, season, episode) {
    console.log(`[DonghuaStream] Resolving: TMDB ${id} (${type}), Season: ${season}, Episode: ${episode}`);
    const info = await getTMDBInfo(id, type);
    if (!info) {
        console.log("[DonghuaStream] Could not retrieve TMDB info.");
        return [];
    }

    console.log(`[DonghuaStream] TMDB Title: "${info.title}", Original: "${info.original_title}", Year: ${info.year}`);

    // Generate fallback queries to search robustly
    const queries = [info.title];
    if (info.title.includes(":")) {
        queries.push(info.title.split(":")[0].trim());
    }
    if (info.title.includes("-")) {
        queries.push(info.title.split("-")[0].trim());
    }
    
    // Add common variants
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
        console.log(`[DonghuaStream] Query "${q}" returned ${results.length} matches.`);
        if (results.length > 0) {
            console.log(`[DonghuaStream] Top match: "${results[0].title}" (Score: ${results[0].score}) -> ${results[0].url}`);
        }
        if (results.length > 0 && results[0].score > 10) {
            break; // Found a good match
        }
    }

    if (results.length === 0) {
        console.log(`[DonghuaStream] No anime matches found for: ${info.title}`);
        return [];
    }

    const matchedAnime = results[0];
    console.log(`[DonghuaStream] Chosen Best Match: "${matchedAnime.title}" (Score: ${matchedAnime.score}) -> ${matchedAnime.url}`);

    let targetUrl = matchedAnime.url;

    if (type === "tv") {
        console.log(`[DonghuaStream] Fetching series page to find episode ${episode}...`);
        try {
            const seriesHtml = await fetch(matchedAnime.url, { headers: HEADERS }).then(r => r.text());
            
            // Search for episode URLs
            // Example: https://donghuastream.org/soul-land-2-the-peerless-tang-sect-episode-155-multiple-subtitles/
            const epUrls = [];
            const epSeen = new Set();
            const epRegex = /href=["'](https:\/\/donghuastream\.org\/[^"']+)["']/gi;
            let match;
            
            while ((match = epRegex.exec(seriesHtml)) !== null) {
                let u = match[1];
                if (u.includes("-episode-") && !epSeen.has(u)) {
                    epSeen.add(u);
                    epUrls.push(u);
                }
            }

            console.log(`[DonghuaStream] Found ${epUrls.length} episode links on series page.`);

            // Search for specific episode matches
            // We want to find the link containing `-episode-X-` or `-episode-X/` or ending with `-episode-X`
            // where X is the target episode number
            let matchedEpUrl = null;
            
            // 1. Try strict matching: e.g., -episode-155- or -episode-155/
            const targetPattern1 = new RegExp(`-episode-${episode}(?:-|\\/|$)`, 'i');
            matchedEpUrl = epUrls.find(u => targetPattern1.test(u));
            
            // 2. Try looser matching if strict fails (e.g., episode-04- or episode-04)
            if (!matchedEpUrl) {
                const paddedEp = String(episode).padStart(2, '0');
                const targetPattern2 = new RegExp(`-episode-${paddedEp}(?:-|\\/|$)`, 'i');
                matchedEpUrl = epUrls.find(u => targetPattern2.test(u));
            }
            
            // 3. Fallback: check if the slug ends with the episode number
            if (!matchedEpUrl) {
                const targetPattern3 = new RegExp(`episode-${episode}`, 'i');
                matchedEpUrl = epUrls.find(u => targetPattern3.test(u));
            }

            if (!matchedEpUrl) {
                console.log(`[DonghuaStream] Could not find episode ${episode} link in list.`);
                return [];
            }

            console.log(`[DonghuaStream] Matched Episode URL: ${matchedEpUrl}`);
            targetUrl = matchedEpUrl;

        } catch (e) {
            console.log(`[DonghuaStream] Episode navigation error: ${e.message}`);
            return [];
        }
    }

    // Now fetch the target video player page (either movie page or episode page)
    console.log(`[DonghuaStream] Fetching player page: ${targetUrl}`);
    const streams = [];

    try {
        const pageHtml = await fetch(targetUrl, { headers: HEADERS }).then(r => r.text());
        
        // Find option elements which contain base64 encoded iframe tags
        const optionRegex = /<option\s+[^>]*value=["'](PG[a-zA-Z0-9+/=]+)["'][^>]*>([\s\S]*?)<\/option>/gi;
        let match;
        let foundOptions = 0;

        while ((match = optionRegex.exec(pageHtml)) !== null) {
            const b64Data = match[1];
            const label = match[2].trim().replace(/\s+/g, ' ');
            
            try {
                const decodedHtml = Buffer.from(b64Data, 'base64').toString('utf8');
                const iframeMatch = decodedHtml.match(/src=["']([^"']+)["']/i);
                
                if (iframeMatch) {
                    let embedUrl = iframeMatch[1];
                    if (embedUrl.startsWith("//")) {
                        embedUrl = "https:" + embedUrl;
                    }
                    
                    let quality = "720p";
                    if (label.toLowerCase().includes("4k") || label.toLowerCase().includes("2160p")) {
                        quality = "2160p";
                    } else if (label.toLowerCase().includes("1080p") || label.toLowerCase().includes("fhd")) {
                        quality = "1080p";
                    } else if (label.toLowerCase().includes("720p") || label.toLowerCase().includes("hd")) {
                        quality = "720p";
                    }

                    streams.push({
                        name: "DonghuaStream",
                        title: label || "Mirror",
                        url: embedUrl,
                        quality: quality,
                        headers: {
                            "Referer": BASE_URL
                        }
                    });
                    
                    foundOptions++;
                }
            } catch (err) {
                console.log(`[DonghuaStream] Failed to decode base64 stream option: ${err.message}`);
            }
        }

        // If no base64 options found, try direct iframes on the page
        if (streams.length === 0) {
            console.log("[DonghuaStream] No Base64 options found. Trying direct iframes...");
            const iframeRegex = /<iframe[^>]*src=["']([^"']+)["']/gi;
            while ((match = iframeRegex.exec(pageHtml)) !== null) {
                let embedUrl = match[1];
                if (embedUrl.includes("youtube") || embedUrl.includes("ads") || embedUrl.includes("saroadexchange")) {
                    continue;
                }
                if (embedUrl.startsWith("//")) embedUrl = "https:" + embedUrl;
                
                streams.push({
                    name: "DonghuaStream",
                    title: "Direct Embed",
                    url: embedUrl,
                    quality: "720p",
                    headers: {
                        "Referer": BASE_URL
                    }
                });
            }
        }

        console.log(`[DonghuaStream] Resolved ${streams.length} streams successfully.`);
        return streams;

    } catch (e) {
        console.log(`[DonghuaStream] Error resolving streams: ${e.message}`);
        return [];
    }
}

module.exports = { getStreams };
