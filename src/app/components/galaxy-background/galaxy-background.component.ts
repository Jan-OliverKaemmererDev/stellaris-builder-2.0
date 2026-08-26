import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnInit, NgZone, HostListener } from '@angular/core';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

@Component({
  selector: 'app-galaxy-background',
  standalone: true,
  templateUrl: './galaxy-background.html',
  styleUrls: ['./galaxy-background.scss']
})
export class GalaxyBackgroundComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasElement', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  isMobile = false;
  private readonly MOBILE_BREAKPOINT = 768;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private animationId: number | null = null;
  private clock = new THREE.Clock();

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-999, -999);
  private mouseLocalPos = new THREE.Vector3(0, 0, 0);
  private targetMouseLocalPos = new THREE.Vector3(0, 0, 0);
  private isMouseHovering = false;
  
  private shaderUniforms = {
    uMouse: { value: new THREE.Vector3(0, 0, 0) },
    uTime: { value: 0 },
    uHoverState: { value: 0.0 }
  };

  private mainGalaxy!: THREE.Points;
  private backgroundStars!: THREE.Points;
  private distantGalaxies: THREE.Points[] = [];
  
  private cameraAngle = 0;
  private orbitSpeed = 0.003; // Slowed down from 0.01 for a more majestic camera orbit

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
    this.scene.fog = new THREE.FogExp2(0x020104, 0.0015); // Reduced fog density so background stars are visible

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000); // Increased far plane
    this.camera.position.set(0, 20, 40);
    this.camera.lookAt(0, 0, 0);
    
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    
    const renderScene = new RenderPass(this.scene, this.camera);
    // Subtle bloom
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.2);
    
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);

    this.createBackgroundStars();
    this.createMainGalaxy();
    this.createDistantGalaxies();
  }

  private createBackgroundStars() {
    const starCount = 15000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const color1 = new THREE.Color(0x38bdf8); // Light blue
    const color2 = new THREE.Color(0xffffff); // White
    const color3 = new THREE.Color(0xffddaa); // Warm orange
    
    for (let i = 0; i < starCount; i++) {
      // Create a very distant sphere of stars
      const r = 400 + Math.random() * 1200;
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      let mixedColor;
      const rand = Math.random();
      if (rand < 0.4) mixedColor = color1.clone();
      else if (rand < 0.8) mixedColor = color2.clone();
      else mixedColor = color3.clone();

      // Randomize brightness
      mixedColor.multiplyScalar(0.4 + Math.random() * 0.6);

      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom circular texture for glowing background stars
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(4, 4, 0, 4, 4, 4);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 8, 8);
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 3.5, // Larger size because they are very far away
      vertexColors: true,
      transparent: true,
      map: texture,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.backgroundStars = new THREE.Points(geometry, material);
    this.scene.add(this.backgroundStars);
  }

  private createMainGalaxy() {
    const parameters = {
      count: 120000,
      size: 0.15,
      radius: 45,
      branches: 2, // 2 prominent arms like the reference image
      spin: 0.15, // Sweeping arm
      randomness: 0.35, // Middle ground scatter
      randomnessPower: 2.5, // Middle ground power
      insideColor: '#ffeecb', // Bright yellowish core
      outsideColor: '#1044ff' // Deep blue
    };

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(parameters.count * 3);
    const colors = new Float32Array(parameters.count * 3);
    const colorInside = new THREE.Color(parameters.insideColor);
    const colorOutside = new THREE.Color(parameters.outsideColor);
    
    // Core glow (central sphere)
    const coreCount = 20000;
    const discCount = 50000; // General glowing disc to fill gaps

    for (let i = 0; i < parameters.count; i++) {
      const i3 = i * 3;

      let x, y, z;
      let mixedColor;

      if (i < coreCount) {
        // Create a dense spherical core
        const r = Math.pow(Math.random(), 2) * 7;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta) * 0.6; // slightly flattened
        z = r * Math.cos(phi);
        mixedColor = colorInside.clone();
      } else if (i < coreCount + discCount) {
        // General galaxy disc to fill gaps between arms
        const radius = Math.pow(Math.random(), 1.5) * parameters.radius;
        const angle = Math.random() * Math.PI * 2;
        
        x = Math.cos(angle) * radius;
        y = (Math.random() - 0.5) * 2 * (radius < 10 ? 2 : 0.5); // Slightly thicker near center
        z = Math.sin(angle) * radius;
        
        mixedColor = colorInside.clone().lerp(colorOutside, Math.min(1, radius / parameters.radius));
        // Tone down disc stars slightly so they don't overpower the arms
        mixedColor.multiplyScalar(0.6);
      } else {
        // Spiral arms - more particles near the center
        const radius = Math.pow(Math.random(), 1.2) * parameters.radius;
        const spinAngle = radius * parameters.spin;
        const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2;

        const randomX = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;
        const randomY = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;
        const randomZ = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;

        x = Math.cos(branchAngle + spinAngle) * radius + randomX;
        y = randomY * 0.2; 
        z = Math.sin(branchAngle + spinAngle) * radius + randomZ;

        mixedColor = colorInside.clone().lerp(colorOutside, Math.min(1, radius / (parameters.radius * 0.8)));

        // Occasional bright blue clusters in the arms
        if (radius > 10 && Math.random() > 0.95) {
            mixedColor.setHex(0x88ccff);
        }
        // Dark dust lanes
        if (radius > 5 && Math.random() > 0.8) {
            mixedColor.setHex(0x221100);
        }
      }

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 16, 16);
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: parameters.size,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: texture,
      transparent: true,
      opacity: 0.95
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms['uMouse'] = this.shaderUniforms.uMouse;
      shader.uniforms['uTime'] = this.shaderUniforms.uTime;
      shader.uniforms['uHoverState'] = this.shaderUniforms.uHoverState;

      shader.vertexShader = `
        uniform vec3 uMouse;
        uniform float uTime;
        uniform float uHoverState;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        
        vec3 dir = transformed - uMouse;
        // Calculate distance primarily on the XZ plane so depth differences don't break the effect
        float dist = length(vec2(dir.x, dir.z));
        float maxDist = 6.0; 
        
        if (dist < maxDist) {
            float force = (maxDist - dist) / maxDist;
            force = smoothstep(0.0, 1.0, force);
            
            vec3 wobble = vec3(
                sin(uTime * 3.0 + transformed.x * 0.5) * 0.5,
                cos(uTime * 2.5 + transformed.y * 0.5) * 0.5,
                sin(uTime * 4.0 + transformed.z * 0.5) * 0.5
            );
            
            vec3 pushDir = normalize(dir + vec3(0.0001));
            // Reduced amplitude for a slighter, more elegant movement
            transformed += (pushDir * force * 1.5 + wobble * force * 0.8) * uHoverState;
        }
        `
      );
    };

    this.mainGalaxy = new THREE.Points(geometry, material);
    // Tilt the galaxy to face the camera nicely
    this.mainGalaxy.rotation.x = 0.6;
    this.mainGalaxy.rotation.z = -0.3;
    this.scene.add(this.mainGalaxy);
  }

  private createDistantGalaxies() {
    // One prominent distant galaxy
    const distantGalaxy = this.createSmallSpiralGalaxy(120, 60, -200, 20);
    this.distantGalaxies.push(distantGalaxy);
    this.scene.add(distantGalaxy);
  }

  private createSmallSpiralGalaxy(x: number, y: number, z: number, size: number): THREE.Points {
    const count = 15000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    const coreColor = new THREE.Color('#ffddaa');
    const edgeColor = new THREE.Color('#3366ff');
    
    for (let i = 0; i < count; i++) {
      const radius = Math.pow(Math.random(), 1.2) * size;
      const spinAngle = radius * 0.15;
      const branchAngle = (i % 2) / 2 * Math.PI * 2;
      
      const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.4 * radius;
      const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.4 * radius;
      const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.4 * radius;
      
      positions[i * 3] = Math.cos(branchAngle + spinAngle) * radius + randomX + x;
      positions[i * 3 + 1] = randomY * 0.3 + y;
      positions[i * 3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ + z;
      
      const mixedColor = coreColor.clone().lerp(edgeColor, radius / size);
      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(4, 4, 0, 4, 4, 4);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 8, 8);
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
        size: 0.8,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        map: texture,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const galaxy = new THREE.Points(geometry, material);
    galaxy.rotation.x = 0.8;
    galaxy.rotation.y = 0.2;
    return galaxy;
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    
    // Update shader uniforms
    this.shaderUniforms.uTime.value += delta;

    // Raycast to find mouse pos
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    if (this.mainGalaxy) {
        this.mainGalaxy.updateMatrixWorld();
        
        // Transform the camera ray to the galaxy's local space
        const localRay = new THREE.Ray();
        const inverseMatrix = this.mainGalaxy.matrixWorld.clone().invert();
        localRay.copy(this.raycaster.ray).applyMatrix4(inverseMatrix);
        
        // Intersect with the local XZ plane of the galaxy
        const localPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const localIntersect = new THREE.Vector3();
        
        if (localRay.intersectPlane(localPlane, localIntersect)) {
            this.targetMouseLocalPos.copy(localIntersect);
        }

        // Smoothly interpolate mouse local pos for a trailing effect
        this.mouseLocalPos.lerp(this.targetMouseLocalPos, 0.1);
        this.shaderUniforms['uMouse'].value.copy(this.mouseLocalPos);
    }

    // Update hover state for smooth entry/exit
    const targetHoverState = this.isMouseHovering ? 1.0 : 0.0;
    this.shaderUniforms['uHoverState'].value += (targetHoverState - this.shaderUniforms['uHoverState'].value) * 0.1;
    
    if (this.backgroundStars) {
      this.backgroundStars.rotation.y += 0.0002 * delta; // Slowed down
    }
    
    if (this.mainGalaxy) {
        this.mainGalaxy.rotation.y += 0.005 * delta; // Slowed down
    }

    this.distantGalaxies.forEach(galaxy => {
        galaxy.rotation.y -= 0.001 * delta; // Slowed down
        galaxy.rotation.x += 0.0005 * delta;
    });

    // Slow orbit of camera
    this.cameraAngle += this.orbitSpeed * delta;
    const r = 40;
    this.camera.position.x = Math.cos(this.cameraAngle) * r;
    this.camera.position.z = Math.sin(this.cameraAngle) * r;
    this.camera.lookAt(0, 0, 0);

    this.composer.render();
  };

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.isMouseHovering = true;
  }

  @HostListener('document:mouseleave', ['$event'])
  onMouseLeave(event: MouseEvent) {
    this.isMouseHovering = false;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const wasMobile = this.isMobile;
    this.checkMobile();

    if (this.isMobile !== wasMobile) {
      if (this.isMobile) {
        this.destroyThreeJs();
      } else {
        // Wait a tick for canvas to be back in DOM if we used *ngIf
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
