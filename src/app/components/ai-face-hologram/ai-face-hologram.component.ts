import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
  inject,
  Input,
  HostBinding,
  ChangeDetectionStrategy
} from '@angular/core';
import * as THREE from 'three';
import { AudioService } from '../../services/audio.service';

/**
 * 3D Holographic AI Face Component ("GLaDOS" / Ship AI).
 * Personality-infused ethereal female facial point cloud:
 * - Subtly hinted, ethereal holographic silhouette (no nose, no eyebrows).
 * - Wider, neutral glowing ocular apertures.
 * - Random natural blinking & occasional charming cyber-smirk.
 * - Inactivity Stage 1 (after ~16s): Yawning with head tilt and wide mouth.
 * - Inactivity Stage 2 (after ~32s): Sleeping with closed eyes, nodding head, and slow breathing.
 * - Wakeup reaction on mouse move: Startled head snap & rapid double-blink!
 * - Real-time audio-reactive lip-sync when GLaDOS speaks.
 * - Background particle cloud continuously dispersing behind the head.
 * - Follows the mouse pointer (smooth lerped pitch & yaw head tracking).
 */
@Component({
  selector: 'app-ai-face-hologram',
  standalone: true,
  template: `
    <div class="ai-face-container" (pointerenter)="onPointerEnter()" (pointerleave)="onPointerLeave()">
      <canvas #hologramCanvas class="ai-face-canvas"></canvas>
    </div>
  `,
  styleUrls: ['./ai-face-hologram.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiFaceHologramComponent implements AfterViewInit, OnDestroy {
  @ViewChild('hologramCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  /** Whether the AI is speaking (e.g. during typewriter dialog) to trigger synthetic lip movement. */
  @Input() isSpeaking = false;

  /** Display size in CSS pixels (default: 88px). */
  @Input() size = 88;

  @HostBinding('style.--ai-face-size.px')
  get hostSize(): number {
    return this.size;
  }

  @HostBinding('class.large')
  get isLarge(): boolean {
    return this.size > 100;
  }

  private ngZone = inject(NgZone);
  private audioService = inject(AudioService);

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private headGroup!: THREE.Group;

  private facePoints!: THREE.Points;
  private circuitPoints!: THREE.Points;
  private dispersionPoints!: THREE.Points;

  private basePositions!: Float32Array;
  private mouthWeights!: Float32Array;
  private eyeWeights!: Float32Array;
  private smileWeights!: Float32Array;

  // Dynamic cybernetic circuit traces (Leiterbahnen)
  private circuitBaseColors!: Float32Array;
  private circuitNodes: { pathId: number; t: number; isVia: boolean; index: number }[] = [];
  private pathExits: [number, number, number][] = [];
  private circuitPulses: {
    pathId: number;
    progress: number;
    speed: number;
    width: number;
    intensity: number;
    hasDischarged: boolean;
  }[] = [];
  private nextPulseTime = 0;

  // Dispersion particles state
  private dispersionPositions!: Float32Array;
  private dispersionVelocities!: Float32Array;
  private dispersionLifes!: Float32Array;
  private readonly DISPERSION_COUNT = 160;

  private animationFrameId: number | null = null;
  private isDestroyed = false;

  // Mouse / Pointer Tracking
  private targetRotX = 0;
  private targetRotY = 0;
  private currentRotX = 0;
  private currentRotY = 0;
  private isHovered = false;

  // Inactivity & personality timers (ms)
  private lastPointerMoveTime = performance.now();
  private hasYawnedThisIdle = false;

  // Blinking
  private nextBlinkTime = performance.now() + 3000 + Math.random() * 3000;
  private blinkProgress = 0; // 0 (open) -> 1 (closed) -> 0
  private isBlinking = false;
  private blinkDuration = 200; // ms

  // Smiling / Grinning
  private nextSmileTime = performance.now() + 8000 + Math.random() * 8000;
  private smileAmount = 0; // 0.0 to 1.0
  private isSmiling = false;
  private smileStartTime = 0;
  private readonly smileDuration = 2200; // ms

  // Yawning
  private isYawning = false;
  private yawnStartTime = 0;
  private yawnAmount = 0;
  private readonly yawnDuration = 3400; // ms

  // Sleeping & Wakeup
  private isSleeping = false;
  private sleepAmount = 0; // 0.0 to 1.0
  private startledTimer = 0; // ms countdown on wakeup

  // Lip-sync smoothing
  private mouthOpenAmount = 0;

  // Window event cleanup
  private pointerMoveHandler = (e: PointerEvent) => this.onWindowPointerMove(e);

  constructor() {
    if (typeof window !== 'undefined') {
      (window as any).__triggerAiSpeechTest = () => {
        this.audioService.playBuildingCompleted();
      };
      (window as any).__getAiMouthOpen = () => this.mouthOpenAmount;
      (window as any).__testBlink = () => this.triggerBlink();
      (window as any).__testSmile = () => this.triggerSmile();
      (window as any).__testYawn = () => this.triggerYawn();
      (window as any).__testSleep = () => { this.isSleeping = true; };
      (window as any).__testWakeup = () => this.wakeUp();
    }
  }

  ngAfterViewInit(): void {
    try {
      this.initThree();
      this.initFaceGeometry();
      this.initCircuitGeometry();
      this.initDispersionGeometry();

      if (typeof window !== 'undefined') {
        window.addEventListener('pointermove', this.pointerMoveHandler, { passive: true });
      }

      this.ngZone.runOutsideAngular(() => {
        this.animate();
      });
    } catch (e) {
      console.warn('AiFaceHologram: WebGL initialization skipped or failed:', e);
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this.pointerMoveHandler);
    }

    if (this.facePoints) {
      this.facePoints.geometry.dispose();
      (this.facePoints.material as THREE.Material).dispose();
    }

    if (this.circuitPoints) {
      this.circuitPoints.geometry.dispose();
      (this.circuitPoints.material as THREE.Material).dispose();
    }

    if (this.dispersionPoints) {
      this.dispersionPoints.geometry.dispose();
      (this.dispersionPoints.material as THREE.Material).dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  private initThree(): void {
    const canvas = this.canvasRef.nativeElement;
    // Internal buffer size for crisp high-DPI rendering
    const internalSize = Math.max(200, Math.round(this.size * 2));
    canvas.width = internalSize;
    canvas.height = internalSize;

    this.scene = new THREE.Scene();

    // Camera positioned for balanced face scale
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
    this.camera.position.set(0, 0, 2.32);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(internalSize, internalSize, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.headGroup = new THREE.Group();
    this.headGroup.position.y = -0.16; // Shifted downward
    this.scene.add(this.headGroup);
  }

  /**
   * Generates a circular glowing particle sprite texture.
   */
  private createGlowDotTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.25, 'rgba(165, 243, 252, 0.95)'); // Cyan #a5f3fc
    grad.addColorStop(0.65, 'rgba(56, 189, 248, 0.45)'); // Sky #38bdf8
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Builds an airy, hinted holographic facial point cloud with deformation weights:
   * - No nose, no eyebrows.
   * - Wider, minimalist eyes (eyeWeight for blinking & sleeping).
   * - Neutral horizontal mouth slit (mouthWeight for speech/yawn, smileWeight for grinning).
   * - Delicate cranial and jawline silhouette.
   */
  private initFaceGeometry(): void {
    const points: number[] = [];
    const colors: number[] = [];
    const mWeights: number[] = [];
    const eWeights: number[] = [];
    const sWeights: number[] = [];

    const colWhite = new THREE.Color(1, 1, 1);
    const colBrightCyan = new THREE.Color(0.65, 0.95, 0.99); // #a5f3fc
    const colElectricCyan = new THREE.Color(0.22, 0.74, 0.97); // #38bdf8
    const colSoftCyan = new THREE.Color(0.12, 0.55, 0.85); // Deeper tone
    const colDeepCyan = new THREE.Color(0.06, 0.32, 0.55); // Subtle ambient tone

    const addPoint = (
      x: number,
      y: number,
      z: number,
      color: THREE.Color,
      mouthWeight = 0,
      eyeWeight = 0,
      smileWeight = 0
    ) => {
      points.push(x, y, z);
      colors.push(color.r, color.g, color.b);
      mWeights.push(mouthWeight);
      eWeights.push(eyeWeight);
      sWeights.push(smileWeight);
    };

    // 1. CRANIUM & FOREHEAD (Airy ambient dome - complete volume, no holes)
    for (let phi = 0.22; phi <= Math.PI * 0.46; phi += 0.11) {
      const y = 0.22 + Math.sin(phi) * 0.78;
      const radiusAtY = Math.cos(phi) * 0.62;
      const step = 0.15 / Math.max(0.25, Math.cos(phi));
      for (let theta = -Math.PI * 0.45; theta <= Math.PI * 0.45; theta += step) {
        const x = Math.sin(theta) * radiusAtY;
        const z = Math.cos(theta) * radiusAtY * 0.82 - 0.05;
        const col = phi > Math.PI * 0.38 ? colDeepCyan : colSoftCyan;
        addPoint(x, y, z, col, 0, 0, 0);
      }
    }

    // 2. LATERAL SILHOUETTE & CHEEKBONES (Soft hinted face contours)
    for (let y = 0.22; y >= -0.65; y -= 0.045) {
      const t = (0.22 - y) / 0.87;
      const halfWidth = 0.58 * (1 - Math.pow(t, 1.4) * 0.65);
      const depth = 0.42 - t * 0.12;

      for (let side of [-1, 1]) {
        for (let angle = 0.35; angle <= 0.95; angle += 0.14) {
          const theta = side * (angle * Math.PI * 0.5);
          const x = Math.sin(theta) * halfWidth;
          const z = Math.cos(theta) * depth - 0.06;

          const isCheek = y > -0.05 && y < 0.15 && Math.abs(x) > 0.30;
          const col = isCheek ? colBrightCyan : colSoftCyan;

          // Lower jaw points move with speech & yawn
          const weight = y < -0.3 ? Math.max(0, 0.45 * ((-0.3 - y) / 0.35)) : 0;
          // Cheek points slightly lift on smile
          const sWeight = isCheek ? 0.35 : 0;
          addPoint(x, y, z, col, weight, 0, sWeight);
        }
      }
    }

    // 3. EYES: CLEAR, ELEGANT & GENEROUSLY SIZED (Almond aperture with crisp particle definition)
    const eyeSpacing = 0.29; // Harmonious eye spacing across face
    const eyeY = 0.13;
    const eyeZ = 0.28;
    const eyeHalfWidth = 0.135; // Generously sized eye span (total width ~0.27)

    [-1, 1].forEach((side) => {
      const cx = side * eyeSpacing;

      // Bright focal pupil / aperture core
      addPoint(cx, eyeY + 0.005, eyeZ + 0.03, colWhite, 0, 1.0, 0);

      // Upper eyelid: elegant curved arc
      for (let dx = -eyeHalfWidth; dx <= eyeHalfWidth; dx += 0.026) {
        const nx = dx / eyeHalfWidth;
        const arch = 1 - Math.pow(nx, 2);
        const ey = eyeY + arch * 0.036;
        const ez = eyeZ + arch * 0.02;
        const col = Math.abs(nx) < 0.4 ? colBrightCyan : colElectricCyan;
        addPoint(cx + dx, ey, ez, col, 0, 1.0, 0);
      }

      // Lower eyelid: subtle counter-arc (with clear vertical separation so it never clumps)
      for (let dx = -eyeHalfWidth * 0.85; dx <= eyeHalfWidth * 0.85; dx += 0.028) {
        const nx = dx / (eyeHalfWidth * 0.85);
        const arch = 1 - Math.pow(nx, 2);
        const ey = eyeY - arch * 0.022;
        const ez = eyeZ + arch * 0.015 - 0.005;
        addPoint(cx + dx, ey, ez, colSoftCyan, 0, 1.0, 0);
      }
    });

    // 4. MOUTH: SLENDER, NARROWER & ELEGANT (Schmaler, refined width)
    const mouthY = -0.32;
    const mouthZ = 0.27;
    const mouthHalfWidth = 0.19; // Narrower mouth width

    // Upper lip: subtle cupid's bow, slender single line
    for (let x = -mouthHalfWidth; x <= mouthHalfWidth; x += 0.026) {
      const nx = x / mouthHalfWidth;
      const arch = 1 - Math.pow(nx, 2);
      // Subtle center bow contour
      const bow = Math.abs(nx) < 0.28 ? Math.cos((nx / 0.28) * Math.PI) * 0.005 : 0;
      const y = mouthY + arch * 0.012 - bow;
      const z = mouthZ + arch * 0.02;
      const col = Math.abs(nx) < 0.35 ? colBrightCyan : colElectricCyan;
      const sWeight = Math.min(1.0, Math.max(0, (Math.abs(nx) - 0.25) / 0.75));
      addPoint(x, y, z, col, 0, 0, sWeight);
    }

    // Lower lip: soft gentle curve, drops dynamically on speech & yawn
    for (let x = -mouthHalfWidth * 0.88; x <= mouthHalfWidth * 0.88; x += 0.026) {
      const nx = x / (mouthHalfWidth * 0.88);
      const arch = 1 - Math.pow(nx, 2);
      // Resting position slightly below upper lip for clean definition without overlap
      const y = mouthY - 0.014 * arch;
      const z = mouthZ + arch * 0.018 - 0.004;
      const col = Math.abs(nx) < 0.3 ? colBrightCyan : colElectricCyan;
      const sWeight = Math.min(1.0, Math.max(0, (Math.abs(nx) - 0.25) / 0.75)) * 0.8;
      addPoint(x, y, z, col, 1.0, 0, sWeight);
    }

    // Soft chin contour below mouth
    for (let cy = -0.42; cy >= -0.60; cy -= 0.045) {
      const ct = (-0.42 - cy) / 0.18;
      const cWidth = 0.16 * (1 - ct * 0.4);
      const weight = 0.65 - ct * 0.3;
      for (let cx = -cWidth; cx <= cWidth; cx += 0.038) {
        const cz = mouthZ - ct * 0.08;
        const col = cy < -0.50 ? colBrightCyan : colSoftCyan;
        addPoint(cx, cy, cz, col, weight, 0, 0);
      }
    }

    // 5. SUBTLE LATITUDE SCANLINES
    for (let sy = 0.38; sy >= -0.26; sy -= 0.14) {
      if (Math.abs(sy - eyeY) > 0.09 && Math.abs(sy - mouthY) > 0.09) {
        const radius = 0.52 * Math.sqrt(Math.max(0.1, 1 - Math.pow(sy / 0.75, 2)));
        for (let angle = -Math.PI * 0.38; angle <= Math.PI * 0.38; angle += 0.12) {
          const sx = Math.sin(angle) * radius;
          if (Math.abs(sx) > 0.12) {
            const sz = Math.cos(angle) * radius * 0.75 - 0.04;
            addPoint(sx, sy, sz, colSoftCyan, 0, 0, 0);
          }
        }
      }
    }

    // Build BufferGeometry
    this.basePositions = new Float32Array(points);
    this.mouthWeights = new Float32Array(mWeights);
    this.eyeWeights = new Float32Array(eWeights);
    this.smileWeights = new Float32Array(sWeights);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));

    const material = new THREE.PointsMaterial({
      size: 0.076,
      map: this.createGlowDotTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.facePoints = new THREE.Points(geometry, material);
    this.headGroup.add(this.facePoints);
  }

  /**
   * Builds the cybernetic Leiterbahnen (circuit traces) that run across the forehead,
   * crown, and rear skull, leading directly into the background dispersing particles.
   */
  private initCircuitGeometry(): void {
    const colDeepCyan = new THREE.Color(0.05, 0.22, 0.42); // Subtle idle trace glow
    const colSoftCyan = new THREE.Color(0.12, 0.45, 0.75); // Idle via pad glow

    const cPositions: number[] = [];
    const cColors: number[] = [];
    this.circuitNodes = [];
    this.pathExits = [];

    // Helper: Map (x, y, isBack) onto the 3D skull surface
    const getSkullPoint = (x: number, y: number, isBack: boolean = false): [number, number, number] => {
      const sinPhi = Math.max(0, Math.min(1, (y - 0.22) / 0.76));
      const phi = Math.asin(sinPhi);
      const radiusAtY = Math.cos(phi) * 0.62;
      const clampedX = Math.max(-radiusAtY * 0.94, Math.min(radiusAtY * 0.94, x));
      const radialRem = Math.sqrt(Math.max(0.001, radiusAtY * radiusAtY - clampedX * clampedX));
      const z = isBack
        ? -radialRem * 0.88 - 0.05
        : radialRem * 0.82 - 0.04;
      return [clampedX, y, z];
    };

    // Waypoint paths from forehead/temple, over the crown, to the back dispersing cloud
    // Each waypoint: [x, y, isBack, isVia]
    type Waypoint = [number, number, boolean, boolean];

    const rawPaths: Waypoint[][] = [];

    [-1, 1].forEach((side) => {
      // 1. Paramedian Bus (Forehead over top apex to rear dispersion exit)
      rawPaths.push([
        [side * 0.06, 0.36, false, true],
        [side * 0.06, 0.58, false, false],
        [side * 0.13, 0.65, false, true],
        [side * 0.13, 0.88, false, false],
        [side * 0.08, 0.95, false, true],
        [side * 0.08, 0.82, true, false],
        [side * 0.14, 0.70, true, true],
        [side * 0.14, 0.46, true, true], // Exit into dispersion
      ]);

      // 2. Mid-Parietal Bus (Temple/brow over crown to mid-rear dispersion)
      rawPaths.push([
        [side * 0.18, 0.34, false, true],
        [side * 0.18, 0.48, false, false],
        [side * 0.25, 0.56, false, true],
        [side * 0.25, 0.76, false, false],
        [side * 0.20, 0.88, false, true],
        [side * 0.20, 0.72, true, false],
        [side * 0.26, 0.62, true, true],
        [side * 0.26, 0.40, true, true], // Exit into dispersion
      ]);

      // 3. Temple-to-Occipital Bus (Outer temple around crest to lower-rear dispersion)
      rawPaths.push([
        [side * 0.30, 0.32, false, true],
        [side * 0.30, 0.44, false, false],
        [side * 0.36, 0.52, false, true],
        [side * 0.36, 0.66, false, false],
        [side * 0.32, 0.74, true, true],
        [side * 0.32, 0.56, true, false],
        [side * 0.28, 0.42, true, true], // Exit into dispersion
      ]);
    });

    // 4. Sagittal Center Bus (Center forehead over crown to rear dispersion)
    rawPaths.push([
      [0.0, 0.42, false, true],
      [0.0, 0.70, false, false],
      [0.0, 0.96, false, true],
      [0.0, 0.78, true, false],
      [0.06, 0.64, true, true],
      [0.06, 0.44, true, true], // Exit into dispersion
    ]);

    // 5. Sagittal Center Bus - Left Rear Branch
    rawPaths.push([
      [0.0, 0.42, false, true],
      [0.0, 0.70, false, false],
      [0.0, 0.96, false, true],
      [0.0, 0.78, true, false],
      [-0.06, 0.64, true, true],
      [-0.06, 0.44, true, true], // Exit into dispersion
    ]);

    // Discretize all paths into points
    let pointIndex = 0;
    rawPaths.forEach((wayPoints) => {
      // Calculate total 3D path length
      const projectedWps: { pt: [number, number, number]; isVia: boolean }[] = wayPoints.map((wp) => ({
        pt: getSkullPoint(wp[0], wp[1], wp[2]),
        isVia: wp[3],
      }));

      let totalDist = 0;
      for (let i = 0; i < projectedWps.length - 1; i++) {
        const pA = projectedWps[i].pt;
        const pB = projectedWps[i + 1].pt;
        totalDist += Math.hypot(pB[0] - pA[0], pB[1] - pA[1], pB[2] - pA[2]);
      }

      // Store exit coordinate for this path (where it reaches the dispersing particles)
      const lastPt = projectedWps[projectedWps.length - 1].pt;
      this.pathExits.push([lastPt[0], lastPt[1], lastPt[2]]);

      // Interpolate along segments
      let accumDist = 0;
      for (let i = 0; i < projectedWps.length - 1; i++) {
        const pA = projectedWps[i].pt;
        const pB = projectedWps[i + 1].pt;
        const isViaA = projectedWps[i].isVia;
        const segDist = Math.hypot(pB[0] - pA[0], pB[1] - pA[1], pB[2] - pA[2]);
        const steps = Math.max(1, Math.round(segDist / 0.022));

        for (let s = 0; s < steps; s++) {
          const u = s / steps;
          const x = pA[0] + (pB[0] - pA[0]) * u;
          const y = pA[1] + (pB[1] - pA[1]) * u;
          const z = pA[2] + (pB[2] - pA[2]) * u;

          const currentDist = accumDist + segDist * u;
          const t = Math.min(1.0, currentDist / Math.max(0.001, totalDist));
          const isVia = s === 0 && isViaA;

          cPositions.push(x, y, z);
          const baseCol = isVia ? colSoftCyan : colDeepCyan;
          cColors.push(baseCol.r, baseCol.g, baseCol.b);

          this.circuitNodes.push({
            pathId: this.pathExits.length - 1,
            t,
            isVia,
            index: pointIndex++,
          });
        }
        accumDist += segDist;
      }

      // Final terminal via
      cPositions.push(lastPt[0], lastPt[1], lastPt[2]);
      cColors.push(colSoftCyan.r, colSoftCyan.g, colSoftCyan.b);
      this.circuitNodes.push({
        pathId: this.pathExits.length - 1,
        t: 1.0,
        isVia: true,
        index: pointIndex++,
      });
    });

    this.circuitBaseColors = new Float32Array(cColors);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cPositions), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cColors), 3));

    const mat = new THREE.PointsMaterial({
      size: 0.078,
      map: this.createGlowDotTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.circuitPoints = new THREE.Points(geo, mat);
    this.headGroup.add(this.circuitPoints);
  }

  /**
   * Updates dynamic glowing pulses running along the Leiterbahnen across the skull
   * and discharging into the dispersing background pixel stream.
   */
  private updateCircuitPulses(now: number, dt: number, isSpeaking: boolean): void {
    if (!this.circuitPoints || !this.circuitBaseColors) return;

    // 1. Random pulse generation across different paths
    if (now > this.nextPulseTime) {
      const pulseCount = Math.random() < 0.45 ? 2 : 1;
      for (let c = 0; c < pulseCount; c++) {
        const pathId = Math.floor(Math.random() * this.pathExits.length);
        const speed = 0.50 + Math.random() * 0.45; // ~1.5 - 2s per transit
        const width = 0.12 + Math.random() * 0.06;
        this.circuitPulses.push({
          pathId,
          progress: 0,
          speed,
          width,
          intensity: 0.90 + Math.random() * 0.10,
          hasDischarged: false,
        });
      }
      const delay = isSpeaking ? 120 + Math.random() * 200 : 250 + Math.random() * 450;
      this.nextPulseTime = now + delay;
    }

    // 2. Advance active pulses and discharge into dispersion particles at skull exit
    for (let i = this.circuitPulses.length - 1; i >= 0; i--) {
      const p = this.circuitPulses[i];
      p.progress += dt * p.speed;

      // When pulse hits the back of the head, discharge into the dispersing pixel stream!
      if (p.progress >= 0.98 && !p.hasDischarged) {
        p.hasDischarged = true;
        const exit = this.pathExits[p.pathId];
        if (exit) {
          this.triggerDispersionPulseExit(exit[0], exit[1], exit[2]);
        }
      }

      // Remove after passing through exit
      if (p.progress >= 1.15) {
        this.circuitPulses.splice(i, 1);
      }
    }

    // 3. Compute dynamic colors for all circuit points
    const colAttr = this.circuitPoints.geometry.attributes['color'] as THREE.BufferAttribute;
    const colors = colAttr.array as Float32Array;
    const base = this.circuitBaseColors;
    const total = this.circuitNodes.length;

    // Reset to base idle colors (dimmed in sleep mode)
    const dimFactor = 1.0 - this.sleepAmount * 0.5;
    for (let i = 0; i < total * 3; i++) {
      colors[i] = base[i] * dimFactor;
    }

    // Illuminate points along active pulse wavefronts
    for (const p of this.circuitPulses) {
      for (const node of this.circuitNodes) {
        if (node.pathId !== p.pathId) continue;
        const dist = Math.abs(node.t - p.progress);
        if (dist < p.width) {
          const norm = 1.0 - dist / p.width;
          const boost = Math.pow(norm, 1.8) * p.intensity;
          const idx = node.index * 3;

          // Leading edge / core is radiant white, tail is glowing cyan
          const isCore = norm > 0.65;
          const r = isCore ? 1.0 : 0.65;
          const g = isCore ? 1.0 : 0.95;
          const b = 0.99;

          colors[idx] = Math.min(1.0, colors[idx] + r * boost);
          colors[idx + 1] = Math.min(1.0, colors[idx + 1] + g * boost);
          colors[idx + 2] = Math.min(1.0, colors[idx + 2] + b * boost);

          // Via nodes flare brightly when energized
          if (node.isVia && norm > 0.35) {
            colors[idx] = 1.0;
            colors[idx + 1] = 1.0;
            colors[idx + 2] = 1.0;
          }
        }
      }
    }

    colAttr.needsUpdate = true;
  }

  /**
   * Spawns / boosts a dispersing pixel particle right at the circuit trace exit point.
   */
  private triggerDispersionPulseExit(x: number, y: number, z: number): void {
    if (!this.dispersionPositions || !this.dispersionVelocities || !this.dispersionLifes) return;
    const i = Math.floor(Math.random() * this.DISPERSION_COUNT);
    const idx = i * 3;

    this.dispersionPositions[idx] = x + (Math.random() - 0.5) * 0.03;
    this.dispersionPositions[idx + 1] = y + (Math.random() - 0.5) * 0.03;
    this.dispersionPositions[idx + 2] = z - 0.02;

    const speed = 0.22 + Math.random() * 0.28;
    this.dispersionVelocities[idx] = (Math.random() - 0.5) * 0.35 + Math.sign(x) * 0.25;
    this.dispersionVelocities[idx + 1] = 0.20 + Math.random() * 0.45;
    this.dispersionVelocities[idx + 2] = -0.30 - Math.random() * 0.50;
    this.dispersionLifes[i] = 1.0;
  }

  /**
   * Builds the dispersing background particle cloud behind the head.
   */
  private initDispersionGeometry(): void {
    const count = this.DISPERSION_COUNT;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    this.dispersionVelocities = new Float32Array(count * 3);
    this.dispersionLifes = new Float32Array(count);

    const colBrightCyan = new THREE.Color(0.65, 0.95, 0.99);
    const colSky = new THREE.Color(0.22, 0.74, 0.97);

    for (let i = 0; i < count; i++) {
      this.resetDispersionParticle(i, positions, true);
      const col = i % 4 === 0 ? colBrightCyan : colSky;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    this.dispersionPositions = positions;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.068,
      map: this.createGlowDotTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.dispersionPoints = new THREE.Points(geometry, material);
    this.headGroup.add(this.dispersionPoints);
  }

  private resetDispersionParticle(i: number, positions: Float32Array, randomizeLife = false): void {
    const idx = i * 3;
    const angle = Math.random() * Math.PI * 2;
    const r = 0.25 + Math.random() * 0.45;
    const x0 = Math.cos(angle) * r;
    const y0 = 0.15 + (Math.random() - 0.2) * 0.65;
    const z0 = -0.15 - Math.random() * 0.45;

    positions[idx] = x0;
    positions[idx + 1] = y0;
    positions[idx + 2] = z0;

    const speed = 0.12 + Math.random() * 0.28;
    const dirX = (Math.random() - 0.5) * 0.8 + Math.sign(x0) * 0.35;
    const dirY = 0.15 + Math.random() * 0.55;
    const dirZ = -0.2 - Math.random() * 0.65;

    this.dispersionVelocities[idx] = dirX * speed;
    this.dispersionVelocities[idx + 1] = dirY * speed;
    this.dispersionVelocities[idx + 2] = dirZ * speed;

    this.dispersionLifes[i] = randomizeLife ? Math.random() : 0.0;
  }

  private updateDispersionParticles(dt: number, speedMultiplier = 1.0): void {
    if (!this.dispersionPoints) return;

    const posAttr = this.dispersionPoints.geometry.attributes['position'] as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const count = this.DISPERSION_COUNT;

    for (let i = 0; i < count; i++) {
      this.dispersionLifes[i] += dt * 0.55 * speedMultiplier;

      if (this.dispersionLifes[i] >= 1.0) {
        this.resetDispersionParticle(i, positions, false);
      } else {
        const idx = i * 3;
        positions[idx] += this.dispersionVelocities[idx] * dt * speedMultiplier;
        positions[idx + 1] += this.dispersionVelocities[idx + 1] * dt * speedMultiplier;
        positions[idx + 2] += this.dispersionVelocities[idx + 2] * dt * speedMultiplier;
      }
    }

    posAttr.needsUpdate = true;
  }

  private triggerBlink(): void {
    this.isBlinking = true;
    this.blinkProgress = 0;
  }

  private triggerSmile(): void {
    if (this.isSleeping || this.isYawning || this.audioService.isAiSpeaking()) return;
    this.isSmiling = true;
    this.smileStartTime = performance.now();
  }

  private triggerYawn(): void {
    if (this.isSleeping || this.audioService.isAiSpeaking()) return;
    this.isYawning = true;
    this.hasYawnedThisIdle = true;
    this.yawnStartTime = performance.now();
  }

  private wakeUp(): void {
    if (this.isSleeping) {
      this.isSleeping = false;
      this.startledTimer = 850; // 850ms startled reaction
      this.hasYawnedThisIdle = false;
    }
  }

  /**
   * Tracks cursor position across the whole window and computes look-at angles.
   */
  private onWindowPointerMove(e: PointerEvent): void {
    if (this.isDestroyed || !this.canvasRef) return;

    const now = performance.now();

    // If sleeping: wake up startled!
    if (this.isSleeping) {
      this.wakeUp();
    }

    this.lastPointerMoveTime = now;
    this.hasYawnedThisIdle = false;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.5;

    const dx = (e.clientX - centerX) / (window.innerWidth * 0.5);
    const dy = (e.clientY - centerY) / (window.innerHeight * 0.5);

    // Smooth clamped target angles
    this.targetRotY = Math.max(-0.45, Math.min(0.45, dx * 0.6));
    this.targetRotX = Math.max(-0.30, Math.min(0.30, dy * 0.5));
  }

  onPointerEnter(): void {
    this.isHovered = true;
  }

  onPointerLeave(): void {
    this.isHovered = false;
  }

  /**
   * Main 60 FPS Render Loop.
   */
  private animate(): void {
    if (this.isDestroyed) return;

    const now = performance.now();
    const time = now * 0.001;
    const dt = 0.016;

    const isSpeaking = this.audioService.isAiSpeaking() || this.isSpeaking;
    const idleTime = now - this.lastPointerMoveTime;

    // ─────────────────────────────────────────────────────────────
    // 1. INACTIVITY STAGES: Yawn (~16s) & Sleep (~32s)
    // ─────────────────────────────────────────────────────────────
    if (!isSpeaking) {
      // Yawn trigger after ~16s of idle
      if (idleTime > 16000 && !this.hasYawnedThisIdle && !this.isYawning && !this.isSleeping) {
        this.triggerYawn();
      }

      // Sleep trigger after ~32s of idle
      if (idleTime > 32000 && !this.isSleeping && !this.isYawning) {
        this.isSleeping = true;
      }
    }

    // Sleep amount interpolation (0 -> 1 when sleeping, 1 -> 0 when awake)
    const targetSleep = this.isSleeping ? 1.0 : 0.0;
    this.sleepAmount += (targetSleep - this.sleepAmount) * 0.05;

    // Yawn progression
    if (this.isYawning) {
      const elapsed = now - this.yawnStartTime;
      const progress = Math.min(1.0, elapsed / this.yawnDuration);
      // Sine bell curve: 0 -> 1 -> 0
      this.yawnAmount = Math.sin(progress * Math.PI);
      if (progress >= 1.0) {
        this.isYawning = false;
        this.yawnAmount = 0;
      }
    } else {
      this.yawnAmount = 0;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. RANDOM BLINKING & STARTLED WAKEUP BLINK
    // ─────────────────────────────────────────────────────────────
    let activeBlink = 0;

    // Startled double-blink countdown on wakeup
    if (this.startledTimer > 0) {
      this.startledTimer -= dt * 1000;
      // Fast fluttering blink: 2 rapid blinks
      const flutter = Math.abs(Math.sin((this.startledTimer / 850) * Math.PI * 4));
      activeBlink = flutter;
    } else if (this.isBlinking) {
      this.blinkProgress += dt * (1000 / this.blinkDuration);
      if (this.blinkProgress >= 1.0) {
        this.isBlinking = false;
        this.blinkProgress = 0;
        this.nextBlinkTime = now + 3000 + Math.random() * 4500;
      } else {
        activeBlink = Math.sin(this.blinkProgress * Math.PI);
      }
    } else if (now > this.nextBlinkTime && !this.isSleeping) {
      this.triggerBlink();
    }

    // Eyes closed when sleeping, squinted when yawning
    const totalBlink = Math.min(1.0, Math.max(activeBlink, this.sleepAmount, this.yawnAmount * 0.65));

    // ─────────────────────────────────────────────────────────────
    // 3. RANDOM SMILING / GRINNING
    // ─────────────────────────────────────────────────────────────
    if (this.isSmiling) {
      const elapsed = now - this.smileStartTime;
      const progress = elapsed / this.smileDuration;
      if (progress >= 1.0) {
        this.isSmiling = false;
        this.smileAmount = 0;
        this.nextSmileTime = now + 10000 + Math.random() * 12000;
      } else {
        // Smooth trapezoid envelope (ramp up -> hold -> ramp down)
        if (progress < 0.25) {
          this.smileAmount = progress / 0.25;
        } else if (progress < 0.75) {
          this.smileAmount = 1.0;
        } else {
          this.smileAmount = (1.0 - progress) / 0.25;
        }
      }
    } else if (now > this.nextSmileTime && !this.isSleeping && !this.isYawning && !isSpeaking) {
      this.triggerSmile();
    }

    // ─────────────────────────────────────────────────────────────
    // 4. HEAD ROTATION & SWAy (Tracking / Yawn / Sleep / Startled)
    // ─────────────────────────────────────────────────────────────
    let desiredPitch = this.targetRotX;
    let desiredYaw = this.targetRotY;

    if (this.startledTimer > 0) {
      // Startled head snap slightly back/up
      desiredPitch = -0.18;
    } else if (this.sleepAmount > 0.01) {
      // Head droops forward/down in sleep
      desiredPitch = desiredPitch * (1 - this.sleepAmount) + 0.26 * this.sleepAmount;
      desiredYaw = desiredYaw * (1 - this.sleepAmount);
    } else if (this.yawnAmount > 0.01) {
      // Head tilts back slightly during yawn
      desiredPitch -= this.yawnAmount * 0.22;
    }

    const lerpFactor = this.startledTimer > 0 ? 0.2 : 0.07;
    this.currentRotX += (desiredPitch - this.currentRotX) * lerpFactor;
    this.currentRotY += (desiredYaw - this.currentRotY) * lerpFactor;

    // Organic breathing: slower and deeper when sleeping
    const breathSpeed = this.sleepAmount > 0.5 ? 0.75 : 1.5;
    const breathAmp = this.sleepAmount > 0.5 ? 0.05 : 0.035;
    const breathY = Math.sin(time * breathSpeed) * breathAmp;
    const swayZ = Math.sin(time * (breathSpeed * 0.5)) * 0.02;

    this.headGroup.position.y = -0.16 + breathY;
    this.headGroup.rotation.x = this.currentRotX;
    this.headGroup.rotation.y = this.currentRotY;
    this.headGroup.rotation.z = swayZ;

    // ─────────────────────────────────────────────────────────────
    // 5. UPDATE BACKGROUND DISPERSION PARTICLES & LEITERBAHNEN
    // ─────────────────────────────────────────────────────────────
    // Slow down dispersion speed in sleep mode
    const dispersionSpeed = 1.0 - this.sleepAmount * 0.55;
    this.updateDispersionParticles(dt, dispersionSpeed);
    this.updateCircuitPulses(now, dt, isSpeaking);

    // ─────────────────────────────────────────────────────────────
    // 6. AUDIO-REACTIVE LIP SYNC & DEFORMATION
    // ─────────────────────────────────────────────────────────────
    let targetMouthOpen = this.audioService.getAiSpeechAmplitude();
    if (this.isSpeaking && targetMouthOpen < 0.05) {
      // Synthesize rhythmic speech lip movement while isSpeaking input is true
      const speechTime = now * 0.015;
      const syllable = Math.sin(speechTime * 1.5) * 0.4 + Math.sin(speechTime * 3.1) * 0.3 + 0.35;
      targetMouthOpen = Math.max(0.08, Math.min(0.95, syllable));
    }
    const mouthLerp = targetMouthOpen > this.mouthOpenAmount ? 0.35 : 0.18;
    this.mouthOpenAmount += (targetMouthOpen - this.mouthOpenAmount) * mouthLerp;

    // Combined mouth opening (speech + refined yawn, restrained so it doesn't sag too far)
    const effectiveMouthOpen = Math.max(this.mouthOpenAmount * 0.12, this.yawnAmount * 0.11);
    const effectiveForward = Math.max(this.mouthOpenAmount * 0.02, this.yawnAmount * 0.025);

    if (this.facePoints && this.basePositions) {
      const posAttr = this.facePoints.geometry.attributes['position'] as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const count = this.mouthWeights.length;

      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        let x = this.basePositions[idx];
        let y = this.basePositions[idx + 1];
        let z = this.basePositions[idx + 2];

        // 1. Mouth opening (speech or yawn)
        const mWeight = this.mouthWeights[i];
        if (mWeight > 0 && effectiveMouthOpen > 0.001) {
          y -= mWeight * effectiveMouthOpen;
          z += mWeight * effectiveForward;
        }

        // 2. Grin / Smile (mouth corners curve upward and slightly outward)
        const sWeight = this.smileWeights[i];
        if (sWeight > 0 && this.smileAmount > 0.001) {
          y += sWeight * this.smileAmount * 0.042;
          x += Math.sign(x) * sWeight * this.smileAmount * 0.016;
          z += sWeight * this.smileAmount * 0.01;
        }

        // 3. Eye blinking / sleeping / squinting
        const eWeight = this.eyeWeights[i];
        if (eWeight > 0 && totalBlink > 0.001) {
          const eyeCenterY = 0.13;
          // Flatten eye vertically toward horizontal center line
          y = eyeCenterY + (y - eyeCenterY) * (1 - totalBlink * 0.94);
        }

        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;
      }
      posAttr.needsUpdate = true;

      // Glow & Opacity modulation
      const mat = this.facePoints.material as THREE.PointsMaterial;
      if (this.startledTimer > 0) {
        // Bright startled flash
        mat.opacity = 1.0;
        mat.size = 0.084;
      } else if (isSpeaking) {
        const pulse = Math.sin(time * 18) * 0.08;
        mat.opacity = 0.96 + pulse;
        mat.size = 0.076 + this.mouthOpenAmount * 0.012;
      } else if (this.sleepAmount > 0.05) {
        // Dimmed standby glow in sleep mode
        mat.opacity = 0.94 - this.sleepAmount * 0.32; // down to ~0.62
        mat.size = 0.070;
      } else {
        mat.opacity = this.isHovered ? 1.0 : 0.94;
        mat.size = 0.076;
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }
}
