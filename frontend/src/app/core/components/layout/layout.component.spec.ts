import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { LayoutComponent } from './layout.component';
import { AuthService, UserInfo } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;
  let currentUserSubject: BehaviorSubject<UserInfo | null>;
  let authService: jasmine.SpyObj<AuthService> & { currentUser$: any };
  let notificationService: jasmine.SpyObj<NotificationService> & { unreadCount$: any };

  function setupWithRole(role: 'superadmin' | 'manager' | 'engineer' | 'client') {
    const user: UserInfo = { id: 1, email: `${role}@test.com`, first_name: 'Test', last_name: 'User', role, organization_id: role === 'superadmin' ? null : 1 };
    currentUserSubject.next(user);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    currentUserSubject = new BehaviorSubject<UserInfo | null>(null);
    authService = {
      ...jasmine.createSpyObj('AuthService', ['logout']),
      currentUser$: currentUserSubject.asObservable(),
    } as any;
    notificationService = {
      ...jasmine.createSpyObj('NotificationService', ['list', 'markAsRead', 'markAllAsRead', 'refreshUnreadCount']),
      unreadCount$: new BehaviorSubject<number>(0).asObservable(),
    } as any;
    notificationService.list.and.returnValue(of({ count: 0, next: null, previous: null, results: [] }));
    notificationService.markAsRead.and.returnValue(of({}));
    notificationService.markAllAsRead.and.returnValue(of({ updated_count: 0 }));

    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('nav item filtering', () => {
    it('should show Tasks, Kanban, Clients, Calendar, Reports, Users for manager', () => {
      setupWithRole('manager');

      const labels = component.filteredNavItems.map((i) => i.label);
      expect(labels).toContain('Tasks');
      expect(labels).toContain('Kanban');
      expect(labels).toContain('Clients');
      expect(labels).toContain('Calendar');
      expect(labels).toContain('Reports');
      expect(labels).toContain('Users');
      expect(labels).not.toContain('My Tickets');
    });

    it('should show only Tasks, Kanban for engineer', () => {
      setupWithRole('engineer');

      const labels = component.filteredNavItems.map((i) => i.label);
      expect(labels).toEqual(['Tasks', 'Kanban']);
    });

    it('should show only My Tickets for client', () => {
      setupWithRole('client');

      const labels = component.filteredNavItems.map((i) => i.label);
      expect(labels).toEqual(['My Tickets']);
    });

    it('should show no nav items when user is null', () => {
      currentUserSubject.next(null);
      fixture.detectChanges();

      expect(component.filteredNavItems.length).toBe(0);
    });
  });

  describe('currentUser', () => {
    it('should update currentUser from subscription', () => {
      setupWithRole('manager');
      expect(component.currentUser?.role).toBe('manager');
    });
  });

  describe('logout', () => {
    it('should call authService.logout', () => {
      fixture.detectChanges();
      component.logout();
      expect(authService.logout).toHaveBeenCalled();
    });
  });
});
