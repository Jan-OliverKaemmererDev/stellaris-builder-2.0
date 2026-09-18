import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TutorialOverlayComponent } from './tutorial-overlay.component';
import { AudioService } from '../../services/audio.service';
import { GameStateService } from '../../services/game-state.service';
import { vi } from 'vitest';

describe('TutorialOverlayComponent', () => {
  let component: TutorialOverlayComponent;
  let fixture: ComponentFixture<TutorialOverlayComponent>;

  const mockAudioService = {
    playUiClick: vi.fn(),
    playHologramTransfer: vi.fn(),
    isAiSpeaking: vi.fn().mockReturnValue(false),
    getAiSpeechAmplitude: vi.fn().mockReturnValue(0),
  };

  const mockGameStateService = {
    hasCompletedTutorial: signal(false),
    aiFaceMaterializing: signal(false),
    triggerAiMaterialize: vi.fn(),
    markTutorialAsCompleted: vi.fn(),
    resetTutorial: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TutorialOverlayComponent],
      providers: [
        { provide: AudioService, useValue: mockAudioService },
        { provide: GameStateService, useValue: mockGameStateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TutorialOverlayComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create and initialize on step 0', () => {
    expect(component).toBeTruthy();
    expect(component.currentStepIndex()).toBe(0);
    expect(component.isSkipped()).toBe(false);
    expect(component.currentStep().id).toBe('welcome');
  });

  it('should advance to next step when nextStep is called', () => {
    // Finish initial typewriter text
    component.onDialogClick();
    expect(component.isTyping()).toBe(false);

    const highlightSpy = vi.spyOn(component.highlightChange, 'emit');
    component.nextStep();

    expect(component.currentStepIndex()).toBe(1);
    expect(component.currentStep().id).toBe('resources');
    expect(highlightSpy).toHaveBeenCalledWith('resources');
  });

  it('should navigate back to previous step when prevStep is called', () => {
    component.startStep(2);
    expect(component.currentStepIndex()).toBe(2);

    component.prevStep();
    expect(component.currentStepIndex()).toBe(1);
  });

  it('should enter skip mode with guidance text when skipTutorial is called', () => {
    const highlightSpy = vi.spyOn(component.highlightChange, 'emit');
    component.skipTutorial();

    expect(component.isSkipped()).toBe(true);
    expect(highlightSpy).toHaveBeenCalledWith(null);
  });

  it('should emit completed event when finishTutorial is called', () => {
    const completedSpy = vi.spyOn(component.completed, 'emit');
    component.finishTutorial();

    expect(completedSpy).toHaveBeenCalled();
  });

  it('should trigger particle flight and hologram transfer audio when header target exists', () => {
    const mockHeader = document.createElement('div');
    mockHeader.className = 'desktop-ai-hologram';
    document.body.appendChild(mockHeader);

    const canvas = fixture.nativeElement.querySelector('.tutorial-particle-canvas');
    if (canvas) {
      canvas.getContext = vi.fn().mockReturnValue({
        scale: vi.fn(),
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
      });
    }

    component.finishTutorial();

    expect(component.isCompleting()).toBe(true);
    expect(mockAudioService.playHologramTransfer).toHaveBeenCalled();

    document.body.removeChild(mockHeader);
  });

  it('should emit null highlightChange on destroy to clear active highlights', () => {
    const highlightSpy = vi.spyOn(component.highlightChange, 'emit');
    component.ngOnDestroy();
    expect(highlightSpy).toHaveBeenCalledWith(null);
  });
});
