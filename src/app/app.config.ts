import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer, inject } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment } from '../environments/environment';
import { ImageCacheService } from './services/image-cache.service';

/**
 * Application-wide configuration providing routing, Firebase initialization,
 * authentication, Firestore database access, and browser image caching.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideAppInitializer(() => {
      const imageCacheService = inject(ImageCacheService);
      imageCacheService.init();
    }),
  ],
};
