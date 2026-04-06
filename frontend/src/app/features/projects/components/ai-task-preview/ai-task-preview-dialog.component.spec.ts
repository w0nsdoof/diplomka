import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { AiTaskPreviewDialogComponent, AiTaskPreviewDialogData } from './ai-task-preview-dialog.component';
import { ProjectService } from '../../../../core/services/project.service';

describe('AiTaskPreviewDialogComponent', () => {
  let component: AiTaskPreviewDialogComponent;
  let fixture: ComponentFixture<AiTaskPreviewDialogComponent>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<AiTaskPreviewDialogComponent>>;
  let mockProjectService: jasmine.SpyObj<ProjectService>;

  const mockData: AiTaskPreviewDialogData = {
    tasks: [
      { title: 'Task A', description: 'Desc A', priority: 'high', assignee_id: 1, tag_ids: [10], estimated_hours: 4 },
      { title: 'Task B', description: 'Desc B', priority: 'low', assignee_id: null, tag_ids: [], estimated_hours: null },
    ],
    warnings: [],
    teamMembers: [{ id: 1, first_name: 'Alice', last_name: 'Smith' }],
    tags: [{ id: 10, name: 'backend', color: '#6c757d' }],
    epicId: 42,
  };

  beforeEach(async () => {
    mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    mockProjectService = jasmine.createSpyObj('ProjectService', ['confirmEpicTasks']);

    await TestBed.configureTestingModule({
      imports: [AiTaskPreviewDialogComponent, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: mockData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: ProjectService, useValue: mockProjectService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AiTaskPreviewDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with tasks from data', () => {
    expect(component).toBeTruthy();
    expect(component.tasks.length).toBe(2);
  });

  it('should render task items', () => {
    const taskRows = fixture.nativeElement.querySelectorAll('.task-row');
    expect(taskRows.length).toBe(2);
  });

  it('should remove a task when removeTask is called', () => {
    component.removeTask(0);
    expect(component.tasks.length).toBe(1);
    expect(component.tasks[0].title).toBe('Task B');
  });

  it('should disable confirm button when list is empty', () => {
    component.tasks = [];
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button[color="primary"]');
    expect(btn.disabled).toBeTrue();
  });

  it('should call confirmEpicTasks on confirm and close dialog', () => {
    mockProjectService.confirmEpicTasks.and.returnValue(
      of({ created_count: 2, tasks: [{ id: 1, title: 'Task A', status: 'created' }, { id: 2, title: 'Task B', status: 'created' }] })
    );

    component.onConfirm();

    expect(mockProjectService.confirmEpicTasks).toHaveBeenCalledWith(42, component.tasks);
    expect(mockDialogRef.close).toHaveBeenCalled();
  });

  it('should not close dialog on error', () => {
    mockProjectService.confirmEpicTasks.and.returnValue(throwError(() => new Error('fail')));

    component.onConfirm();

    expect(mockDialogRef.close).not.toHaveBeenCalled();
    expect(component.confirming).toBeFalse();
  });
});
