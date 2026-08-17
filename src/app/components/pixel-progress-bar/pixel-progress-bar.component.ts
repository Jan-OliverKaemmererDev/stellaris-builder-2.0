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
  
  private animationFrameId: number | null = null;
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
  }

  private tick = () => {
    if (this.hasCompleted) return;

    const remainingMs = Math.max(0, this.finishTime - Date.now());
    const rawProgress = 100 - (remainingMs / this.totalDurationMs) * 100;
    const currentProgress = Math.min(100, Math.max(0, rawProgress));
    
    const remainingSeconds = (remainingMs / 1000).toFixed(1);

    // Update state and manually trigger change detection for these specific fields
    this.progress = currentProgress;
    this.remainingDisplay = `${remainingSeconds}s`;
    this.cdr.detectChanges();

    if (currentProgress >= 100) {
      this.hasCompleted = true;
      this.ngZone.run(() => {
        this.completed.emit();
      });
    } else {
      this.animationFrameId = requestAnimationFrame(this.tick);
    }
  };
}
