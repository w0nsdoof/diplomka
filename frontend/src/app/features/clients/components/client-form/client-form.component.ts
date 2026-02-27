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
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatCardModule, TranslateModule],
  template: `
    <mat-card>
      <mat-card-header><mat-card-title>{{ (isEdit ? 'clients.editClient' : 'clients.newClient') | translate }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'common.name' | translate }}</mat-label><input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'clients.type' | translate }}</mat-label>
            <mat-select formControlName="client_type">
              <mat-option value="company">{{ 'clients.company' | translate }}</mat-option>
              <mat-option value="individual">{{ 'clients.individual' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'common.phone' | translate }}</mat-label><input matInput formControlName="phone" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'common.email' | translate }}</mat-label><input matInput formControlName="email" type="email" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'clients.contactPerson' | translate }}</mat-label><input matInput formControlName="contact_person" />
          </mat-form-field>
          <div class="actions">
            <button mat-button type="button" (click)="cancel()">{{ 'common.cancel' | translate }}</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">{{ (isEdit ? 'common.update' : 'common.create') | translate }}</button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`.full-width { width: 100%; } .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
