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
  /** The target numeric value to display and animate towards. */
  @Input() value = 0;

  /** The total duration of the animation in milliseconds. */
  @Input() duration = 1000;

  /** A signal holding the currently displayed (interpolated) value. */
  displayValue = signal(0);

  /** The internal numeric value used to track the current animation state. */
  private currentVal = 0;

  /** The identifier for the current `requestAnimationFrame` callback. */
  private animationFrameId?: number;

  /**
   * Lifecycle hook that triggers the animation when the `value` input changes.
   * @param changes - The changes object containing input property updates.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.handleValueChange(changes['value'].isFirstChange());
    }
  }

  /**
   * Handles the value change logic, either setting it immediately or animating.
   * @param isFirstChange - Indicates if this is the first time the value is set.
   */
  private handleValueChange(isFirstChange: boolean): void {
    if (isFirstChange) {
      this.currentVal = this.value;
      this.displayValue.set(this.value);
    } else {
      this.animateTo(this.value);
    }
  }

  /**
   * Starts an animation loop to smoothly interpolate toward the given target.
   * @param target - The final numeric value to reach.
   */
  private animateTo(target: number): void {
    this.cancelExistingAnimation();
    const startVal = this.currentVal;
    const distance = target - startVal;
    const startTime = performance.now();

    const step = (now: number) => this.animationStep(now, startTime, startVal, distance);
    this.animationFrameId = requestAnimationFrame(step);
  }

  /**
   * Cancels any currently running animation frame to prevent overlapping updates.
   */
  private cancelExistingAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  /**
   * Executes a single animation frame, updating the display value.
   * @param currentTime - The current high-res timestamp.
   * @param startTime - The high-res timestamp when the animation began.
   * @param startVal - The numeric value when the animation started.
   * @param distance - The total numeric difference between start and target.
   */
  private animationStep(currentTime: number, startTime: number, startVal: number, distance: number): void {
    const progress = Math.min((currentTime - startTime) / this.duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    this.currentVal = Math.round(startVal + distance * ease);
    this.displayValue.set(this.currentVal);
    
    if (progress < 1) {
      const nextStep = (now: number) => this.animationStep(now, startTime, startVal, distance);
      this.animationFrameId = requestAnimationFrame(nextStep);
    }
  }
}
