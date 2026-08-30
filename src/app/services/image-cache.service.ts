import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Service responsible for registering the Image Cache Service Worker
 * and pre-warming/caching game assets in the browser's CacheStorage.
 */
@Injectable({
  providedIn: 'root',
})
export class ImageCacheService {
  private readonly platformId = inject(PLATFORM_ID);
  private isInitialized = false;

  /** Cache name matching the Service Worker */
  private readonly CACHE_NAME = 'stellaris-images-v1';

  /**
   * Common game image assets to pre-warm in the background during idle time.
   */
  private readonly PRELOAD_ASSETS: string[] = [
    // Branding & Icons
    'assets/logo.png',
    'assets/icons/close.png',
    'assets/icons/lock.png',
    'assets/icons/legal-notice.png',
    'assets/icons/logout.png',

    // Mining
    'assets/img/mining/metallmine.png',
    'assets/img/mining/roboter-arbeiter.png',
    'assets/img/mining/transportlaster.png',
    'assets/img/mining/ki-automation.png',
    'assets/img/mining/hochgeschwindigkeitszug.png',

    // Energy
    'assets/img/energy/solarkraftwerk.png',
    'assets/img/energy/erweiterte-panele.png',
    'assets/img/energy/orbitalspiegel.png',
    'assets/img/energy/thermische-speicher.png',
    'assets/img/energy/dyson-schwarm-prototyp.png',
    'assets/img/energy/fusionsreaktoren.png',
    'assets/img/energy/plasma-eindaemmung.png',
    'assets/img/energy/laser-katalysator.png',
    'assets/img/energy/deuterium-anreicherung.png',
    'assets/img/energy/kaltfusions-matrix.png',
    'assets/img/energy/antimaterie-reaktor.png',
    'assets/img/energy/positronen-sammler.png',
    'assets/img/energy/antimaterie-magnetfelder.png',
    'assets/img/energy/subraumkuehlung.png',
    'assets/img/energy/nullpunkt-siphon.png',

    // Infrastructure
    'assets/img/infrastructure/central-warehouse.png',
    'assets/img/infrastructure/extended-loading-bay.png',
    'assets/img/infrastructure/automated-logistics.png',
    'assets/img/infrastructure/quantum-memory.png',
    'assets/img/infrastructure/subspace-compression.png',
    'assets/img/infrastructure/refinery.png',
    'assets/img/infrastructure/thermalschmelze.png',
    'assets/img/infrastructure/katalytische-konverter.png',
    'assets/img/infrastructure/plasma-extraktion.png',
    'assets/img/infrastructure/naniten-fabrikation.png',
    'assets/img/infrastructure/orbital-shipyard.png',
    'assets/img/infrastructure/modulare-werftdocks.png',
    'assets/img/infrastructure/montage-drohnen.png',
    'assets/img/infrastructure/ki-konstruktion.png',
    'assets/img/infrastructure/antimaterie-anreicherung.png',
    'assets/img/infrastructure/large-station.png',
    'assets/img/infrastructure/kommerz-hub.png',
    'assets/img/infrastructure/hydroponische-gaerten.png',
    'assets/img/infrastructure/orbitaler-verteidigungsring.png',
    'assets/img/infrastructure/planetary-defense.jpg',
    'assets/img/infrastructure/schildgeneratoren.png',
    'assets/img/infrastructure/verstaerkte-huelle.png',
    'assets/img/infrastructure/plasmakanonen.png',
    'assets/img/infrastructure/orbitale-railguns.png',
    'assets/img/infrastructure/tachyonen-lanzen.png',

    // Research
    'assets/img/research/bio-forschungslabor.png',
    'assets/img/research/gen-sequenzierer.png',
    'assets/img/research/hydroponik-experimente.png',
    'assets/img/research/zellulaere-regeneration.png',
    'assets/img/research/klon-vat-technologie.png',
    'assets/img/research/ki-automatisierung.png',
    'assets/img/research/neuronale-netze.png',
    'assets/img/research/quanten-prozessoren.png',
    'assets/img/research/selbstlernende-algorithmen.png',
    'assets/img/research/bewusstseins-emulation.png',
    'assets/img/research/nano-bots.png',
    'assets/img/research/nano-krabbler.png',
    'assets/img/research/laser-schweisser.png',
    'assets/img/research/autonome-reparatur.png',
    'assets/img/research/nano-replikator.png',
    'assets/img/research/antriebstechnik.png',
    'assets/img/research/ionen-triebwerke.png',
    'assets/img/research/plasma-beschleuniger.png',
    'assets/img/research/hyperraum-kern.png',
    'assets/img/research/sprungtor-matrix.png',

    // Trade
    'assets/img/trade/trading-post.png',
    'assets/img/trade/lokale-haendlergilden.png',
    'assets/img/trade/frachtdrohnen.png',
    'assets/img/trade/schwarzmarkt-zugang.png',
    'assets/img/trade/planetarer-zoll.png',
    'assets/img/trade/interstellar-market.png',
    'assets/img/trade/routen-kartographierung.png',
    'assets/img/trade/subraum-kommunikation.png',
    'assets/img/trade/soeldner-geleitschutz.png',
    'assets/img/trade/interstellare-banken.png',
    'assets/img/trade/galactic-exchange.png',
    'assets/img/trade/hochfrequenz-trading.png',
    'assets/img/trade/megakonzern-partnerschaften.png',
    'assets/img/trade/monopol-lizenzen.png',
    'assets/img/trade/galaktisches-waehrungsamt.png',

    // Fleet
    'assets/img/fleet/light_fighter.jpg',
    'assets/img/fleet/heavy_fighter.jpg',
    'assets/img/fleet/destroyer.jpg',
    'assets/img/fleet/cruiser.jpg',
    'assets/img/fleet/mining-ship.png',
    'assets/img/fleet/transportschiffe.png',
    'assets/img/fleet/kolonisierungsschiffe.png',
    'assets/img/fleet/logistikschiff.png',
    'assets/img/fleet/asteroid-belt.png',
  ];

  /**
   * Initializes the Service Worker and starts background image pre-caching.
   */
  public init(): void {
    if (this.isInitialized || !isPlatformBrowser(this.platformId)) {
      return;
    }
    this.isInitialized = true;

    this.registerServiceWorker();
    this.schedulePreloading();
  }

  /**
   * Registers the Service Worker (`/sw.js`).
   */
  private registerServiceWorker(): void {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((registration) => {
            console.log('[ImageCacheService] Service Worker registered successfully (scope: ' + registration.scope + ')');
          })
          .catch((err) => {
            console.warn('[ImageCacheService] Service Worker registration failed:', err);
          });
      });
    }
  }

  /**
   * Schedules pre-loading of game images during browser idle time.
   */
  private schedulePreloading(): void {
    const idleCallback =
      (window as any).requestIdleCallback ||
      ((cb: () => void) => setTimeout(cb, 1000));

    idleCallback(() => {
      this.preloadImages(this.PRELOAD_ASSETS);
    });
  }

  /**
   * Preloads an array of image URLs and ensures they are in Cache Storage.
   */
  public async preloadImages(urls: string[]): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Direct CacheStorage warm-up if supported
    if ('caches' in window) {
      try {
        const cache = await caches.open(this.CACHE_NAME);
        for (const url of urls) {
          const match = await cache.match(url);
          if (!match) {
            fetch(url, { mode: 'no-cors' })
              .then((response) => {
                if (response.ok || response.type === 'opaque') {
                  cache.put(url, response);
                }
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        console.debug('[ImageCacheService] Cache pre-warm skipped:', err);
      }
    } else {
      // Fallback: browser in-memory image preloading
      urls.forEach((url) => {
        const img = new Image();
        img.src = url;
      });
    }
  }

  /**
   * Clears the image cache.
   */
  public async clearCache(): Promise<boolean> {
    if (isPlatformBrowser(this.platformId) && 'caches' in window) {
      return caches.delete(this.CACHE_NAME);
    }
    return false;
  }
}
