import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';
import { LayoutComponent } from './layout.component';
import { AuthService, UserInfo } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { ProfileService } from '../../services/profile.service';

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;
  let currentUserSubject: BehaviorSubject<UserInfo | null>;
  let authService: jasmine.SpyObj<AuthService> & { currentUser$: any };
  let notificationService: jasmine.SpyObj<NotificationService> & { unreadCount$: any };
  let profileService: jasmine.SpyObj<ProfileService>;

  function setupWithRole(role: 'superadmin' | 'manager' | 'engineer' | 'client') {
    const user: UserInfo = { id: 1, email: `${role}@test.com`, first_name: 'Test', last_name: 'User', role, organization_id: role === 'superadmin' ? null : 1, language: 'en' };
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
    profileService = jasmine.createSpyObj('ProfileService', ['getProfile']);
    profileService.getProfile.and.returnValue(of({
      id: 1, email: 'test@test.com', first_name: 'Test', last_name: 'User',
      role: 'manager', avatar: null, job_title: '', skills: '', bio: '', date_joined: '',
    }));

    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideRouter([]),
        provideTranslateService(),
        { provide: AuthService, useValue: authService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ProfileService, useValue: profileService },
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

      const keys = component.filteredNavItems.map((i) => i.labelKey);
      expect(keys).toContain('nav.tasks');
      expect(keys).toContain('nav.archive');
      expect(keys).toContain('nav.projects');
      expect(keys).toContain('nav.kanban');
      expect(keys).toContain('nav.companies');
      expect(keys).toContain('nav.calendar');
      expect(keys).toContain('nav.analytics');
      expect(keys).toContain('nav.users');
      expect(keys).not.toContain('nav.myTickets');
    });

    it('should show Tasks, Kanban, Reports for engineer', () => {
      setupWithRole('engineer');

      const keys = component.filteredNavItems.map((i) => i.labelKey);
      expect(keys).toEqual(['nav.tasks', 'nav.archive', 'nav.projects', 'nav.kanban', 'nav.analytics']);
    });

    it('should show only My Tickets for client', () => {
      setupWithRole('client');

      const keys = component.filteredNavItems.map((i) => i.labelKey);
      expect(keys).toEqual(['nav.myTickets']);
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
