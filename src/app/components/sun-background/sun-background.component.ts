import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnInit, NgZone, HostListener } from '@angular/core';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

@Component({
  selector: 'app-sun-background',
  standalone: true,
  templateUrl: './sun-background.html',
  styleUrls: ['./sun-background.scss']
})
/**
 * Component that renders an interactive 3D sun background.
 * Uses Three.js to render a sun, planets, light waves, and a starfield.
 */
export class SunBackgroundComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasElement', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  isMobile = false;
  private readonly MOBILE_BREAKPOINT = 768;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private animationId: number | null = null;
  private clock = new THREE.Clock();

  private sunMesh!: THREE.Mesh;
  private lightWaves: THREE.Mesh[] = [];
  private planets: { mesh: THREE.Mesh, distance: number, speed: number, angle: number }[] = [];
  private stars!: THREE.Points;
  
  private cameraAngle = 0;
  private cameraRadius = 55;
  private cameraHeight = 12;
  private orbitSpeed = 0.015;

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    this.checkMobile();
  }

  ngAfterViewInit(): void {
    if (!this.isMobile) {
      this.initThreeJs();
      this.ngZone.runOutsideAngular(() => {
        this.animate();
      });
    }
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth <= this.MOBILE_BREAKPOINT;
  }

  private initThreeJs(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020104, 0.015);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    
    const renderScene = new RenderPass(this.scene, this.camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 2.0, 0.5, 0.1);
    
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);

    this.createStars();
    this.createSun();
    this.createPlanets();
    this.setupLighting();
  }

  private createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 5000;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const color1 = new THREE.Color(0x38bdf8);
    const color2 = new THREE.Color(0xffffff);
    
    for (let i = 0; i < starCount; i++) {
      const r = 100 + Math.random() * 300;
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      starPositions[i * 3] = x;
      starPositions[i * 3 + 1] = y;
      starPositions[i * 3 + 2] = z;

      const mixedColor = color1.clone().lerp(color2, Math.random());
      starColors[i * 3] = mixedColor.r;
      starColors[i * 3 + 1] = mixedColor.g;
      starColors[i * 3 + 2] = mixedColor.b;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 0.7,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    });

    this.stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.stars);
  }

  private createSun() {
    const geometry = new THREE.SphereGeometry(8, 64, 64);
    
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x4facfe,
    });
    
    this.sunMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.sunMesh);

    const coronaGeo = new THREE.SphereGeometry(9, 64, 64);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide
    });
    const corona = new THREE.Mesh(coronaGeo, coronaMat);
    this.scene.add(corona);

    // Create expanding light waves
    for (let i = 0; i < 3; i++) {
      const waveMat = new THREE.MeshBasicMaterial({
        color: 0x00f2fe,
        transparent: true,
        opacity: 0,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const wave = new THREE.Mesh(geometry, waveMat);
      // Stagger the initial scale of the waves (1.0 to 2.5)
      const initialScale = 1.0 + (i * 0.5);
      wave.scale.set(initialScale, initialScale, initialScale);
      this.scene.add(wave);
      this.lightWaves.push(wave);
    }
  }

  private createPlanets() {
    this.addPlanet(1.2, 0x111111, 15, 0.1);
    this.addPlanet(2.5, 0x222222, 25, 0.05);
    this.addPlanet(0.8, 0x050505, 35, 0.02);
  }

  private addPlanet(radius: number, colorHex: number, distance: number, speed: number) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({ 
      color: colorHex,
      roughness: 0.9,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);
    
    const angle = Math.random() * Math.PI * 2;
    mesh.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
    
    this.scene.add(mesh);
    this.planets.push({ mesh, distance, speed, angle });
  }

  private setupLighting() {
    const pointLight = new THREE.PointLight(0x4facfe, 1000, 200);
    pointLight.position.set(0, 0, 0);
    this.scene.add(pointLight);

    const ambientLight = new THREE.AmbientLight(0x0a1525, 0.2);
    this.scene.add(ambientLight);
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    
    if (this.stars) {
      this.stars.rotation.y += 0.002 * delta;
    }

    this.planets.forEach(p => {
      p.angle += p.speed * delta;
      p.mesh.position.x = Math.cos(p.angle) * p.distance;
      p.mesh.position.z = Math.sin(p.angle) * p.distance;
      p.mesh.position.y = Math.sin(p.angle * 2) * (p.distance * 0.1);
    });

    // Extremely slow light waves
    this.lightWaves.forEach(wave => {
      let s = wave.scale.x;
      s += delta * 0.08; // very slow expansion
      if (s > 2.5) {
        s = 1.0; // reset to sun surface
      }
      wave.scale.set(s, s, s);
      
      // Fade out as it expands (starts at opacity 0.05, fades to 0)
      const opacity = Math.max(0, (2.5 - s) / 1.5 * 0.05);
      (wave.material as THREE.MeshBasicMaterial).opacity = opacity;
    });

    this.cameraAngle += this.orbitSpeed * delta;
    this.camera.position.x = Math.cos(this.cameraAngle) * this.cameraRadius;
    this.camera.position.z = Math.sin(this.cameraAngle) * this.cameraRadius;
    this.camera.position.y = this.cameraHeight + Math.sin(this.cameraAngle * 0.5) * 5;
    this.camera.lookAt(0, 0, 0);

    this.composer.render();
  };

  @HostListener('window:resize')
  onWindowResize(): void {
    const wasMobile = this.isMobile;
    this.checkMobile();

    if (this.isMobile !== wasMobile) {
      if (this.isMobile) {
        this.destroyThreeJs();
      } else {
        setTimeout(() => {
          this.initThreeJs();
          this.ngZone.runOutsideAngular(() => {
            this.animate();
          });
        }, 0);
      }
    }

    if (!this.isMobile && this.camera && this.renderer && this.composer) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  private destroyThreeJs(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.scene) {
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(m => m.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  ngOnDestroy(): void {
    this.destroyThreeJs();
  }
}
