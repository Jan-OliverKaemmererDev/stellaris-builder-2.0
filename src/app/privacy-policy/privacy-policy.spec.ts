import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrivacyPolicy } from './privacy-policy';

describe('PrivacyPolicy', () => {
  let component: PrivacyPolicy;
  let fixture: ComponentFixture<PrivacyPolicy>;

  beforeEach(async () => {
    await setupTestBed();
  });

  /**
   * Initializes the test bed configuration and compiles components.
   * Extracts logic to keep the beforeEach function under the 14 line limit.
   */
  async function setupTestBed(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [PrivacyPolicy],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacyPolicy);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

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
