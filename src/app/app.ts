import { Component, signal, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root application component that hosts the router outlet. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  /** Application title used for branding. */
  protected readonly title = signal('stellaris-builder-v2');

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
    document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
  }
}
