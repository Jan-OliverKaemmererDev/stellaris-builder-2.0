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
