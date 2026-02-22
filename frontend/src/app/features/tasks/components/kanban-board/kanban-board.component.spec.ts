import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { KanbanBoardComponent } from './kanban-board.component';
import { TaskService, TaskListItem, PaginatedResponse } from '../../../../core/services/task.service';
import { WebSocketService, WsMessage } from '../../../../core/services/websocket.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClientService } from '../../../../core/services/client.service';

describe('KanbanBoardComponent', () => {
  let component: KanbanBoardComponent;
  let fixture: ComponentFixture<KanbanBoardComponent>;
  let taskService: jasmine.SpyObj<TaskService>;
  let messagesSubject: Subject<WsMessage>;
  let wsConnectSpy: jasmine.Spy;
  let wsDisconnectSpy: jasmine.Spy;

  const makeTasks = (): TaskListItem[] => [
    { id: 1, title: 'Task 1', status: 'created', priority: 'high', deadline: '', created_at: '', updated_at: '', client: null, assignees: [], tags: [], comments_count: 0, attachments_count: 0 },
    { id: 2, title: 'Task 2', status: 'in_progress', priority: 'low', deadline: '', created_at: '', updated_at: '', client: null, assignees: [], tags: [], comments_count: 0, attachments_count: 0 },
    { id: 3, title: 'Task 3', status: 'done', priority: 'medium', deadline: '', created_at: '', updated_at: '', client: null, assignees: [], tags: [], comments_count: 0, attachments_count: 0 },
  ];

  beforeEach(async () => {
    messagesSubject = new Subject<WsMessage>();
    taskService = jasmine.createSpyObj('TaskService', ['list', 'changeStatus']);
    taskService.list.and.returnValue(of({
      count: 3, next: null, previous: null, results: makeTasks(),
    }));

    wsConnectSpy = jasmine.createSpy('connect');
    wsDisconnectSpy = jasmine.createSpy('disconnect');

    const clientService = jasmine.createSpyObj('ClientService', ['list']);
    clientService.list.and.returnValue(of({ count: 0, next: null, previous: null, results: [] }));

    const wsServiceMock = {
      connect: wsConnectSpy,
      disconnect: wsDisconnectSpy,
      messages$: messagesSubject.asObservable(),
    };

    await TestBed.configureTestingModule({
      imports: [KanbanBoardComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: TaskService, useValue: taskService },
        { provide: WebSocketService, useValue: wsServiceMock },
        { provide: ClientService, useValue: clientService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(KanbanBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should have 4 columns', () => {
      expect(component.columns.length).toBe(4);
      expect(component.columns.map((c) => c.status)).toEqual(['created', 'in_progress', 'waiting', 'done']);
    });

    it('should set columnIds', () => {
      expect(component.columnIds).toEqual(['created', 'in_progress', 'waiting', 'done']);
    });

    it('should load and distribute tasks into columns', () => {
      expect(taskService.list).toHaveBeenCalled();
      expect(component.columns[0].tasks.length).toBe(1); // created
      expect(component.columns[0].tasks[0].title).toBe('Task 1');
      expect(component.columns[1].tasks.length).toBe(1); // in_progress
      expect(component.columns[2].tasks.length).toBe(0); // waiting
      expect(component.columns[3].tasks.length).toBe(1); // done
    });

    it('should connect WebSocket on init', () => {
      expect(wsConnectSpy).toHaveBeenCalled();
    });
  });

  describe('WebSocket handling', () => {
    it('should handle task_status_changed by moving task between columns', () => {
      messagesSubject.next({
        type: 'task_status_changed',
        payload: { task_id: 1, new_status: 'in_progress' },
      });

      expect(component.columns[0].tasks.length).toBe(0);
      expect(component.columns[1].tasks.length).toBe(2);
    });

    it('should reload tasks on task_created', () => {
      taskService.list.calls.reset();
      messagesSubject.next({ type: 'task_created' });
      expect(taskService.list).toHaveBeenCalled();
    });
  });

  describe('onDrop', () => {
    it('should call changeStatus and move task on success', () => {
      taskService.changeStatus.and.returnValue(of({}));

      const sourceCol = component.columns[0]; // created
      const targetCol = component.columns[1]; // in_progress

      const previousContainer = { data: sourceCol.tasks };
      const container = { data: targetCol.tasks };

      const event = {
        previousContainer,
        container,
        previousIndex: 0,
        currentIndex: 0,
      } as any;

      component.onDrop(event, targetCol);

      expect(taskService.changeStatus).toHaveBeenCalledWith(1, 'in_progress');
    });

    it('should not call changeStatus when dropping in same container', () => {
      const col = component.columns[0];
      const sameContainer = { data: col.tasks };

      const event = {
        previousContainer: sameContainer,
        container: sameContainer,
        previousIndex: 0,
        currentIndex: 0,
      } as any;

      component.onDrop(event, col);

      expect(taskService.changeStatus).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('should disconnect WebSocket', () => {
      component.ngOnDestroy();
      expect(wsDisconnectSpy).toHaveBeenCalled();
    });
  });
});
