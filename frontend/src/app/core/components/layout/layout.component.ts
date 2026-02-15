import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, UserInfo } from '../../services/auth.service';
import { NotificationService, Notification } from '../../services/notification.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: string[];
}

@Component({
  selector: 'app-layout',
  standalone: true,
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
  ],
  template: `
    <mat-sidenav-container class="app-container">
      <mat-sidenav mode="side" opened class="app-sidenav">
        <div class="sidenav-header">
          <h3>Task Manager</h3>
        </div>
        <mat-nav-list>
          <a mat-list-item *ngFor="let item of filteredNavItems" [routerLink]="item.route" routerLinkActive="active">
            <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
            <span matListItemTitle>{{ item.label }}</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar color="primary">
          <span class="spacer"></span>
          <button mat-icon-button [matMenuTriggerFor]="notifMenu" (click)="loadNotifications()">
            <mat-icon [matBadge]="unreadCount > 0 ? unreadCount : null" matBadgeColor="warn">
              notifications
            </mat-icon>
          </button>
          <mat-menu #notifMenu="matMenu" class="notif-menu">
            <div class="notif-header" style="padding: 8px 16px; display: flex; justify-content: space-between; align-items: center;">
              <strong>Notifications</strong>
              <button mat-button *ngIf="unreadCount > 0" (click)="markAllRead($event)" style="font-size: 12px;">
                Mark all read
              </button>
            </div>
            <mat-divider></mat-divider>
            <div *ngIf="notifications.length === 0" style="padding: 16px; color: #888; text-align: center;">
              No notifications
            </div>
            <button mat-menu-item *ngFor="let notif of notifications"
                    (click)="onNotificationClick(notif)"
                    [style.opacity]="notif.is_read ? 0.6 : 1"
                    [style.font-weight]="notif.is_read ? 'normal' : '500'">
              <mat-icon>{{ getNotifIcon(notif) }}</mat-icon>
              <span>{{ notif.message }}</span>
            </button>
          </mat-menu>
          <button mat-icon-button [matMenuTriggerFor]="userMenu">
            <mat-icon>account_circle</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu">
            <div style="padding: 8px 16px;" *ngIf="currentUser">
              <strong>{{ currentUser.first_name }} {{ currentUser.last_name }}</strong>
              <br /><small>{{ currentUser.role }}</small>
            </div>
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>Logout</span>
            </button>
          </mat-menu>
        </mat-toolbar>
        <div class="content">
          <router-outlet></router-outlet>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .app-container {
        height: 100vh;
      }
      .app-sidenav {
        width: 240px;
      }
      .sidenav-header {
        padding: 16px;
        border-bottom: 1px solid #e0e0e0;
      }
      .spacer {
        flex: 1 1 auto;
      }
      .content {
        padding: 24px;
      }
      .active {
        background-color: rgba(0, 0, 0, 0.04);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent implements OnInit, OnDestroy {
  currentUser: UserInfo | null = null;
  unreadCount = 0;
  notifications: Notification[] = [];
  filteredNavItems: NavItem[] = [];
  private destroy$ = new Subject<void>();

  private navItems: NavItem[] = [
    { label: 'Tasks', icon: 'assignment', route: '/tasks', roles: ['manager', 'engineer'] },
    { label: 'Kanban', icon: 'view_kanban', route: '/kanban', roles: ['manager', 'engineer'] },
    { label: 'Clients', icon: 'business', route: '/clients', roles: ['manager'] },
    { label: 'Calendar', icon: 'calendar_today', route: '/calendar', roles: ['manager'] },
    { label: 'Reports', icon: 'assessment', route: '/reports', roles: ['manager'] },
    { label: 'Users', icon: 'people', route: '/admin/users', roles: ['manager'] },
    { label: 'My Tickets', icon: 'confirmation_number', route: '/portal', roles: ['client'] },
  ];

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.filteredNavItems = this.navItems.filter((item) =>
        user ? item.roles.includes(user.role) : false,
      );
      if (user) {
        this.notificationService.refreshUnreadCount();
      }
      this.cdr.markForCheck();
    });

    this.notificationService.unreadCount$.pipe(takeUntil(this.destroy$)).subscribe((count) => {
      this.unreadCount = count;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
}
