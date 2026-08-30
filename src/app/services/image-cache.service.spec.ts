import { TestBed } from '@angular/core/testing';
import { ImageCacheService } from './image-cache.service';

describe('ImageCacheService', () => {
  let service: ImageCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ImageCacheService],
    });
    service = TestBed.inject(ImageCacheService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize without throwing errors', () => {
    expect(() => service.init()).not.toThrow();
  });

  it('should handle preloading images', async () => {
    await expect(service.preloadImages(['assets/logo.png'])).resolves.not.toThrow();
  });
});
