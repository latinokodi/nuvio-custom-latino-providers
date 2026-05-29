const path = require("path");

// Diverse test cases covering different genres
const TEST_CASES = {
    movie: [
        { id: "1022789", title: "Inside Out 2 (Del revés 2)", season: null, episode: null },
        { id: "912649", title: "Gladiator II", season: null, episode: null },
        { id: "634649", title: "Spider-Man: No Way Home", season: null, episode: null }
    ],
    tv: [
        { id: "119051", title: "Wednesday (Miércoles)", season: 1, episode: 1 },
        { id: "94997", title: "House of the Dragon (La casa del dragón)", season: 1, episode: 1 }
    ],
    documentary: [
        { id: "35354", title: "El hombre y la Tierra", season: 1, episode: 1 },
        { id: "11105", title: "Forensic Files (Crímenes imperfectos)", season: 1, episode: 1 },
        { id: "516258", title: "Free Solo", season: null, episode: null }
    ],
    christian: [
        { id: "87108", title: "The Chosen (Los Elegidos)", season: 1, episode: 1 }
    ]
};

// Config for each provider specifying which test categories to run
const PROVIDERS = {
    // Ported from Balandro
    "ciberdocumentales": { path: "../providers/ciberdocumentales.js", categories: ["documentary"] },
    "cinehindi": { path: "../providers/cinehindi.js", categories: ["movie"] },
    "creyente": { path: "../providers/creyente.js", categories: ["christian", "movie"] },
    "documentaleson": { path: "../providers/documentaleson.js", categories: ["documentary"] },
    "documentalesonline": { path: "../providers/documentalesonline.js", categories: ["documentary"] },
    "mundodesconocido": { path: "../providers/mundodesconocido.js", categories: ["documentary"] },
    "retrocinema": { path: "../providers/retrocinema.js", categories: ["movie"] },
    "todocineclasico": { path: "../providers/todocineclasico.js", categories: ["movie"] },
    "verpelis": { path: "../providers/verpelis.js", categories: ["movie", "tv"] },
    "retrotv": { path: "../providers/retrotv.js", categories: ["movie", "tv"] },

    // Existing from Luvio
    "areshd": { path: "../providers/areshd.js", categories: ["movie", "tv"] },
    "cinemitas": { path: "../providers/cinemitas.js", categories: ["movie", "tv"] },
    "detodopeliculas": { path: "../providers/detodopeliculas.js", categories: ["movie", "tv"] },
    "gnula": { path: "../providers/gnula.js", categories: ["movie", "tv"] },
    "seriesflix": { path: "../providers/seriesflix.js", categories: ["tv"] },
    "seriesgato": { path: "../providers/seriesgato.js", categories: ["tv"] },
    "seriespapaya": { path: "../providers/seriespapaya.js", categories: ["tv"] },
    "seriesretro": { path: "../providers/seriesretro.js", categories: ["tv"] },
    "vitaminagg": { path: "../providers/vitaminagg.js", categories: ["movie", "tv"] },
    "zonaleros": { path: "../providers/zonaleros.js", categories: ["movie", "tv"] }
};

async function runTest(providerId) {
    const providerInfo = PROVIDERS[providerId];
    if (!providerInfo) {
        console.error(`Provider not found: ${providerId}`);
        process.exit(1);
    }

    console.log(`\n==================================================`);
    console.log(`TESTING PROVIDER: ${providerId}`);
    console.log(`==================================================`);

    let modulePath = path.resolve(__dirname, providerInfo.path);
    let provider;
    try {
        provider = require(modulePath);
    } catch (e) {
        console.error(`[-] Failed to load module ${providerId}:`, e.message);
        return { status: "LOAD_FAILED", error: e.message };
    }

    if (typeof provider.getStreams !== "function") {
        console.error(`[-] getStreams is not a function in ${providerId}`);
        return { status: "INVALID_EXPORT" };
    }

    // Determine what cases to run based on configured categories
    let cases = [];
    providerInfo.categories.forEach(cat => {
        if (TEST_CASES[cat]) {
            cases.push(...TEST_CASES[cat]);
        }
    });

    let successCount = 0;
    let totalCount = cases.length;
    let results = [];

    for (const c of cases) {
        console.log(`\n[*] Testing case: "${c.title}" (TMDB ID: ${c.id}, Season: ${c.season}, Episode: ${c.episode})`);
        
        let type = c.season ? "tv" : "movie";
        try {
            const streams = await provider.getStreams(c.id, type, c.season, c.episode);
            console.log(`[+] Success. Found ${streams.length} streams:`);
            streams.forEach((s, idx) => {
                console.log(`    ${idx + 1}. [${s.quality}] ${s.title} -> ${s.url.substring(0, 100)}${s.url.length > 100 ? "..." : ""}`);
            });
            results.push({ case: c.title, success: true, streamsCount: streams.length });
            if (streams.length > 0) successCount++;
        } catch (e) {
            console.error(`[-] Error running getStreams:`, e.message);
            results.push({ case: c.title, success: false, error: e.message });
        }
    }

    console.log(`\n--------------------------------------------------`);
    console.log(`RESULT FOR ${providerId}: ${successCount}/${totalCount} cases returned streams`);
    console.log(`--------------------------------------------------`);

    return {
        providerId,
        successCount,
        totalCount,
        results
    };
}

async function run() {
    const args = process.argv.slice(2);
    if (args.length > 0) {
        const providerId = args[0];
        await runTest(providerId);
    } else {
        console.log("Running all tests...");
        const summary = [];
        for (const providerId of Object.keys(PROVIDERS)) {
            try {
                const res = await runTest(providerId);
                summary.push(res);
            } catch (e) {
                console.error(`Error testing ${providerId}:`, e.message);
            }
        }
        console.log("\n==================================================");
        console.log("OVERALL SUMMARY");
        console.log("==================================================");
        summary.forEach(s => {
            console.log(`${s.providerId.padEnd(20)}: ${s.successCount}/${s.totalCount} passed`);
        });
    }
}

run();
