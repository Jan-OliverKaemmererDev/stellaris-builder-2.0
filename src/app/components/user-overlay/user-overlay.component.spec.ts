import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserOverlayComponent } from './user-overlay.component';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { GameStateService } from '../../services/game-state.service';
import { signal } from '@angular/core';

describe('UserOverlayComponent', () => {
  let component: UserOverlayComponent;
  let fixture: ComponentFixture<UserOverlayComponent>;

  const mockAuth = {
    currentUser: {
      uid: 'test-user-123',
      displayName: 'Test Commander',
      email: 'commander@stellaris.space',
      isAnonymous: false,
    },
  };

  const mockFirestore = {};

  const mockRouter = {
    navigate: vi.fn(),
  };

  const mockGameState = {
    resetGameState: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserOverlayComponent],
      providers: [
        { provide: Auth, useValue: mockAuth },
        { provide: Firestore, useValue: mockFirestore },
        { provide: Router, useValue: mockRouter },
        { provide: GameStateService, useValue: mockGameState },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserOverlayComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create and populate initial commander name and email', () => {
    expect(component).toBeTruthy();
    expect(component.commanderName()).toBe('Test Commander');
    expect(component.email()).toBe('commander@stellaris.space');
    expect(component.isGuest()).toBe(false);
  });

  it('should toggle password visibility for new and current password', () => {
    expect(component.showNewPassword()).toBe(false);
    component.toggleNewPassword();
    expect(component.showNewPassword()).toBe(true);

    expect(component.showCurrentPassword()).toBe(false);
    component.toggleCurrentPassword();
    expect(component.showCurrentPassword()).toBe(true);
  });

  it('should open and close confirmation modals', () => {
    expect(component.confirmModal()).toBeNull();

    component.openConfirmModal('delete');
    expect(component.confirmModal()).toBe('delete');

    component.closeConfirmModal();
    expect(component.confirmModal()).toBeNull();

    component.openConfirmModal('reset');
    expect(component.confirmModal()).toBe('reset');
  });

  it('should emit close event when onClose is called', () => {
    const spy = vi.spyOn(component.close, 'emit');
    component.onClose();
    expect(spy).toHaveBeenCalled();
  });
});
