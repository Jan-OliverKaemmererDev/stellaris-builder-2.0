import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-animated-number',
  standalone: true,
  imports: [DecimalPipe],
  template: '{{ displayValue() | number }}'
})
export class AnimatedNumberComponent implements OnChanges {
  @Input() value = 0;
  @Input() duration = 1000;
  
  displayValue = signal(0);
  private currentVal = 0;
  private animationFrameId?: number;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value']) {
      if (changes['value'].isFirstChange()) {
        this.currentVal = this.value;
        this.displayValue.set(this.value);
      } else {
        this.animateTo(this.value);
      }
    }
  }
  
  private animateTo(target: number) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const startVal = this.currentVal;
    const distance = target - startVal;
    const startTime = performance.now();
    
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / this.duration, 1);
      
      // easeOutCubic
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
