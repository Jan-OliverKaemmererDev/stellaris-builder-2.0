import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LegalNotice } from './legal-notice';

/**
 * Test suite for the LegalNotice component.
 * Verifies that the legal notice page is correctly instantiated.
 */
describe('LegalNotice', () => {
  let component: LegalNotice;
  let fixture: ComponentFixture<LegalNotice>;

  /**
   * Sets up the testing module and compiles the component before each test.
   * Also instantiates the component and waits for the fixture to stabilize.
   */
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LegalNotice],
    }).compileComponents();

    fixture = TestBed.createComponent(LegalNotice);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  /**
   * Verifies that the component is successfully created.
   */
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the Pixabay links for background music', () => {
    const deepSpaceLink: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="https://pixabay.com/music/ambient-deep-space-587580/"]'
    );
    expect(deepSpaceLink).toBeTruthy();
    expect(deepSpaceLink?.textContent).toContain('Pixabay (The Mountain – Deep Space)');

    const universfieldLink: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="https://pixabay.com/music/ambient-deep-space-ambient-153309/"]'
    );
    expect(universfieldLink).toBeTruthy();
    expect(universfieldLink?.textContent).toContain('Pixabay (Universfield – Deep Space Ambient)');
  });
});
