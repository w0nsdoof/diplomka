import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';

export interface PipelineStageConfig {
  key: string;
  icon: string;
  labelKey: string;
}

/** Optional callback to format stage metadata into a detail string. */
export type StageDetailFormatter = (key: string, meta: Record<string, any>) => string;

@Component({
  selector: 'app-generation-pipeline',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule, TranslateModule],
  template: `
    <div class="pipeline-container">
      <div class="pipeline-header">
        <mat-icon class="header-icon">auto_awesome</mat-icon>
        <span class="header-text">{{ titleKey | translate }}</span>
      </div>

      <div class="pipeline-stages">
        <ng-container *ngFor="let stage of stages; let last = last">
          <div class="stage"
               [class.stage-done]="getStageState(stage.key) === 'done'"
               [class.stage-active]="getStageState(stage.key) === 'active'"
               [class.stage-pending]="getStageState(stage.key) === 'pending'">

            <div class="stage-icon-wrap">
              <mat-icon *ngIf="getStageState(stage.key) === 'done'" class="stage-icon done-icon">check_circle</mat-icon>
              <mat-spinner *ngIf="getStageState(stage.key) === 'active'" diameter="24" class="stage-spinner"></mat-spinner>
              <mat-icon *ngIf="getStageState(stage.key) === 'pending'" class="stage-icon pending-icon">{{ stage.icon }}</mat-icon>
            </div>

            <div class="stage-content">
              <span class="stage-label">{{ stage.labelKey | translate }}</span>
              <span class="stage-detail" *ngIf="getStageState(stage.key) !== 'pending' && getDetail(stage.key)">
                {{ getDetail(stage.key) }}
              </span>
            </div>
          </div>

          <div class="connector" *ngIf="!last"
               [class.connector-done]="getStageState(stage.key) === 'done'">
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .pipeline-container {
      padding: 20px;
      background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
      border: 1px solid #e0e7ff;
      border-radius: 12px;
      margin-bottom: 16px;
    }
    .pipeline-header { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
    .header-icon { color: #6366f1; font-size: 22px; width: 22px; height: 22px; }
    .header-text { font-size: 15px; font-weight: 600; color: #312e81; }
    .pipeline-stages { display: flex; flex-direction: column; gap: 0; }
    .stage { display: flex; align-items: flex-start; gap: 12px; padding: 8px 0; }
    .stage-icon-wrap { flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
    .stage-icon { font-size: 22px; width: 22px; height: 22px; }
    .done-icon { color: #22c55e; }
    .pending-icon { color: #cbd5e1; }
    .stage-spinner ::ng-deep circle { stroke: #6366f1; }
    .stage-content { display: flex; flex-direction: column; gap: 2px; min-height: 24px; justify-content: center; }
    .stage-label { font-size: 13px; font-weight: 500; line-height: 1.3; }
    .stage-done .stage-label { color: #15803d; }
    .stage-active .stage-label { color: #4338ca; font-weight: 600; }
    .stage-pending .stage-label { color: #94a3b8; }
    .stage-detail { font-size: 11px; color: #64748b; line-height: 1.3; }
    .stage-active .stage-detail { color: #6366f1; }
    .connector { width: 2px; height: 12px; margin-left: 11px; background: #e2e8f0; border-radius: 1px; }
    .connector-done { background: #86efac; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerationPipelineComponent implements OnChanges {
  @Input() stages: PipelineStageConfig[] = [];
  @Input() titleKey = 'epics.pipeline.title';
  @Input() currentStage: string | undefined;
  @Input() stageMeta: Record<string, any> = {};
  @Input() detailFormatter: StageDetailFormatter | null = null;

  private stageIndex = -1;
  private stageMetaMap: Record<string, Record<string, any>> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentStage'] || changes['stageMeta'] || changes['stages']) {
      this.stageIndex = this.stages.findIndex(s => s.key === this.currentStage);
      if (this.currentStage && this.stageMeta) {
        this.stageMetaMap[this.currentStage] = { ...this.stageMeta };
      }
    }
  }

  getStageState(key: string): 'done' | 'active' | 'pending' {
    const idx = this.stages.findIndex(s => s.key === key);
    if (idx < this.stageIndex) return 'done';
    if (idx === this.stageIndex) return 'active';
    return 'pending';
  }

  getDetail(key: string): string {
    if (!this.detailFormatter) return '';
    const meta = this.stageMetaMap[key] || (key === this.currentStage ? this.stageMeta : null);
    if (!meta) return '';
    return this.detailFormatter(key, meta);
  }
}
