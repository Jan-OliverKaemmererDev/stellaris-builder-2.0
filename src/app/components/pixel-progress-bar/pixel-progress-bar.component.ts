import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pixel-progress-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pixel-progress-bar.component.html',
  styleUrl: './pixel-progress-bar.component.scss'
})
export class PixelProgressBarComponent implements OnInit, OnDestroy {
  @Input() finishTime: number = 0;
  @Input() totalDurationMs: number = 3000;
  @Input() color: string = 'var(--color-credits)';
  @Output() completed = new EventEmitter<void>();

  progress: number = 0;
  remainingDisplay: string = '';
  percentDisplay: string = '0%';
  isCompleted: boolean = false;
  
  private animationFrameId: number | null = null;
  private completionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private hasCompleted: boolean = false;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit(): void {
    // Run animation outside Angular zone to prevent excessive change detection cycles
    this.ngZone.runOutsideAngular(() => {
      this.tick();
    });
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.completionTimeoutId !== null) {
      clearTimeout(this.completionTimeoutId);
    }
  }

  private tick = () => {
    if (this.hasCompleted) return;

    const remainingMs = Math.max(0, this.finishTime - Date.now());
    const duration = this.totalDurationMs > 0 ? this.totalDurationMs : 3000;
    const rawProgress = 100 - (remainingMs / duration) * 100;
    const currentProgress = Math.min(100, Math.max(0, rawProgress));
    
    const remainingSeconds = (remainingMs / 1000).toFixed(1);

    // Update state and manually trigger change detection for these specific fields
    this.progress = currentProgress;
    this.percentDisplay = `${Math.floor(currentProgress)}%`;
    this.remainingDisplay = `${remainingSeconds}s`;
    this.cdr.detectChanges();

    if (currentProgress >= 100) {
      this.hasCompleted = true;
      this.isCompleted = true;
      this.percentDisplay = '100%';
      this.remainingDisplay = '0.0s';
      this.cdr.detectChanges();

      this.completionTimeoutId = setTimeout(() => {
        this.ngZone.run(() => {
          this.completed.emit();
        });
      }, 250);
    } else {
      this.animationFrameId = requestAnimationFrame(this.tick);
    }
  };
}

