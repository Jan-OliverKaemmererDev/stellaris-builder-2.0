import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

/**
 * Inline component that animates a numeric value transition using `requestAnimationFrame`.
 * Uses an ease-out cubic easing curve for smooth visual feedback.
 */
@Component({
  selector: 'app-animated-number',
  standalone: true,
  imports: [DecimalPipe],
  template: '{{ displayValue() | number }}',
})
export class AnimatedNumberComponent implements OnChanges {
  /** The target numeric value to display. */
  @Input() value = 0;

  /** Animation duration in milliseconds. */
  @Input() duration = 1000;

  /** The currently displayed (interpolated) value. */
  displayValue = signal(0);

  private currentVal = 0;
  private animationFrameId?: number;

  /** Triggers animation when the `value` input changes after the first render. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      if (changes['value'].isFirstChange()) {
        this.currentVal = this.value;
        this.displayValue.set(this.value);
      } else {
        this.animateTo(this.value);
      }
    }
  }

  /**
   * Starts a `requestAnimationFrame` loop to smoothly interpolate toward `target`.
   * @param target - The target value to animate to.
   */
  private animateTo(target: number): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    const startVal = this.currentVal;
    const distance = target - startVal;
    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / this.duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      this.currentVal = Math.round(startVal + distance * ease);
      this.displayValue.set(this.currentVal);
      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }
}
