import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Router, ActivatedRoute } from '@angular/router';
import { ClientService } from '../../../../core/services/client.service';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatCardModule],
  template: `
    <mat-card>
      <mat-card-header><mat-card-title>{{ isEdit ? 'Edit Client' : 'New Client' }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Name</mat-label><input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Type</mat-label>
            <mat-select formControlName="client_type">
              <mat-option value="company">Company</mat-option>
              <mat-option value="individual">Individual</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Phone</mat-label><input matInput formControlName="phone" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email</mat-label><input matInput formControlName="email" type="email" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Contact Person</mat-label><input matInput formControlName="contact_person" />
          </mat-form-field>
          <div class="actions">
            <button mat-button type="button" (click)="cancel()">Cancel</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid">{{ isEdit ? 'Update' : 'Create' }}</button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`.full-width { width: 100%; } .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }`],
})
export class ClientFormComponent implements OnInit {
  form!: FormGroup;
  isEdit = false;
  clientId: number | null = null;

  constructor(private fb: FormBuilder, private clientService: ClientService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      client_type: ['company', Validators.required],
      phone: [''], email: [''], contact_person: [''],
    });
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.isEdit = true; this.clientId = +id;
      this.clientService.get(this.clientId).subscribe((c) => this.form.patchValue(c));
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    if (this.isEdit && this.clientId) {
      this.clientService.update(this.clientId, this.form.value).subscribe(() => this.router.navigate(['/clients', this.clientId]));
    } else {
      this.clientService.create(this.form.value).subscribe((c) => this.router.navigate(['/clients', c.id]));
    }
  }

  cancel(): void { this.router.navigate(['/clients']); }
}
