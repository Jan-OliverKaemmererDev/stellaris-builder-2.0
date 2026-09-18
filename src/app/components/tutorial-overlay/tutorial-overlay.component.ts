import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiFaceHologramComponent } from '../ai-face-hologram/ai-face-hologram.component';
import { IconComponent } from '../icon/icon.component';
import { AudioService } from '../../services/audio.service';

export interface TutorialStep {
  id: string;
  stepNumber: number;
  title: string;
  text: string;
  tip?: string;
  target?: 'resources' | 'energy' | 'supply' | 'fleet' | null;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    stepNumber: 1,
    title: 'Willkommen auf der Brücke, Commander!',
    text: 'Initialisiere Schiffs-KI... Verbindung hergestellt. Willkommen auf Ihrem Flaggschiff! Ich bin Ihre Schiffs-KI und begleite Sie bei Ihren ersten Schritten. Diese Brücke ist Ihre zentrale Kommandozentrale: Hier überwachen Sie Rohstoffe, Energienetz und Flotte stets auf einen Blick.',
    tip: 'Tipp: Sie können diesen Dialog anklicken, um den Text sofort vollständig aufzudecken.',
    target: null,
  },
  {
    id: 'resources',
    stepNumber: 2,
    title: 'Rohstoffproduktion & Bergbau',
    text: 'Eisen, Silber und Gold sind das materielle Fundament Ihres Reiches. Im Menü "Mining" errichten und verbessern Sie Minen, um Ihre stündliche Förderung zu steigern. Behalten Sie stets die maximale Lagerkapazität im Auge – volle Lager bedeuten verschenkte Ressourcen!',
    tip: 'Tipp: Bauen Sie frühzeitig alle drei Grundminen aus, um konstanten Nachschub zu sichern.',
    target: 'resources',
  },
  {
    id: 'energy',
    stepNumber: 3,
    title: 'Das Energienetz – Überlebenswichtig!',
    text: 'Achtung, Commander: Ausnahmslos jedes Gebäude und Schiff benötigt kontinuierlich Energie! Kraftwerke müssen im Menü "Energie" errichtet werden. Fällt Ihre freie Energie auf oder unter 0, bricht das gesamte Stromnetz zusammen und ALLE Minen stoppen sofort die Förderung! Über das Blitz-Icon auf Karten können Sie einzelne Verbraucher im Notfall stromlos schalten.',
    tip: 'Warnung: Ein Stromausfall legt Ihre gesamte Wirtschaft lahm. Halten Sie stets einen soliden Energiepuffer!',
    target: 'energy',
  },
  {
    id: 'supply',
    stepNumber: 4,
    title: 'Versorgung, Xenonit & Credits',
    text: 'Für fortschrittliche Raumschiffe benötigen Sie Xenonit aus der Raffinerie (Infrastruktur). Personal aus Raumstationen und Nahrung aus Biolaboren sichern das Wachstum Ihrer Zivilisation. Credits verdienen Sie durch Handel oder den Verkauf überschüssiger Rohstoffe.',
    tip: 'Tipp: Der Handelsposten im Menü "Trade" erlaubt es Ihnen, Engpässe schnell auszugleichen.',
    target: 'supply',
  },
  {
    id: 'fleet',
    stepNumber: 5,
    title: 'Flotte, Asteroiden & Feind-Erwachen',
    text: 'Auf Ihrer Orbitalen Schiffswerft konstruieren Sie Schiffe. Mining-Schiffe können Sie auf lukrative Asteroiden-Missionen entsenden – sie bringen reiche Rohstoffbeute! Doch Vorsicht: Sobald Sie die Planetare Verteidigung bauen und Ihre erste Offensive starten, erwacht eine feindliche Fraktion zu unberechenbaren Angriffen!',
    tip: 'Vorsicht: Bauen Sie eine starke Verteidigung und Kampfschiffe auf, bevor Sie feindliche Raids provozieren.',
    target: 'fleet',
  },
  {
    id: 'research',
    stepNumber: 6,
    title: 'Forschung & Nano-Bots',
    text: 'Im Menü "Forschung" erforschen Sie revolutionäre Technologien. Allen voran die Nano-Bots: Jede Stufe senkt die Baukosten ALLER Gebäude um 1% (bis zu 50% Ersparnis!). Investieren Sie früh in Nano-Bots, um im späteren Spielverlauf Millionen Rohstoffe einzusparen.',
    tip: 'Geheimtipp: Nano-Bots machen jeden zukünftigen Ausbau spürbar günstiger.',
    target: null,
  },
  {
    id: 'finish',
    stepNumber: 7,
    title: 'Bereit zum Start – Ihr Befehl, Commander?',
    text: 'Hervorragend! Ihre Schiffs-Systeme sind einsatzbereit. Öffnen Sie oben im Navigator das Menü "Mining" und "Energie", um Ihre ersten Minen und ein Solarkraftwerk in Auftrag zu geben. Die Galaxie wartet auf Sie!',
    tip: 'Wichtig: Bei Fragen finden Sie alle Spielregeln und Formeln jederzeit oben rechts im Benutzer-Menü.',
    target: null,
  },
];

@Component({
  selector: 'app-tutorial-overlay',
  standalone: true,
  imports: [CommonModule, AiFaceHologramComponent, IconComponent],
  templateUrl: './tutorial-overlay.component.html',
  styleUrls: ['./tutorial-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TutorialOverlayComponent implements OnInit, OnDestroy {
  private audioService = inject(AudioService);

  @Output() completed = new EventEmitter<void>();
  @Output() highlightChange = new EventEmitter<'resources' | 'energy' | 'supply' | 'fleet' | null>();

  readonly steps = TUTORIAL_STEPS;
  readonly totalSteps = TUTORIAL_STEPS.length;

  /** Current step index (0 to totalSteps - 1). */
  readonly currentStepIndex = signal<number>(0);

  /** Whether the user opted to skip the tutorial (shows the farewell guidance screen). */
  readonly isSkipped = signal<boolean>(false);

  /** Currently visible typewriter text. */
  readonly displayedText = signal<string>('');

  /** Whether text is actively streaming. */
  readonly isTyping = signal<boolean>(false);

  /** Active step configuration. */
  readonly currentStep = computed<TutorialStep>(() => {
    const idx = Math.max(0, Math.min(this.currentStepIndex(), this.totalSteps - 1));
    return this.steps[idx];
  });

  /** Dynamic inline styles for the tutorial stage positioning. */
  readonly stageStyle = signal<{[key: string]: string}>({
    'top': '10vh',
    'left': '50%',
    'transform': 'translateX(-50%)'
  });

  /** Display name of the highlighted system for the direction indicator. */
  readonly targetDisplayName = computed<string>(() => {
    const target = this.currentStep().target;
    switch (target) {
      case 'resources': return 'Rohstoffe (Mining)';
      case 'energy': return 'Energie-Netz';
      case 'supply': return 'Versorgung & Handel';
      case 'fleet': return 'Flotten-Werft';
      default: return '';
    }
  });

  /** Consistent face size with optimized mobile scale. */
  readonly faceSize = computed<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 640) {
      return 70;
    }
    return 135;
  });

  private typeTimer: any = null;
  private currentFullText = '';
  private charIndex = 0;

  ngOnInit(): void {
    this.startStep(0);
  }

  ngOnDestroy(): void {
    this.stopTypewriter();
  }

  /**
   * Starts a new tutorial step and launches typewriter streaming.
   */
  startStep(index: number): void {
    if (index < 0 || index >= this.totalSteps) return;
    this.currentStepIndex.set(index);
    this.isSkipped.set(false);

    const step = this.steps[index];
    this.highlightChange.emit(step.target ?? null);
    this.scrollToTarget(step.target);
    this.typeText(step.text);
  }

  /**
   * Smoothly scrolls the viewport and positions the dialog near the target card.
   */
  private scrollToTarget(target: string | null | undefined): void {
    if (typeof window === 'undefined') return;
    const isMobile = window.innerWidth <= 900;

    if (!target) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.stageStyle.set({
        'top': isMobile ? '16px' : '8vh',
        'left': '50%',
        'transform': 'translateX(-50%)',
        'width': isMobile ? 'calc(100% - 16px)' : '750px',
        'max-width': isMobile ? 'calc(100% - 16px)' : '96%'
      });
      return;
    }

    let elId = '';
    if (target === 'resources') elId = 'card-resources';
    else if (target === 'energy') elId = 'card-energy';
    else if (target === 'supply') elId = 'card-supply';
    else if (target === 'fleet') elId = 'card-colony-ships';

    if (elId) {
      setTimeout(() => {
        const el = document.getElementById(elId);
        const track = document.querySelector('.tutorial-stage-track');
        if (el && track) {
          const elRect = el.getBoundingClientRect();
          const trackRect = track.getBoundingClientRect();
          
          const relTop = elRect.top - trackRect.top;
          const relLeft = elRect.left - trackRect.left;
          const centerX = isMobile ? (trackRect.width / 2) : (relLeft + (elRect.width / 2));
          
          let isAbove: boolean;
          if (isMobile) {
            // Mobile single column:
            // resources (top card) always below
            // fleet (bottom card) always above
            // middle cards: below if in upper half of page, above if lower down
            if (target === 'resources') {
              isAbove = false;
            } else if (target === 'fleet') {
              isAbove = true;
            } else {
              isAbove = relTop > 450;
            }
          } else {
            isAbove = (elRect.top + elRect.height / 2) > (window.innerHeight / 2);
          }
          
          let topPos: number;
          let transform: string;

          const gap = isMobile ? 12 : 25;
          if (isAbove) {
            topPos = relTop - gap;
            transform = 'translate(-50%, -100%)';
          } else {
            topPos = relTop + elRect.height + gap;
            transform = 'translate(-50%, 0)';
          }
          
          this.stageStyle.set({
            'top': `${topPos}px`,
            'left': `${centerX}px`,
            'transform': transform,
            'width': isMobile ? 'calc(100% - 16px)' : '750px',
            'max-width': isMobile ? 'calc(100% - 16px)' : '96%'
          });

          // Smooth scroll to active element
          setTimeout(() => {
            if (isMobile && !isAbove) {
              const cardTop = el.getBoundingClientRect().top + window.scrollY - 110;
              window.scrollTo({ top: Math.max(0, cardTop), behavior: 'smooth' });
            } else {
              const stage = document.querySelector('.tutorial-stage');
              if (stage) {
                stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          }, 40);
        }
      }, 50);
    }
  }

  /**
   * Advances to the next tutorial step or completes the tutorial on final step.
   */
  nextStep(): void {
    this.audioService.playUiClick();
    if (this.isTyping()) {
      // First click completes typing instantly
      this.instantCompleteText();
      return;
    }

    if (this.currentStepIndex() < this.totalSteps - 1) {
      this.startStep(this.currentStepIndex() + 1);
    } else {
      this.finishTutorial();
    }
  }

  /**
   * Goes back to the previous step.
   */
  prevStep(): void {
    this.audioService.playUiClick();
    if (this.currentStepIndex() > 0) {
      this.startStep(this.currentStepIndex() - 1);
    }
  }

  /**
   * Triggers the skip dialog state.
   */
  skipTutorial(): void {
    this.audioService.playUiClick();
    this.stopTypewriter();
    this.highlightChange.emit(null);
    this.isSkipped.set(true);
    
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;
    this.stageStyle.set({
      'top': isMobile ? '16px' : '8vh',
      'left': '50%',
      'transform': 'translateX(-50%)',
      'width': isMobile ? 'calc(100% - 16px)' : '750px',
      'max-width': isMobile ? 'calc(100% - 16px)' : '96%'
    });

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const skipMessage =
      'Tutorial übersprungen. Keine Sorge, Commander! Sämtliche Spielregeln, Formeln und Taktiken finden Sie jederzeit im Benutzer-Menü oben rechts unter dem Menüpunkt "Spielregeln". Ich übergebe Ihnen die volle Kontrolle über die Brücke.';
    this.typeText(skipMessage);
  }

  /**
   * Completes the tutorial permanently and notifies parent component.
   */
  finishTutorial(): void {
    this.audioService.playUiClick();
    this.stopTypewriter();
    this.highlightChange.emit(null);
    this.completed.emit();
  }

  /**
   * Handles user click on the dialog box to finish typing immediately.
   */
  onDialogClick(): void {
    if (this.isTyping()) {
      this.instantCompleteText();
    }
  }

  /**
   * Immediately displays the full text without waiting for typewriter.
   */
  private instantCompleteText(): void {
    this.stopTypewriter();
    this.displayedText.set(this.currentFullText);
    this.isTyping.set(false);
  }

  /**
   * Drives the character-by-character typewriter effect.
   */
  private typeText(fullText: string): void {
    this.stopTypewriter();
    this.currentFullText = fullText;
    this.charIndex = 0;
    this.displayedText.set('');
    this.isTyping.set(true);

    const stepChar = () => {
      if (this.charIndex < this.currentFullText.length) {
        this.charIndex++;
        this.displayedText.set(this.currentFullText.slice(0, this.charIndex));
        this.typeTimer = setTimeout(stepChar, 18);
      } else {
        this.isTyping.set(false);
      }
    };

    this.typeTimer = setTimeout(stepChar, 100);
  }

  private stopTypewriter(): void {
    if (this.typeTimer !== null) {
      clearTimeout(this.typeTimer);
      this.typeTimer = null;
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (!this.isSkipped()) {
        this.skipTutorial();
      } else {
        this.finishTutorial();
      }
    } else if (event.key === 'Enter' || event.key === 'ArrowRight') {
      if (!this.isSkipped()) {
        this.nextStep();
      } else {
        this.finishTutorial();
      }
    } else if (event.key === 'ArrowLeft' && !this.isSkipped()) {
      this.prevStep();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const step = this.steps[this.currentStepIndex()];
    this.scrollToTarget(this.isSkipped() ? null : step?.target);
  }
}

