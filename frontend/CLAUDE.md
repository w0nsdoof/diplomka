# Frontend — Angular 17 SPA

Angular Material UI, standalone components, JWT auth (httpOnly cookie refresh + in-memory access token).

## Commands

```bash
npm start          # dev server (port 4200, proxies /api to backend)
npm test           # interactive Karma test runner
npm run test:ci    # headless Chrome, single run (CI)
```

## Testing

152 tests, ~99% coverage. Patterns:

- **Services**: `provideHttpClient()` + `provideHttpClientTesting()` + `HttpTestingController.verify()` in `afterEach`
- **Guards**: `TestBed.runInInjectionContext()` with mocked `AuthService` (guard returns `Observable` for async session restore)
- **Interceptors**: `provideHttpClient(withInterceptors([...]))` + `HttpTestingController`
- **Components**: `jasmine.createSpyObj` for services, `provideNoopAnimations()` for Material, `provideRouter([])` for routing

When adding new code, add a `.spec.ts` next to it following these patterns.

## Structure

```
src/app/
  core/
    services/       # AuthService, TaskService, NotificationService, SummaryService, etc.
    guards/         # authGuard, managerGuard, engineerGuard, clientGuard
    interceptors/   # jwtInterceptor (token + 401 refresh), errorInterceptor
    components/     # LoginComponent, LayoutComponent (shell + nav)
  features/
    tasks/          # TaskList, TaskForm, KanbanBoard, TaskDetail
    clients/        # ClientList, ClientDetail
    calendar/       # CalendarView
    reports/        # ReportsView, SummaryList, SummaryDetail (AI summaries)
    admin/          # UserManagement
    portal/         # ClientPortal
```

## Key conventions

- All components are standalone (no NgModules)
- All components use `ChangeDetectionStrategy.OnPush` with `ChangeDetectorRef.markForCheck()` in subscribe callbacks
- All subscriptions use `takeUntil(destroy$)` pattern with `OnDestroy` for cleanup
- Environment config in `src/environments/environment.ts` (`apiUrl`, `wsUrl`)
- WebSocket URLs auto-detect ws/wss protocol from `window.location`
- Error interceptor shows `MatSnackBar` notifications (skips 401s and auth endpoints)
- Auth: access token in memory only, refresh token in httpOnly cookie (`withCredentials: true`)
- Auth guard calls `tryRestoreSession()` on page refresh to restore session from cookie
- Roles: `manager` (full access), `engineer` (tasks + kanban), `client` (portal only)
- Nav items filtered by role in `LayoutComponent`
- LayoutComponent integrates NotificationService: loads notifications on bell click, routes `summary_ready` to `/reports/summaries/{id}`, task notifications to `/tasks/{id}`
