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
  ViewChild,
  ElementRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiFaceHologramComponent } from '../ai-face-hologram/ai-face-hologram.component';
import { IconComponent } from '../icon/icon.component';
import { AudioService } from '../../services/audio.service';
import { GameStateService } from '../../services/game-state.service';

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
  @ViewChild('particleCanvas') particleCanvasRef?: ElementRef<HTMLCanvasElement>;

  private audioService = inject(AudioService);
  private gameState = inject(GameStateService);
  private ngZone = inject(NgZone);
  private elementRef = inject(ElementRef);

  @Output() completed = new EventEmitter<void>();
  @Output() highlightChange = new EventEmitter<'resources' | 'energy' | 'supply' | 'fleet' | null>();

  /** Whether the exit particle flight animation is currently active. */
  readonly isCompleting = signal<boolean>(false);
  private particleAnimFrameId: number | null = null;

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
    this.highlightChange.emit(null);
    if (this.particleAnimFrameId !== null) {
      cancelAnimationFrame(this.particleAnimFrameId);
      this.particleAnimFrameId = null;
    }
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
   * Completes the tutorial permanently and triggers the particle flight into the header-center.
   */
  finishTutorial(): void {
    if (this.isCompleting()) return;
    this.audioService.playUiClick();
    this.stopTypewriter();
    this.highlightChange.emit(null);

    // If SSR or test environment without DOM or reduced motion preference
    if (
      typeof window === 'undefined' ||
      typeof document === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ) {
      this.completed.emit();
      return;
    }

    const headerTarget =
      (document.querySelector('.desktop-ai-hologram') as HTMLElement | null) ||
      (document.querySelector('.desktop-ai-wrapper') as HTMLElement | null) ||
      (document.querySelector('.center-hud-pod') as HTMLElement | null) ||
      (document.querySelector('.header-center') as HTMLElement | null);

    const faceTarget =
      (this.elementRef.nativeElement.querySelector('.tutorial-ai-face') as HTMLElement | null) ||
      (this.elementRef.nativeElement.querySelector('.hologram-projection-wrap') as HTMLElement | null);

    if (!headerTarget || !faceTarget) {
      this.completed.emit();
      return;
    }

    this.isCompleting.set(true);
    this.audioService.playHologramTransfer();
    this.launchParticleFlight(faceTarget, headerTarget);
  }

  /**
   * Spawns a high-performance particle stream that dematerializes from the tutorial AI face
   * and flies along magnetic bezier trajectories into the header-center console.
   */
  private launchParticleFlight(faceEl: HTMLElement, headerEl: HTMLElement): void {
    const canvas = this.particleCanvasRef?.nativeElement;
    if (!canvas) {
      this.completed.emit();
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.completed.emit();
      return;
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const faceRect = faceEl.getBoundingClientRect();
    const headerRect = headerEl.getBoundingClientRect();

    const startX = faceRect.left + faceRect.width / 2;
    const startY = faceRect.top + faceRect.height / 2;
    const targetX = headerRect.left + headerRect.width / 2;
    const targetY = headerRect.top + headerRect.height / 2;

    const faceRadius = Math.max(25, Math.min(faceRect.width, faceRect.height) * 0.38);

    interface TransferParticle {
      x0: number;
      y0: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      cp1x: number;
      cp1y: number;
      cp2x: number;
      cp2y: number;
      delay: number;
      duration: number;
      size: number;
      color: string;
      trailColor: string;
      waveFreq: number;
      waveAmp: number;
      wavePhase: number;
      history: { x: number; y: number }[];
      hasArrived: boolean;
    }

    interface ImpactSpark {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
      color: string;
    }

    const PARTICLE_COUNT = 210;
    const particles: TransferParticle[] = [];
    const sparks: ImpactSpark[] = [];

    const colors = [
      { core: '#ffffff', trail: 'rgba(255, 255, 255, 0.75)' },
      { core: '#a5f3fc', trail: 'rgba(165, 243, 252, 0.7)' },
      { core: '#38bdf8', trail: 'rgba(56, 189, 248, 0.65)' },
      { core: '#22d3ee', trail: 'rgba(34, 211, 238, 0.6)' },
      { core: '#818cf8', trail: 'rgba(129, 140, 248, 0.5)' },
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * faceRadius;
      const x0 = startX + Math.cos(angle) * r;
      const y0 = startY + Math.sin(angle) * r;

      const burstSpeed = 1.2 + Math.random() * 3.5;
      const vx = Math.cos(angle) * burstSpeed;
      const vy = Math.sin(angle) * burstSpeed - 1.5;

      const arcSpread = (Math.random() - 0.5) * 160;
      const arcRise = 50 + Math.random() * 110;
      const cp1x = x0 + arcSpread * 0.8;
      const cp1y = Math.min(y0, targetY) - arcRise;
      const cp2x = targetX + arcSpread * 0.4;
      const cp2y = targetY + 40 + Math.random() * 60;

      const delay = Math.random() * 320;
      const duration = 750 + Math.random() * 260;

      const colObj = colors[Math.floor(Math.random() * colors.length)];

      particles.push({
        x0,
        y0,
        x: x0,
        y: y0,
        vx,
        vy,
        cp1x,
        cp1y,
        cp2x,
        cp2y,
        delay,
        duration,
        size: 1.5 + Math.random() * 2.2,
        color: colObj.core,
        trailColor: colObj.trail,
        waveFreq: 2.5 + Math.random() * 3,
        waveAmp: 8 + Math.random() * 20,
        wavePhase: Math.random() * Math.PI * 2,
        history: [],
        hasArrived: false,
      });
    }

    const startTime = performance.now();
    const TOTAL_DURATION = 1450;
    let headerTriggered = false;

    this.ngZone.runOutsideAngular(() => {
      const render = (now: number) => {
        const elapsed = now - startTime;

        ctx.clearRect(0, 0, width, height);

        // 1. UPDATE & DRAW PARTICLES
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          if (elapsed < p.delay) {
            const dtBurst = elapsed / 1000;
            p.x = p.x0 + p.vx * dtBurst * 35;
            p.y = p.y0 + p.vy * dtBurst * 35;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.9, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.shadowBlur = 0;
            continue;
          }

          const flightElapsed = elapsed - p.delay;
          const rawProgress = Math.min(1, flightElapsed / p.duration);

          if (rawProgress < 1) {
            // Quintic easeInOut acceleration curve
            const t = rawProgress < 0.5
              ? 16 * rawProgress * rawProgress * rawProgress * rawProgress * rawProgress
              : 1 - Math.pow(-2 * rawProgress + 2, 5) / 2;

            const u = 1 - t;

            // Cubic Bezier interpolation
            let bx = u * u * u * p.x0 + 3 * u * u * t * p.cp1x + 3 * u * t * t * p.cp2x + t * t * t * targetX;
            let by = u * u * u * p.y0 + 3 * u * u * t * p.cp1y + 3 * u * t * t * p.cp2y + t * t * t * targetY;

            // Transverse cyber harmonic wave
            const wave = Math.sin(t * Math.PI * p.waveFreq + p.wavePhase) * p.waveAmp * Math.sin(t * Math.PI);
            bx += wave;

            p.x = bx;
            p.y = by;

            p.history.push({ x: p.x, y: p.y });
            if (p.history.length > 6) {
              p.history.shift();
            }

            // Draw glowing trail
            if (p.history.length > 1) {
              ctx.beginPath();
              ctx.moveTo(p.history[0].x, p.history[0].y);
              for (let h = 1; h < p.history.length; h++) {
                ctx.lineTo(p.history[h].x, p.history[h].y);
              }
              ctx.strokeStyle = p.trailColor;
              ctx.lineWidth = p.size * 0.9;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.stroke();
            }

            // Draw glowing particle head
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
          } else if (!p.hasArrived) {
            p.hasArrived = true;
            const sparkCount = 2 + Math.floor(Math.random() * 3);
            for (let s = 0; s < sparkCount; s++) {
              const spAngle = Math.random() * Math.PI * 2;
              const spSpeed = 1.0 + Math.random() * 3.2;
              sparks.push({
                x: targetX,
                y: targetY,
                vx: Math.cos(spAngle) * spSpeed,
                vy: Math.sin(spAngle) * spSpeed,
                life: 0,
                maxLife: 20 + Math.random() * 15,
                size: 1 + Math.random() * 2,
                color: p.color,
              });
            }
          }
        }

        // 2. UPDATE & DRAW IMPACT SPARKS AT HEADER
        for (let s = sparks.length - 1; s >= 0; s--) {
          const sp = sparks[s];
          sp.life++;
          sp.x += sp.vx;
          sp.y += sp.vy;
          sp.vx *= 0.92;
          sp.vy *= 0.92;

          const sparkAlpha = Math.max(0, 1 - sp.life / sp.maxLife);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size * sparkAlpha, 0, Math.PI * 2);
          ctx.fillStyle = sp.color;
          ctx.globalAlpha = sparkAlpha;
          ctx.fill();
          ctx.globalAlpha = 1.0;

          if (sp.life >= sp.maxLife) {
            sparks.splice(s, 1);
          }
        }

        // 3. TARGET SHOCKWAVE / RE-INTEGRATION RING
        if (elapsed >= 1100) {
          const ringElapsed = elapsed - 1100;
          const ringProgress = Math.min(1, ringElapsed / 350);
          const ringRadius = 16 + ringProgress * 48;
          const ringAlpha = (1 - ringProgress) * 0.85;

          ctx.beginPath();
          ctx.arc(targetX, targetY, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${ringAlpha})`;
          ctx.lineWidth = 2.5 * (1 - ringProgress);
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // 4. TRIGGER HEADER AI FACE MATERIALIZATION
        if (elapsed >= 1150 && !headerTriggered) {
          headerTriggered = true;
          this.ngZone.run(() => {
            this.gameState.triggerAiMaterialize();
          });
        }

        // 5. SEQUENCE COMPLETION
        if (elapsed < TOTAL_DURATION) {
          this.particleAnimFrameId = requestAnimationFrame(render);
        } else {
          this.particleAnimFrameId = null;
          ctx.clearRect(0, 0, width, height);
          this.ngZone.run(() => {
            this.completed.emit();
          });
        }
      };

      this.particleAnimFrameId = requestAnimationFrame(render);
    });
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
    if (this.isCompleting()) return;
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
    if (this.isCompleting()) return;
    const step = this.steps[this.currentStepIndex()];
    this.scrollToTarget(this.isSkipped() ? null : step?.target);
  }
}

