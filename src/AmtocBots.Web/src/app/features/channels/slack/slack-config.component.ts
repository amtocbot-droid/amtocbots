import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ChannelBase } from '../channel-base';

@Component({
  selector: 'app-slack-config',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatSlideToggleModule, MatChipsModule, MatIconModule],
  template: `
    <div class="channel-form">
      <h3 class="channel-title"><span>💬</span> Slack</h3>
      <p class="channel-hint">Create a Slack App with <code>Socket Mode</code> enabled. Requires an App-Level token (xapp-) and Bot token (xoxb-).</p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="form-fields">
        <mat-slide-toggle formControlName="enabled">Enabled</mat-slide-toggle>

        <mat-form-field appearance="outline">
          <mat-label>App Token (xapp-…)</mat-label>
          <input matInput formControlName="appToken" type="password" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Bot Token (xoxb-…)</mat-label>
          <input matInput formControlName="botToken" type="password" />
        </mat-form-field>

        <div class="field-group">
          <label class="field-label">Allowed Channel IDs</label>
          <mat-chip-grid #chipGrid>
            @for (id of allowChannels; track id) {
              <mat-chip [removable]="true" (removed)="removeChannel(id)">
                {{ id }}<button matChipRemove><mat-icon>cancel</mat-icon></button>
              </mat-chip>
            }
            <input placeholder="Add channel ID (e.g. C0123456789)…"
              [matChipInputFor]="chipGrid"
              [matChipInputSeparatorKeyCodes]="separatorKeys"
              (matChipInputTokenEnd)="addChannel($event)" />
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
  styles: [`.channel-form{padding:20px 0;max-width:520px} .channel-title{font-size:16px;font-weight:600;margin:0 0 6px;display:flex;align-items:center;gap:8px} .channel-hint{color:var(--text-secondary);font-size:13px;margin-bottom:20px} code{background:var(--bg-elevated);padding:1px 5px;border-radius:4px} .form-fields{display:flex;flex-direction:column;gap:16px} mat-form-field{width:100%} .field-group{display:flex;flex-direction:column;gap:6px} .field-label{font-size:13px;color:var(--text-secondary)} .form-actions{display:flex;justify-content:flex-end}`],
})
export class SlackConfigComponent extends ChannelBase implements OnInit {
  override readonly channelType = 'slack';
  private readonly fb = inject(FormBuilder);
  readonly separatorKeys = [ENTER, COMMA];
  allowChannels: string[] = [];

  readonly form = this.fb.group({
    enabled:  [false],
    appToken: ['', Validators.required],
    botToken: ['', Validators.required],
  });

  ngOnInit(): void {
    const cfg = this.parsedConfig<{ appToken?: string; botToken?: string; allowChannels?: string[] }>();
    this.form.patchValue({ enabled: this.config().isEnabled, appToken: cfg.appToken ?? '', botToken: cfg.botToken ?? '' });
    this.allowChannels = cfg.allowChannels ?? [];
  }

  addChannel(e: MatChipInputEvent): void {
    const v = (e.value ?? '').trim();
    if (v) this.allowChannels = [...this.allowChannels, v];
    e.chipInput!.clear();
  }
  removeChannel(id: string): void { this.allowChannels = this.allowChannels.filter(x => x !== id); }

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    const { enabled, appToken, botToken } = this.form.getRawValue();
    await this.saveConfig(!!enabled, { appToken, botToken, allowChannels: this.allowChannels });
  }
}
