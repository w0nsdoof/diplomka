import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, UserInfo } from '../../services/auth.service';

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
          <button mat-icon-button [matMenuTriggerFor]="notifMenu">
            <mat-icon [matBadge]="unreadCount > 0 ? unreadCount : null" matBadgeColor="warn">
              notifications
            </mat-icon>
          </button>
          <mat-menu #notifMenu="matMenu">
            <div class="notif-placeholder" style="padding: 16px;">No notifications</div>
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

  constructor(private authService: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.filteredNavItems = this.navItems.filter((item) =>
        user ? item.roles.includes(user.role) : false,
      );
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  logout(): void {
    this.authService.logout();
  }
}
