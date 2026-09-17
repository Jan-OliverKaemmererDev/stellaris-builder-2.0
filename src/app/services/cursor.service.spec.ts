import { TestBed } from '@angular/core/testing';
import { CursorService } from './cursor.service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('CursorService', () => {
  let service: CursorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CursorService],
    });
    service = TestBed.inject(CursorService);
    document.body.removeAttribute('data-active-cursor');
  });

  afterEach(() => {
    service.clearCompletionCursor();
    vi.useRealTimers();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getCategoryForSkill', () => {
    it('should map ships to fleet', () => {
      expect(service.getCategoryForSkill('leichter_jaeger')).toBe('fleet');
      expect(service.getCategoryForSkill('kolonisierungsschiffe')).toBe('fleet');
      expect(service.getCategoryForSkill('kreuzer')).toBe('fleet');
    });

    it('should map energy buildings and upgrades to energy', () => {
      expect(service.getCategoryForSkill('solar')).toBe('energy');
      expect(service.getCategoryForSkill('solar_erweiterte_panele')).toBe('energy');
      expect(service.getCategoryForSkill('fusion')).toBe('energy');
      expect(service.getCategoryForSkill('antimaterie_positronen')).toBe('energy');
    });

    it('should map mining buildings and upgrades to mining', () => {
      expect(service.getCategoryForSkill('eisenmine')).toBe('mining');
      expect(service.getCategoryForSkill('silbermine_roboter')).toBe('mining');
      expect(service.getCategoryForSkill('goldmine_zug')).toBe('mining');
    });

    it('should map research items and upgrades to research', () => {
      expect(service.getCategoryForSkill('biolabor')).toBe('research');
      expect(service.getCategoryForSkill('bio_gen_sequenzierer')).toBe('research');
      expect(service.getCategoryForSkill('ki_automatisierung')).toBe('research');
      expect(service.getCategoryForSkill('nano_bots')).toBe('research');
      expect(service.getCategoryForSkill('antriebstechnik')).toBe('research');
    });

    it('should map infrastructure items to infrastructure', () => {
      expect(service.getCategoryForSkill('lager')).toBe('infrastructure');
      expect(service.getCategoryForSkill('refinery')).toBe('infrastructure');
      expect(service.getCategoryForSkill('orbital_shipyard')).toBe('infrastructure');
      expect(service.getCategoryForSkill('planetary_defense')).toBe('infrastructure');
      expect(service.getCategoryForSkill('large_station')).toBe('infrastructure');
    });

    it('should map trade items to trade', () => {
      expect(service.getCategoryForSkill('trading_post')).toBe('trade');
      expect(service.getCategoryForSkill('interstellar_market')).toBe('trade');
      expect(service.getCategoryForSkill('galactic_exchange')).toBe('trade');
      expect(service.getCategoryForSkill('trade_lokale_gilden')).toBe('trade');
    });

    it('should return null for unknown ids', () => {
      expect(service.getCategoryForSkill('unknown_thing')).toBeNull();
    });
  });

  describe('triggerCompletionCursor', () => {
    it('should set active cursor signal and body attribute for 2 seconds', () => {
      vi.useFakeTimers();

      service.triggerCompletionCursor('energy', 2000);
      expect(service.activeCursor()).toBe('energy');
      expect(document.body.getAttribute('data-active-cursor')).toBe('energy');

      vi.advanceTimersByTime(1999);
      expect(service.activeCursor()).toBe('energy');
      expect(document.body.getAttribute('data-active-cursor')).toBe('energy');

      vi.advanceTimersByTime(1);
      expect(service.activeCursor()).toBeNull();
      expect(document.body.getAttribute('data-active-cursor')).toBeNull();
    });

    it('should reset timer when triggered multiple times', () => {
      vi.useFakeTimers();

      service.triggerCompletionCursor('energy', 2000);
      vi.advanceTimersByTime(1000);

      // Second trigger overrides before first expires
      service.triggerCompletionCursor('mining', 2000);
      expect(service.activeCursor()).toBe('mining');
      expect(document.body.getAttribute('data-active-cursor')).toBe('mining');

      // Advance by 1500 (2500 from start): would have expired if not reset
      vi.advanceTimersByTime(1500);
      expect(service.activeCursor()).toBe('mining');

      // Advance remaining 500ms
      vi.advanceTimersByTime(500);
      expect(service.activeCursor()).toBeNull();
    });

    it('should clear cursor immediately with clearCompletionCursor', () => {
      service.triggerCompletionCursor('fleet');
      expect(service.activeCursor()).toBe('fleet');
      expect(document.body.getAttribute('data-active-cursor')).toBe('fleet');

      service.clearCompletionCursor();
      expect(service.activeCursor()).toBeNull();
      expect(document.body.getAttribute('data-active-cursor')).toBeNull();
    });
  });
});
