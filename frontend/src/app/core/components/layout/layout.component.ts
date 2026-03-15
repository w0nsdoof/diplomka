import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, filter } from 'rxjs';
import { AuthService, UserInfo } from '../../services/auth.service';
import { NotificationService, Notification } from '../../services/notification.service';
import { ProfileService } from '../../services/profile.service';
import { LanguageSwitcherComponent } from '../../../shared/components/language-switcher/language-switcher.component';

interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  roles: string[];
}

@Component({
    selector: 'app-layout',
    imports: [
        CommonModule,
        RouterModule,
        MatSidenavModule,
        MatToolbarModule,
        MatListModule,
        MatIconModule,
        MatButtonModule,
        MatBadgeModule,
        MatMenuModule,
        MatDividerModule,
        TranslateModule,
        LanguageSwitcherComponent,
    ],
    template: `
    <div class="layout-wrapper">
      <!-- Sidebar -->
      <aside class="sidebar" [class.collapsed]="sidebarCollapsed">
        <div class="sidebar-header">
          <span class="sidebar-title" *ngIf="!sidebarCollapsed">{{ 'nav.webAdmin' | translate }}</span>
          <button class="collapse-btn" (click)="toggleSidebar()">
            <mat-icon>{{ sidebarCollapsed ? 'chevron_right' : 'chevron_left' }}</mat-icon>
          </button>
        </div>
        <nav class="sidebar-nav">
          <a *ngFor="let item of filteredNavItems"
             [routerLink]="item.route"
             routerLinkActive="active"
             class="nav-item"
             [title]="sidebarCollapsed ? (item.labelKey | translate) : ''">
            <mat-icon class="nav-icon">{{ item.icon }}</mat-icon>
            <span class="nav-label" *ngIf="!sidebarCollapsed">{{ item.labelKey | translate }}</span>
          </a>
        </nav>
      </aside>

      <!-- Main content -->
      <div class="main-area">
        <!-- Header bar -->
        <header class="header-bar">
          <h1 class="header-title">{{ pageTitle }}</h1>
          <div class="header-actions">
            <app-language-switcher></app-language-switcher>
            <button class="icon-btn" [matMenuTriggerFor]="notifMenu" (click)="loadNotifications()">
              <mat-icon [matBadge]="unreadCount > 0 ? unreadCount : null" matBadgeColor="warn" matBadgeSize="small">
                notifications_none
              </mat-icon>
            </button>
            <mat-menu #notifMenu="matMenu" class="notif-menu">
              <div class="notif-header" style="padding: 8px 16px; display: flex; justify-content: space-between; align-items: center;">
                <strong>{{ 'nav.notifications' | translate }}</strong>
                <button mat-button *ngIf="unreadCount > 0" (click)="markAllRead($event)" style="font-size: 12px;">
                  {{ 'nav.markAllRead' | translate }}
                </button>
              </div>
              <mat-divider></mat-divider>
              <div *ngIf="notifications.length === 0" style="padding: 16px; color: #888; text-align: center;">
                {{ 'nav.noNotifications' | translate }}
              </div>
              <button mat-menu-item *ngFor="let notif of notifications"
                      (click)="onNotificationClick(notif)"
                      [style.opacity]="notif.is_read ? 0.6 : 1"
                      [style.font-weight]="notif.is_read ? 'normal' : '500'">
                <mat-icon>{{ getNotifIcon(notif) }}</mat-icon>
                <span>{{ notif.message }}</span>
              </button>
            </mat-menu>

            <button class="avatar-btn" [matMenuTriggerFor]="userMenu">
              <img *ngIf="avatarUrl" [src]="avatarUrl" alt="avatar" class="user-avatar-img">
              <div *ngIf="!avatarUrl" class="user-avatar">
                {{ currentUser?.first_name?.charAt(0) || '' }}{{ currentUser?.last_name?.charAt(0) || '' }}
              </div>
            </button>
            <mat-menu #userMenu="matMenu">
              <div style="padding: 12px 16px;" *ngIf="currentUser">
                <strong>{{ currentUser.first_name }} {{ currentUser.last_name }}</strong>
                <br /><small style="color: #6b7280;">{{ currentUser.role }}</small>
              </div>
              <mat-divider></mat-divider>
              <button mat-menu-item routerLink="/settings"
                      *ngIf="currentUser && (currentUser.role === 'manager' || currentUser.role === 'engineer')">
                <mat-icon>settings</mat-icon>
                <span>{{ 'nav.settings' | translate }}</span>
              </button>
              <button mat-menu-item (click)="logout()">
                <mat-icon>logout</mat-icon>
                <span>{{ 'nav.logout' | translate }}</span>
              </button>
            </mat-menu>
          </div>
        </header>

        <!-- Page content -->
        <div class="content">
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  `,
    styles: [
        `
      .layout-wrapper {
        display: flex;
        height: 100vh;
        overflow: hidden;
      }

      /* Sidebar */
      .sidebar {
        width: var(--sidebar-width, 260px);
        background: #fff;
        border-right: 1px solid var(--border-color, #e5e7eb);
        display: flex;
        flex-direction: column;
        transition: width 0.2s ease;
        flex-shrink: 0;
        overflow: hidden;
      }

      .sidebar.collapsed {
        width: var(--sidebar-collapsed-width, 64px);
      }

      .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 16px;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
        min-height: 24px;
      }

      .sidebar-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--text-primary, #1a1a1a);
        white-space: nowrap;
      }

      .collapse-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        color: #9ca3af;
        display: flex;
        align-items: center;

        &:hover {
          background: #f3f4f6;
          color: var(--text-primary, #1a1a1a);
        }
      }

      .sidebar-nav {
        flex: 1;
        padding: 8px 0;
        overflow-y: auto;
      }

      .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 20px;
        color: var(--text-secondary, #6b7280);
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.15s;
        border-left: 4px solid transparent;
        margin: 2px 0;
      }

      .nav-item:hover {
        background: #f8fafc;
        color: var(--text-primary, #1a1a1a);
      }

      .nav-item.active {
        background: #f5f7fa;
        color: var(--primary-blue, #1a7cf4);
        border-left-color: var(--primary-blue, #1a7cf4);
      }

      .nav-item.active .nav-icon {
        color: var(--primary-blue, #1a7cf4);
      }

      .nav-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
        color: #9ca3af;
        flex-shrink: 0;
      }

      .nav-label {
        white-space: nowrap;
      }

      .collapsed .nav-item {
        justify-content: center;
        padding: 10px;
        gap: 0;
      }

      /* Header bar */
      .main-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: var(--bg-gray, #f9f9f9);
      }

      .header-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 32px;
        height: var(--header-height, 64px);
        background: #fff;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
        flex-shrink: 0;
      }

      .header-title {
        font-size: 20px;
        font-weight: 600;
        color: var(--text-primary, #1a1a1a);
        margin: 0;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .icon-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        border-radius: 8px;
        color: #6b7280;
        display: flex;
        align-items: center;

        &:hover {
          background: #f3f4f6;
        }
      }

      .avatar-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
      }

      .user-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--primary-blue, #1a7cf4);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .user-avatar-img {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
      }

      /* Content */
      .content {
        flex: 1;
        padding: 24px 32px;
        overflow-y: auto;
      }
    `,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LayoutComponent implements OnInit, OnDestroy {
  currentUser: UserInfo | null = null;
  avatarUrl: string | null = null;
  unreadCount = 0;
  notifications: Notification[] = [];
  filteredNavItems: NavItem[] = [];
  sidebarCollapsed = false;
  pageTitle = '';
  private destroy$ = new Subject<void>();

  private navItems: NavItem[] = [
    { labelKey: 'nav.organizations', icon: 'corporate_fare', route: '/platform/organizations', roles: ['superadmin'] },
    { labelKey: 'nav.tasks', icon: 'table_chart', route: '/tasks', roles: ['manager', 'engineer'] },
    { labelKey: 'nav.archive', icon: 'archive', route: '/tasks/archive', roles: ['manager', 'engineer'] },
    { labelKey: 'nav.kanban', icon: 'view_kanban', route: '/kanban', roles: ['manager', 'engineer'] },
    { labelKey: 'nav.companies', icon: 'apartment', route: '/clients', roles: ['manager'] },
    { labelKey: 'nav.calendar', icon: 'calendar_today', route: '/calendar', roles: ['manager'] },
    { labelKey: 'nav.analytics', icon: 'bar_chart', route: '/reports', roles: ['manager', 'engineer'] },
    { labelKey: 'nav.users', icon: 'people', route: '/admin/users', roles: ['manager'] },
    { labelKey: 'nav.tags', icon: 'label', route: '/admin/tags', roles: ['manager'] },
    { labelKey: 'nav.myTickets', icon: 'confirmation_number', route: '/portal', roles: ['client'] },
  ];

  private routeTitleMap: { [key: string]: string } = {
    '/tasks': 'nav.tasks',
    '/tasks/archive': 'nav.archive',
    '/tasks/new': 'tasks.createTask',
    '/kanban': 'nav.kanban',
    '/clients': 'nav.companies',
    '/calendar': 'nav.calendar',
    '/reports': 'nav.analytics',
    '/admin/users': 'nav.users',
    '/admin/tags': 'nav.tags',
    '/portal': 'nav.myTickets',
    '/platform/organizations': 'nav.organizations',
    '/settings': 'nav.settings',
  };

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private profileService: ProfileService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.filteredNavItems = this.navItems.filter((item) =>
        user ? item.roles.includes(user.role) : false,
      );
      if (user) {
        this.notificationService.refreshUnreadCount();
        this.profileService.getProfile().pipe(takeUntil(this.destroy$)).subscribe((profile) => {
          this.avatarUrl = profile.avatar || null;
          this.cdr.markForCheck();
        });
      }
      this.cdr.markForCheck();
    });

    this.notificationService.unreadCount$.pipe(takeUntil(this.destroy$)).subscribe((count) => {
      this.unreadCount = count;
      this.cdr.markForCheck();
    });

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntil(this.destroy$),
    ).subscribe((e) => {
      this.updatePageTitle(e.urlAfterRedirects);
    });

    this.updatePageTitle(this.router.url);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  loadNotifications(): void {
    this.notificationService.list(undefined, 1).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.notifications = res.results.slice(0, 10);
      this.cdr.markForCheck();
    });
  }

  onNotificationClick(notif: Notification): void {
    if (!notif.is_read) {
      this.notificationService.markAsRead(notif.id).pipe(takeUntil(this.destroy$)).subscribe();
    }

    if (notif.type === 'summary_ready' && notif.summary_id) {
      this.router.navigate(['/reports/summaries', notif.summary_id]);
    } else if (notif.task_id) {
      this.router.navigate(['/tasks', notif.task_id]);
    }
  }

  markAllRead(event: Event): void {
    event.stopPropagation();
    this.notificationService.markAllAsRead().pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.notifications = this.notifications.map((n) => ({ ...n, is_read: true }));
      this.cdr.markForCheck();
    });
  }

  getNotifIcon(notif: Notification): string {
    switch (notif.type) {
      case 'summary_ready': return 'auto_awesome';
      case 'task_assigned': return 'assignment_ind';
      case 'comment_added': return 'comment';
      case 'mention': return 'alternate_email';
      case 'status_changed': return 'sync_alt';
      case 'deadline_warning': return 'warning';
      default: return 'notifications';
    }
  }

  logout(): void {
    this.authService.logout();
  }

  private updatePageTitle(url: string): void {
    const titleKey = this.routeTitleMap[url];
    if (titleKey) {
      this.pageTitle = this.translate.instant(titleKey);
    } else {
      // Check for dynamic routes like /tasks/123, /clients/123
      for (const [route, key] of Object.entries(this.routeTitleMap)) {
        if (url.startsWith(route + '/') || url === route) {
          this.pageTitle = this.translate.instant(key);
          this.cdr.markForCheck();
          return;
        }
      }
      // Fallback for task detail/edit routes
      if (url.match(/^\/tasks\/\d+/)) {
        this.pageTitle = this.translate.instant('nav.tasks');
      } else if (url.match(/^\/clients\/\d+/)) {
        this.pageTitle = this.translate.instant('nav.companies');
      } else if (url.startsWith('/reports')) {
        this.pageTitle = this.translate.instant('nav.analytics');
      } else {
        this.pageTitle = '';
      }
    }
    this.cdr.markForCheck();
  }
}
