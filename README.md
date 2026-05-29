# Nuvio Custom Latino Providers

Este repositorio contiene una colección de scrapers/proveedores personalizados para la aplicación **Nuvio**, optimizados para Español Latino y Castellano. Incluye proveedores de documentales, cine clásico, contenido familiar y películas de estreno libres de protecciones.

## 🚀 URL de Instalación (Manifest)

Para agregar estos proveedores a tu aplicación Nuvio, ve a **Configuración ⚙️ -> Proveedores -> Importar Manifest / Agregar Repositorio** y pega la siguiente URL:

```text
https://raw.githubusercontent.com/latinokodi/nuvio-custom-latino-providers/main/manifest.json
```

---

## 📦 Proveedores Incluidos (20 Scrapers)

### 1. Copiados y Optimizados de Luvio (10)
*   **AresHD** (`areshd.js`): Películas y series en alta definición.
*   **Cinemitas** (`cinemitas.js`): Estrenos y series en audio latino.
*   **Detodopeliculas** (`detodopeliculas.js`): Catálogo general de cine.
*   **Gnula** (`gnula.js`): Películas y series clásicas e independientes.
*   **Seriesflix** (`seriesflix.js`): Series y novelas.
*   **SeriesGato** (`seriesgato.js`): Series actualizadas con audio dual.
*   **SeriesPapaya** (`seriespapaya.js`): Clásicos y estrenos de televisión.
*   **SeriesRetro** (`seriesretro.js`): Series clásicas de los 80s/90s.
*   **VitaminagG** (`vitaminagg.js`): Películas y series animadas.
*   **ZonaLeros** (`zonaleros.js`): Estrenos HD en audio latino.

### 2. Portados desde Balandro (10)
*   **CiberDocumentales** (`ciberdocumentales.js`): Documentales en castellano.
*   **CineHindi** (`cinehindi.js`): Películas de la India dobladas al español.
*   **Creyente** (`creyente.js`): Cine y series de temática familiar y bíblica.
*   **DocumentalesOn** (`documentaleson.js`): Amplio catálogo documental clasificado.
*   **DocumentalesOnline** (`documentalesonline.js`): Documentales y series de temas reales.
*   **MundoDesconocido** (`mundodesconocido.js`): Videoprogramas de ciencia y misterio.
*   **RetroCinema** (`retrocinema.js`): Películas clásicas del cine de oro.
*   **TodoCineClasico** (`todocineclasico.js`): Cine clásico selecto.
*   **VerPelis** (`verpelis.js`): Películas y series populares actuales en latino.
*   **RetroTV** (`retrotv.js`): Series retro y vintage de televisión.

---

## 🛠️ Notas de Desarrollo y Pruebas
El repositorio incluye una carpeta `tests/` con un entorno aislado donde se validan los scrapers haciendo peticiones reales a los servidores de origen.

*   Todos los scrapers están compilados para ser compatibles con el motor JS **Hermes** de Nuvio.
*   No contienen dependencias externas pesadas y corren directamente en dispositivos móviles y Smart TVs.
