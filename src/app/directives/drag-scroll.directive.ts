import { Directive, ElementRef, HostListener, inject, Renderer2, OnDestroy } from '@angular/core';

/**
 * DragScrollDirective enables horizontal drag-to-scroll functionality with the mouse
 * on scrollable containers like building-row or mine-row.
 * 
 * Interactive elements (buttons, images opening lightbox, inputs) are excluded
 * from initiating the drag to ensure their standard click behaviors remain intact.
 */
@Directive({
  selector: '[appDragScroll]',
  standalone: true,
})
export class DragScrollDirective implements OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private renderer = inject(Renderer2);

  private isDown = false;
  private startX = 0;
  private scrollLeft = 0;
  private hasDragged = false;

  private unlistenMouseMove: (() => void) | null = null;
  private unlistenMouseUp: (() => void) | null = null;

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    // Only handle primary (left) mouse button
    if (event.button !== 0) return;

    // Exclude clicks on interactive elements (e.g. build buttons, lightbox images)
    const target = event.target as HTMLElement | null;
    if (this.isInteractiveElement(target)) {
      return;
    }

    this.isDown = true;
    this.hasDragged = false;
    const nativeEl = this.el.nativeElement;

    this.startX = event.pageX - nativeEl.offsetLeft;
    this.scrollLeft = nativeEl.scrollLeft;

    this.renderer.addClass(nativeEl, 'is-dragging');

    // Attach window/document-level listeners for smooth drag even outside container bounds
    this.addDocumentListeners();
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    if (this.hasDragged) {
      event.preventDefault();
      event.stopPropagation();
      this.hasDragged = false;
    }
  }

  private isInteractiveElement(target: HTMLElement | null): boolean {
    if (!target) return false;

    return !!target.closest(
      'button, .upgrade-btn, .build-btn, figure.node-image-wrap, .node-image-wrap, [role="button"], input, select, textarea, a'
    );
  }

  private addDocumentListeners(): void {
    this.removeDocumentListeners();

    this.unlistenMouseMove = this.renderer.listen('document', 'mousemove', (event: MouseEvent) => {
      if (!this.isDown) return;

      const nativeEl = this.el.nativeElement;
      const x = event.pageX - nativeEl.offsetLeft;
      const distance = x - this.startX;

      if (Math.abs(distance) > 4) {
        this.hasDragged = true;
        event.preventDefault();
      }

      nativeEl.scrollLeft = this.scrollLeft - distance;
    });

    this.unlistenMouseUp = this.renderer.listen('document', 'mouseup', () => {
      if (this.isDown) {
        this.isDown = false;
        this.renderer.removeClass(this.el.nativeElement, 'is-dragging');
        this.removeDocumentListeners();
      }
    });
  }

  private removeDocumentListeners(): void {
    if (this.unlistenMouseMove) {
      this.unlistenMouseMove();
      this.unlistenMouseMove = null;
    }
    if (this.unlistenMouseUp) {
      this.unlistenMouseUp();
      this.unlistenMouseUp = null;
    }
  }

  ngOnDestroy(): void {
    this.removeDocumentListeners();
  }
}
