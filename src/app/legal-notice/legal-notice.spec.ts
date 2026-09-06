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

  it('should render the YouTube link for Galactic', () => {
    const galacticLink: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="https://www.youtube.com/watch?v=rzgR40IceRM"]'
    );
    expect(galacticLink).toBeTruthy();
    expect(galacticLink?.textContent).toContain('YouTube-Video (Galactic)');
  });
});
