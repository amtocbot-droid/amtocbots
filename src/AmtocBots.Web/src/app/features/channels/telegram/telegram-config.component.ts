import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, inject } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatChipInputEvent } from '@angular/material/chips';
import { ChannelBase } from '../channel-base';

@Component({
  selector: 'app-telegram-config',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatSlideToggleModule, MatChipsModule, MatIconModule],
  template: `
    <div class="channel-form">
      <h3 class="channel-title">
        <span class="channel-icon">📨</span> Telegram Bot
      </h3>
      <p class="channel-hint">
        Create a bot via <a href="https://t.me/BotFather" target="_blank">@BotFather</a> and paste the token below.
      </p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="form-fields">
        <mat-slide-toggle formControlName="enabled">Enabled</mat-slide-toggle>

        <mat-form-field appearance="outline">
          <mat-label>Bot Token</mat-label>
          <input matInput formControlName="token" type="password" placeholder="123456:ABC-DEF..." />
          <mat-hint>From @BotFather — keep secret</mat-hint>
        </mat-form-field>

        <div class="field-group">
          <label class="field-label">Allow From (user IDs or group IDs)</label>
          <mat-chip-grid #chipGrid>
            @for (id of allowFrom; track id) {
              <mat-chip [removable]="true" (removed)="removeAllow(id)">
                {{ id }}<button matChipRemove><mat-icon>cancel</mat-icon></button>
              </mat-chip>
            }
            <input placeholder="Add ID…" [matChipInputFor]="chipGrid"
              [matChipInputSeparatorKeyCodes]="separatorKeys"
              (matChipInputTokenEnd)="addAllow($event)" />
          </mat-chip-grid>
        </div>

        <div class="form-actions">
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
            @if (saving()) { Saving… } @else { Save & Apply }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .channel-form  { padding: 20px 0; max-width: 520px; }
    .channel-title { font-size: 16px; font-weight: 600; margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
    .channel-hint  { color: var(--text-secondary); font-size: 13px; margin-bottom: 20px; }
    .channel-hint a { color: var(--accent-blue); }
    .form-fields   { display: flex; flex-direction: column; gap: 16px; }
    mat-form-field { width: 100%; }
    .field-group   { display: flex; flex-direction: column; gap: 6px; }
    .field-label   { font-size: 13px; color: var(--text-secondary); }
    .form-actions  { display: flex; justify-content: flex-end; }
  `],
})
export class TelegramConfigComponent extends ChannelBase implements OnInit {
  override readonly channelType = 'telegram';

  private readonly fb = inject(FormBuilder);
  readonly separatorKeys = [ENTER, COMMA];
  allowFrom: string[] = [];

  readonly form = this.fb.group({
    enabled: [false],
    token:   ['', Validators.required],
  });

  ngOnInit(): void {
    const cfg = this.parsedConfig<{ token?: string; allowFrom?: string[] }>();
    this.form.patchValue({ enabled: this.config().isEnabled, token: cfg.token ?? '' });
    this.allowFrom = cfg.allowFrom ?? [];
  }

  addAllow(e: MatChipInputEvent): void {
    const v = (e.value ?? '').trim();
    if (v) { this.allowFrom = [...this.allowFrom, v]; }
    e.chipInput!.clear();
  }

  removeAllow(id: string): void { this.allowFrom = this.allowFrom.filter(x => x !== id); }

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    const { enabled, token } = this.form.getRawValue();
    await this.saveConfig(!!enabled, { token, allowFrom: this.allowFrom });
  }
}
