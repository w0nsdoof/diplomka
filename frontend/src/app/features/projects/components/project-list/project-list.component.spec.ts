import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ProjectListComponent } from './project-list.component';
import { ProjectService } from '../../../../core/services/project.service';
import { TaskService } from '../../../../core/services/task.service';
import { AuthService } from '../../../../core/services/auth.service';

describe('ProjectListComponent', () => {
  let component: ProjectListComponent;
  let fixture: ComponentFixture<ProjectListComponent>;
  let projectService: jasmine.SpyObj<ProjectService>;
  let taskService: jasmine.SpyObj<TaskService>;
  let authService: jasmine.SpyObj<AuthService>;

  const mockProjectsResponse = {
    count: 1, next: null, previous: null,
    results: [{
      id: 1, title: 'Test Project', status: 'created', priority: 'high',
      deadline: '2025-12-31', assignee: null, client: null, tags: [], team: [],
      epics_count: 2, created_at: '2025-01-01', updated_at: '2025-01-01',
    }],
  };

  const mockEpicsResponse = {
    count: 1, next: null, previous: null,
    results: [{
      id: 10, title: 'Standalone Epic', status: 'in_progress', priority: 'medium',
      deadline: null, project: null, assignee: null, client: null, tags: [],
      tasks_count: 3, created_at: '2025-01-01', updated_at: '2025-01-01',
    }],
  };

  beforeEach(async () => {
    projectService = jasmine.createSpyObj('ProjectService', [
      'listProjects', 'listEpics', 'getProjectEpics', 'getEpicTasks',
    ]);
    taskService = jasmine.createSpyObj('TaskService', ['getSubtasks']);
    authService = jasmine.createSpyObj('AuthService', ['hasRole', 'hasAnyRole']);

    projectService.listProjects.and.returnValue(of(mockProjectsResponse));
    projectService.listEpics.and.returnValue(of(mockEpicsResponse));
    projectService.getProjectEpics.and.returnValue(of({ count: 0, next: null, previous: null, results: [] }));
    projectService.getEpicTasks.and.returnValue(of({ count: 0, next: null, previous: null, results: [] }));
    taskService.getSubtasks.and.returnValue(of({ count: 0, next: null, previous: null, results: [] }));

    await TestBed.configureTestingModule({
      imports: [ProjectListComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService(),
        { provide: ProjectService, useValue: projectService },
        { provide: TaskService, useValue: taskService },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  function createComponent(isManager = false) {
    authService.hasRole.and.returnValue(isManager);
    authService.hasAnyRole.and.returnValue(isManager);
    fixture = TestBed.createComponent(ProjectListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('should load projects and standalone epics on init', () => {
    createComponent();
    expect(projectService.listProjects).toHaveBeenCalled();
    expect(projectService.listEpics).toHaveBeenCalled();
    expect(component.loaded).toBeTrue();
  });

  it('should set isManager=true for manager role', () => {
    createComponent(true);
    expect(component.isManager).toBeTrue();
  });

  it('should set isManager=false for non-manager', () => {
    createComponent(false);
    expect(component.isManager).toBeFalse();
  });

  it('should populate tree data source with projects and standalone epics', () => {
    createComponent();
    // 1 project + 1 standalone epic (no project parent)
    expect(component.dataSource.data.length).toBe(2);
  });

  it('should return correct node icons', () => {
    createComponent();
    expect(component.getNodeIcon({ entityType: 'project' } as any)).toBe('folder');
    expect(component.getNodeIcon({ entityType: 'epic' } as any)).toBe('account_tree');
    expect(component.getNodeIcon({ entityType: 'task' } as any)).toBe('task_alt');
    expect(component.getNodeIcon({ entityType: 'subtask' } as any)).toBe('subdirectory_arrow_right');
  });

  it('should return correct node routes', () => {
    createComponent();
    expect(component.getNodeRoute({ entityType: 'project', id: 1 } as any)).toEqual(['/projects', '1']);
    expect(component.getNodeRoute({ entityType: 'epic', id: 2 } as any)).toEqual(['/epics', '2']);
    expect(component.getNodeRoute({ entityType: 'task', id: 3 } as any)).toEqual(['/tasks', '3']);
  });

  it('should reload on status filter change', () => {
    createComponent();
    projectService.listProjects.calls.reset();
    projectService.listEpics.calls.reset();

    component.onStatusFilter('in_progress');

    expect(component.statusFilter).toBe('in_progress');
    expect(projectService.listProjects).toHaveBeenCalled();
    expect(projectService.listEpics).toHaveBeenCalled();
  });

  it('should reload on search', () => {
    createComponent();
    projectService.listProjects.calls.reset();
    projectService.listEpics.calls.reset();

    component.onSearch('test query');

    expect(projectService.listProjects).toHaveBeenCalled();
    expect(projectService.listEpics).toHaveBeenCalled();
  });
});
