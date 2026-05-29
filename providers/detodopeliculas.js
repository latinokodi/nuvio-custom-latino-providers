var V = Object.create;
var v = Object.defineProperty;
var F = Object.getOwnPropertyDescriptor;
var G = Object.getOwnPropertyNames, T = Object.getOwnPropertySymbols, H = Object.getPrototypeOf, b = Object.prototype.hasOwnProperty, q = Object.prototype.propertyIsEnumerable;
var L = (t, e, o) => e in t ? v(t, e, { enumerable: true, configurable: true, writable: true, value: o }) : t[e] = o, y = (t, e) => {
  for (var o in e || (e = {}))
    b.call(e, o) && L(t, o, e[o]);
  if (T)
    for (var o of T(e))
      q.call(e, o) && L(t, o, e[o]);
  return t;
};
var z = (t, e) => {
  for (var o in e)
    v(t, o, { get: e[o], enumerable: true });
}, k = (t, e, o, r) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let s of G(e))
      !b.call(t, s) && s !== o && v(t, s, { get: () => e[s], enumerable: !(r = F(e, s)) || r.enumerable });
  return t;
};
var j = (t, e, o) => (o = t != null ? V(H(t)) : {}, k(e || !t || !t.__esModule ? v(o, "default", { value: t, enumerable: true }) : o, t)), K = (t) => k(v({}, "__esModule", { value: true }), t);
var g = (t, e, o) => new Promise((r, s) => {
  var i = (c) => {
    try {
      l(o.next(c));
    } catch (n) {
      s(n);
    }
  }, a = (c) => {
    try {
      l(o.throw(c));
    } catch (n) {
      s(n);
    }
  }, l = (c) => c.done ? r(c.value) : Promise.resolve(c.value).then(i, a);
  l((o = o.apply(t, e)).next());
});
var pe = {};
z(pe, { getStreams: () => de });
module.exports = K(pe);
var Y = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
function J(t, e) {
  return t >= 3840 || e >= 2160 ? "4K" : t >= 1920 || e >= 1080 ? "1080p" : t >= 1280 || e >= 720 ? "720p" : t >= 854 || e >= 480 ? "480p" : "360p";
}
function E(o) {
  return g(this, arguments, function* (t, e = {}) {
    try {
      let s = yield (yield fetch(t, { headers: y({ "User-Agent": Y }, e), redirect: "follow" })).text();
      if (!s.includes("#EXT-X-STREAM-INF")) {
        let c = t.match(/[_-](\d{3,4})p/);
        return c ? `${c[1]}p` : "1080p";
      }
      let i = 0, a = 0, l = s.split(`
`);
      for (let c of l) {
        let n = c.match(/RESOLUTION=(\d+)x(\d+)/);
        if (n) {
          let u = parseInt(n[1]), f = parseInt(n[2]);
          f > a && (a = f, i = u);
        }
      }
      return a > 0 ? J(i, a) : "1080p";
    } catch (r) {
      return "1080p";
    }
  });
}
var Q = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
function U(t) {
  try {
    return typeof atob != "undefined" ? atob(t) : Buffer.from(t, "base64").toString("utf8");
  } catch (e) {
    return null;
  }
}
function X(t, e) {
  try {
    let r = e.replace(/^\[|\]$/g, "").split("','").map((n) => n.replace(/^'+|'+$/g, "")).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), s = "";
    for (let n of t) {
      let u = n.charCodeAt(0);
      u > 64 && u < 91 ? u = (u - 52) % 26 + 65 : u > 96 && u < 123 && (u = (u - 84) % 26 + 97), s += String.fromCharCode(u);
    }
    for (let n of r)
      s = s.replace(new RegExp(n, "g"), "_");
    s = s.split("_").join("");
    let i = U(s);
    if (!i)
      return null;
    let a = "";
    for (let n = 0; n < i.length; n++)
      a += String.fromCharCode((i.charCodeAt(n) - 3 + 256) % 256);
    let l = a.split("").reverse().join(""), c = U(l);
    return c ? JSON.parse(c) : null;
  } catch (o) {
    return console.log("[VOE] voeDecode error:", o.message), null;
  }
}
function S(o) {
  return g(this, arguments, function* (t, e = {}) {
    return yield fetch(t, { method: "GET", headers: y({ "User-Agent": Q, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }, e), redirect: "follow" });
  });
}
function P(t) {
  return g(this, null, function* () {
    try {
      console.log(`[VOE] Resolviendo: ${t}`);
      let e = yield S(t, { Referer: t });
      if (!e.ok)
        throw new Error(`HTTP ${e.status}`);
      let o = yield e.text();
      if (/permanentToken/i.test(o)) {
        let c = o.match(/window\.location\.href\s*=\s*'([^']+)'/i);
        if (c) {
          console.log(`[VOE] Permanent token redirect -> ${c[1]}`);
          let n = yield S(c[1], { Referer: t });
          n.ok && (o = yield n.text());
        }
      }
      let r = o.match(/json">\s*\[\s*['"]([^'"]+)['"]\s*\]\s*<\/script>\s*<script[^>]*src=['"]([^'"]+)['"]/i);
      if (r) {
        let c = r[1], n = r[2].startsWith("http") ? r[2] : new URL(r[2], t).href;
        console.log(`[VOE] Found encoded array + loader: ${n}`);
        let u = yield S(n, { Referer: t }), f = u.ok ? yield u.text() : "", d = f.match(/(\[(?:'[^']{1,10}'[\s,]*){4,12}\])/i) || f.match(/(\[(?:"[^"]{1,10}"[,\s]*){4,12}\])/i);
        if (d) {
          let p = X(c, d[1]);
          if (p && (p.source || p.direct_access_url)) {
            let h = p.source || p.direct_access_url, $ = yield E(h, { Referer: t });
            return console.log(`[VOE] URL encontrada: ${h.substring(0, 80)}...`), { url: h, quality: $, headers: { Referer: t } };
          }
        }
      }
      let s = /(?:mp4|hls)'\s*:\s*'([^']+)'/gi, i = /(?:mp4|hls)"\s*:\s*"([^"]+)"/gi, a = [], l;
      for (; (l = s.exec(o)) !== null; )
        a.push(l);
      for (; (l = i.exec(o)) !== null; )
        a.push(l);
      for (let c of a) {
        let n = c[1];
        if (!n)
          continue;
        let u = n;
        if (u.startsWith("aHR0"))
          try {
            u = atob(u);
          } catch (f) {
          }
        return console.log(`[VOE] URL encontrada (fallback): ${u.substring(0, 80)}...`), { url: u, quality: yield E(u, { Referer: t }), headers: { Referer: t } };
      }
      return console.log("[VOE] No se encontr\xF3 URL"), null;
    } catch (e) {
      return console.log(`[VOE] Error: ${e.message}`), null;
    }
  });
}
var C = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
function O(t) {
  return g(this, null, function* () {
    try {
      console.log(`[OkRu] Resolviendo: ${t}`);
      let e = yield fetch(t, { headers: { "User-Agent": C, Accept: "text/html", Referer: "https://ok.ru/" }, redirect: "follow" }).then((n) => n.text());
      if (e.includes("copyrightsRestricted") || e.includes("COPYRIGHTS_RESTRICTED") || e.includes("LIMITED_ACCESS") || e.includes("notFound") || !e.includes("urls"))
        return console.log("[OkRu] Video no disponible o eliminado"), null;
      let r = [...e.replace(/\\&quot;/g, '"').replace(/\\u0026/g, "&").replace(/\\/g, "").matchAll(/"name":"([^"]+)","url":"([^"]+)"/g)], s = ["full", "hd", "sd", "low", "lowest"], i = r.map((n) => ({ type: n[1], url: n[2] })).filter((n) => !n.type.toLowerCase().includes("mobile") && n.url.startsWith("http"));
      if (i.length === 0)
        return console.log("[OkRu] No se encontraron URLs"), null;
      let l = i.sort((n, u) => {
        let f = s.findIndex((p) => n.type.toLowerCase().includes(p)), d = s.findIndex((p) => u.type.toLowerCase().includes(p));
        return (f === -1 ? 99 : f) - (d === -1 ? 99 : d);
      })[0];
      console.log(`[OkRu] URL encontrada (${l.type}): ${l.url.substring(0, 80)}...`);
      let c = { full: "1080p", hd: "720p", sd: "480p", low: "360p", lowest: "240p" };
      return { url: l.url, quality: c[l.type] || l.type, headers: { "User-Agent": C, Referer: "https://ok.ru/" } };
    } catch (e) {
      return console.log(`[OkRu] Error: ${e.message}`), null;
    }
  });
}
var m = j(require("crypto-js"));
var R = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36", D = m.default.enc.Hex.parse("6b69656d7469656e6d75613931316361"), _ = m.default.enc.Hex.parse("313233343536373839306f6975797472");
function Z(t) {
  return m.default.AES.encrypt(JSON.stringify(t), D, { iv: _, mode: m.default.mode.CBC, padding: m.default.pad.Pkcs7 }).ciphertext.toString(m.default.enc.Hex);
}
function ee(t) {
  let e = m.default.lib.CipherParams.create({ ciphertext: m.default.enc.Hex.parse(t) }), o = m.default.AES.decrypt(e, D, { iv: _, mode: m.default.mode.CBC, padding: m.default.pad.Pkcs7 });
  return JSON.parse(o.toString(m.default.enc.Utf8));
}
function I(t) {
  return g(this, null, function* () {
    try {
      let e = t.includes("/") ? t.split("/").pop().replace("#", "") : t, o = "https://gdtvid.p2pplay.pro";
      console.log(`[Gdtvid] Resolviendo: ${e}`);
      let s = (yield fetch(`${o}/api/v1/info?id=${e}`, { headers: { "User-Agent": R, Referer: "https://gdtvid.p2pplay.pro/" } })).headers.get("set-cookie"), i = { sessionId: "p2pplay_test_session", userId: "null", playerId: "jw8", videoId: e, country: "US", platform: "web", browser: "chrome", os: "windows", timestamp: Date.now() }, a = Z(i);
      yield fetch(`${o}/api/v1/player?t=${a}`, { headers: { "User-Agent": R, Referer: "https://gdtvid.p2pplay.pro/", Cookie: s || "" } });
      let c = yield (yield fetch(`${o}/api/v1/video?id=${e}&w=1536&h=864&r=null`, { headers: { "User-Agent": R, Referer: "https://gdtvid.p2pplay.pro/", Cookie: s || "" } })).text(), n = ee(c.trim());
      if (!n.source)
        throw new Error("No se encontr\xF3 el campo source en la respuesta");
      return console.log(`[Gdtvid] URL encontrada: ${n.source.substring(0, 80)}...`), { url: n.source, headers: { "User-Agent": R, Referer: "https://gdtvid.p2pplay.pro/" } };
    } catch (e) {
      return console.log(`[Gdtvid] Error: ${e.message}`), null;
    }
  });
}
var te = "439c478a771f35c05022f9feabcca01c", B = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", W = { "User-Agent": B, Accept: "text/html,application/json" }, oe = "https://detodopeliculas.nu", ne = { "voe.sx": P, "ok.ru": O, gdtvid: I }, se = { "voe.sx": "VOE", "ok.ru": "OkRu", gdtvid: "GDTvid" }, re = ["LAT", "ESP", "SUB"], A = { LAT: "Latino", ESP: "Castellano", SUB: "Subtitulado" };
function x(o) {
  return g(this, arguments, function* (t, e = {}) {
    let r = yield fetch(t, { headers: y(y({}, W), e.headers), method: e.method || "GET", redirect: "follow" });
    if (!r.ok)
      throw new Error(`HTTP ${r.status}`);
    return (r.headers.get("content-type") || "").includes("json") ? r.json() : r.text();
  });
}
function M(t, e = null) {
  let o = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return e ? `${o}-${e}` : o;
}
function ce(t) {
  for (let [e, o] of Object.entries(ne))
    if (t.includes(e))
      return { resolver: o, serverName: se[e] || "Online" };
  return { resolver: null, serverName: "Desconocido" };
}
function le(t, e) {
  return g(this, null, function* () {
    let o = [{ lang: "es-MX" }, { lang: "es-ES" }, { lang: "en-US" }], r = /* @__PURE__ */ new Set(), s = "";
    for (let { lang: i } of o)
      try {
        let a = yield x(`https://api.themoviedb.org/3/${e}/${t}?api_key=${te}&language=${i}`), l = e === "movie" ? a.title : a.name, c = e === "movie" ? a.original_title : a.original_name;
        s || (s = (a.release_date || a.first_air_date || "").substring(0, 4)), l && !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(l) && r.add(l), c && r.add(c);
      } catch (a) {
      }
    return r.size > 0 ? { titles: Array.from(r), year: s } : null;
  });
}
function ae(t, e) {
  return g(this, null, function* () {
    let o = e === "movie" ? "pelicula" : "serie", r = /* @__PURE__ */ new Set();
    for (let s of t.titles)
      r.add(M(s, t.year)), r.add(M(s));
    for (let s of r) {
      let i = `${oe}/${o}/${s}/`;
      try {
        if ((yield fetch(i, { headers: W, redirect: "follow" })).ok)
          return console.log(`[DeTodoPeliculas] \u2713 P\xE1gina encontrada: ${i}`), i;
      } catch (a) {
        continue;
      }
    }
    return null;
  });
}
function ie(t, e, o) {
  return g(this, null, function* () {
    try {
      let s = (yield x(`${t}?ep_season=${e}`)).split(/<article|<li|<div class=["']episodios/i);
      for (let i of s)
        if (i.includes(`>${e} - ${o}<`) || i.includes(`>${e}x${o}<`)) {
          let a = i.match(/href=["'](https:\/\/detodopeliculas\.nu\/episodio\/[^"']+)["']/i);
          if (a)
            return a[1];
        }
    } catch (r) {
      return null;
    }
    return null;
  });
}
function ue(t) {
  return g(this, null, function* () {
    let e = yield x(t), o = /* @__PURE__ */ new Map(), r = e.split(/id=["']player-option-/i);
    for (let l = 1; l < r.length; l++) {
      let c = r[l], n = c.match(/^([a-z0-9-]+)/i), u = c.match(/^[^>]*>([\s\S]*?)<\/li>/i);
      if (!n || !u)
        continue;
      let f = n[1];
      if (f === "trailer")
        continue;
      let d = u[1].toLowerCase(), p = "SUB";
      d.includes("lat.png") || d.includes("latino") || d.includes("mx.png") ? p = "LAT" : d.includes("es.png") || d.includes("cas.png") || d.includes("castellano") || d.includes("espa\xF1ol") ? p = "ESP" : (d.includes("sub.png") || d.includes("vose") || d.includes("subtitulado")) && (p = "SUB"), o.set(f, p);
    }
    let s = { LAT: [], ESP: [], SUB: [] }, i = /* @__PURE__ */ new Set(), a = e.split(/id=["']source-player-/i);
    for (let l = 1; l < a.length; l++) {
      let c = a[l], n = c.match(/^([a-z0-9-]+)/i);
      if (!n)
        continue;
      let u = n[1];
      if (u === "trailer")
        continue;
      let f = c.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (!f)
        continue;
      let d = f[1];
      if (!(d.includes("youtube.com") || d.includes("googletagmanager") || !d.startsWith("http")) && !i.has(d)) {
        i.add(d);
        let p = o.get(u) || "LAT";
        s[p].push(d);
      }
    }
    if (s.LAT.length === 0 && s.ESP.length === 0 && s.SUB.length === 0) {
      let l = [...e.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)];
      for (let c of l) {
        let n = c[1];
        n.includes("youtube.com") || n.includes("googletagmanager") || !n.startsWith("http") || i.has(n) || (i.add(n), s.LAT.push(n));
      }
    }
    return s;
  });
}
function de(t, e, o, r) {
  return g(this, null, function* () {
    if (!t || !e)
      return [];
    let s = Date.now();
    console.log(`[DeTodoPeliculas] Buscando: TMDB ${t} (${e})${o ? ` S${o}E${r}` : ""}`);
    try {
      let i = yield le(t, e);
      if (!i)
        return [];
      let a = yield ae(i, e);
      if (!a)
        return [];
      let l = a;
      if (e === "tv" && o && r && (l = yield ie(a, o, r), !l))
        return [];
      let c = yield ue(l);
      for (let n of re) {
        let u = c[n];
        if (!u || u.length === 0)
          continue;
        console.log(`[DeTodoPeliculas] Resolviendo ${u.length} embeds en ${A[n]}...`);
        let f = u.map((h) => g(this, null, function* () {
          let { resolver: $, serverName: N } = ce(h);
          if (!$)
            return console.log(`[DeTodoPeliculas] \u26A0\uFE0F Falta resolver para: ${h}`), null;
          try {
            let w = yield $(h);
            return w ? { name: "DeTodoPeliculas", title: `${w.quality || "1080p"} \xB7 ${A[n]} \xB7 ${N}`, url: w.url, quality: w.quality || "1080p", headers: w.headers || { "User-Agent": B, Referer: l } } : null;
          } catch (w) {
            return null;
          }
        })), p = (yield Promise.allSettled(f)).filter((h) => h.status === "fulfilled" && h.value !== null).map((h) => h.value);
        if (p.length > 0) {
          let h = ((Date.now() - s) / 1e3).toFixed(2);
          return console.log(`[DeTodoPeliculas] \u2713 ${p.length} streams encontrados en ${A[n]} (${h}s), omitiendo otros idiomas.`), p;
        } else
          console.log(`[DeTodoPeliculas] Sin streams exitosos en ${A[n]}, intentando siguiente idioma...`);
      }
      return console.log("[DeTodoPeliculas] Agotada la b\xFAsqueda en todos los idiomas sin \xE9xito."), [];
    } catch (i) {
      return console.log(`[DeTodoPeliculas] Error Cr\xEDtico: ${i.message}`), [];
    }
  });
}
