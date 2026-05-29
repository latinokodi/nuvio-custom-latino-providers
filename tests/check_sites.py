import requests
import cloudscraper
import urllib3
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

candidates = {
    "areadocumental": "https://www.area-documental.com/",
    "ciberdocumentales": "https://www.ciberdocumentales.com",
    "cinehindi": "https://cinehindi.com/",
    "creyente": "https://creyente.digital/",
    "documentaleson": "https://documentaleson.com/",
    "documentalesonline": "https://www.documentales-online.com",
    "mundodesconocido": "https://www.mundodesconocido.es/",
    "retrocinema": "https://online.historiadelcine.es/",
    "todocineclasico": "https://leyendasdelcine.com/",
    "verpelis": "https://verpelis.gratis/",
    "cinedeantes": "https://cinedeantes2.weebly.com/",
    "asialive": "https://asialiveaction.com/",
    "cineplay": "https://peliplay.xyz/",
    "retroflix": "https://www.retroflix.club/",
    "retrotv": "https://retrotv.co/",
    "veronline": "https://veronline.news/",
    "vision": "https://visioncineytv.cc/"
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

scraper = cloudscraper.create_scraper()

for name, url in candidates.items():
    print(f"--- Checking {name} ({url}) ---")
    
    # 1. Standard request
    try:
        r = requests.get(url, headers=headers, timeout=10, verify=False)
        print(f"Standard requests: Status {r.status_code}")
        if r.status_code == 200:
            if "cloudflare" in r.text.lower() or "just a moment" in r.text.lower():
                print("Standard requests: Warning - Cloudflare challenge detected in HTML content!")
            else:
                print("Standard requests: SUCCESS (No CF detected)")
                continue
        elif r.status_code in (403, 503):
            print("Standard requests: Blocked (403/503)")
    except Exception as e:
        print(f"Standard requests: Error: {e}")
        
    # 2. Cloudscraper bypass
    try:
        r_cf = scraper.get(url, timeout=15)
        print(f"CloudScraper: Status {r_cf.status_code}")
        if r_cf.status_code == 200:
            if "cloudflare" in r_cf.text.lower() or "just a moment" in r_cf.text.lower():
                print("CloudScraper: Warning - Cloudflare challenge still present!")
            else:
                print("CloudScraper: SUCCESS (Bypassed CF successfully)")
        else:
            print("CloudScraper: Failed to bypass")
    except Exception as e:
        print(f"CloudScraper: Error: {e}")
