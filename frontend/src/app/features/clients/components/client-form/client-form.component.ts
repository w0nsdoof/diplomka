import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { ClientService } from '../../../../core/services/client.service';

@Component({
    selector: 'app-client-form',
    imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatCardModule, TranslateModule],
    template: `
    <div class="form-page">
      <div class="page-header">
        <h2>{{ (isEdit ? 'clients.editClient' : 'clients.newClient') | translate }}</h2>
      </div>
      <div class="form-card flat-card">
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label class="flat-input-label">{{ 'common.name' | translate }}</label>
            <input class="flat-input" formControlName="name" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'clients.type' | translate }}</label>
            <mat-form-field appearance="outline" class="full-width">
              <mat-select formControlName="client_type">
                <mat-option value="company">{{ 'clients.company' | translate }}</mat-option>
                <mat-option value="individual">{{ 'clients.individual' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'common.phone' | translate }}</label>
            <input class="flat-input" formControlName="phone" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'common.email' | translate }}</label>
            <input class="flat-input" formControlName="email" type="email" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'clients.contactPerson' | translate }}</label>
            <input class="flat-input" formControlName="contact_person" />
          </div>
          <div class="form-actions">
            <button type="button" class="flat-btn-outline" (click)="cancel()">{{ 'common.cancel' | translate }}</button>
            <button class="flat-btn-primary" type="submit" [disabled]="form.invalid || saving">
              {{ (isEdit ? 'common.update' : 'common.create') | translate }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
    styles: [`
    .form-page { max-width: 600px; }
    .page-header { margin-bottom: 24px; }
    .page-header h2 { font-size: 22px; font-weight: 700; margin: 0; }
    .form-card { padding: 32px; }
    .full-width { width: 100%; }
    .form-group { margin-bottom: 20px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientFormComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  isEdit = false;
  saving = false;
  clientId: number | null = null;
  private destroy$ = new Subject<void>();

  constructor(private fb: FormBuilder, private clientService: ClientService, private router: Router, private route: ActivatedRoute, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      client_type: ['company', Validators.required],
      phone: [''], email: [''], contact_person: [''],
    });
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.isEdit = true; this.clientId = +id;
      this.clientService.get(this.clientId).pipe(takeUntil(this.destroy$)).subscribe((c) => {
        this.form.patchValue(c);
        this.cdr.markForCheck();
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving) return;
    this.saving = true;

    this.router.navigate(['/clients']);

    if (this.isEdit && this.clientId) {
      this.clientService.update(this.clientId, this.form.value).pipe(takeUntil(this.destroy$)).subscribe();
    } else {
      this.clientService.create(this.form.value).pipe(takeUntil(this.destroy$)).subscribe();
    }
  }

  cancel(): void { this.router.navigate(['/clients']); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
