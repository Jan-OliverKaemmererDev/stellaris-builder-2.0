import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
  inject,
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

  private ngZone = inject(NgZone);
  private audioService = inject(AudioService);

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private headGroup!: THREE.Group;

  private facePoints!: THREE.Points;
  private dispersionPoints!: THREE.Points;

  private basePositions!: Float32Array;
  private mouthWeights!: Float32Array;
  private eyeWeights!: Float32Array;
  private smileWeights!: Float32Array;

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
    this.initThree();
    this.initFaceGeometry();
    this.initDispersionGeometry();

    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', this.pointerMoveHandler, { passive: true });
    }

    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
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
    const size = 200;
    canvas.width = size;
    canvas.height = size;

    this.scene = new THREE.Scene();

    // Closer camera for large, prominent face presence
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
    this.camera.position.set(0, 0, 2.18);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(size, size, false);
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

    // 1. CRANIUM & FOREHEAD (Airy holographic dome)
    for (let phi = 0.2; phi <= Math.PI * 0.46; phi += 0.09) {
      const y = 0.22 + Math.sin(phi) * 0.78;
      const radiusAtY = Math.cos(phi) * 0.62;
      const step = 0.12 / Math.max(0.25, Math.cos(phi));
      for (let theta = -Math.PI * 0.45; theta <= Math.PI * 0.45; theta += step) {
        const x = Math.sin(theta) * radiusAtY;
        const z = Math.cos(theta) * radiusAtY * 0.82 - 0.05;
        const col = (phi > Math.PI * 0.38) ? colSoftCyan : colElectricCyan;
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

    const isSpeaking = this.audioService.isAiSpeaking();
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
    // 5. UPDATE BACKGROUND DISPERSION PARTICLES
    // ─────────────────────────────────────────────────────────────
    // Slow down dispersion speed in sleep mode
    const dispersionSpeed = 1.0 - this.sleepAmount * 0.55;
    this.updateDispersionParticles(dt, dispersionSpeed);

    // ─────────────────────────────────────────────────────────────
    // 6. AUDIO-REACTIVE LIP SYNC & DEFORMATION
    // ─────────────────────────────────────────────────────────────
    const targetMouthOpen = this.audioService.getAiSpeechAmplitude();
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
