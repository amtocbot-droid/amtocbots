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
  selector: 'app-discord-config',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatSlideToggleModule, MatChipsModule, MatIconModule],
  template: `
    <div class="channel-form">
      <h3 class="channel-title"><span>🎮</span> Discord Bot</h3>
      <p class="channel-hint">Create a bot in the <a href="https://discord.com/developers/applications" target="_blank">Discord Developer Portal</a>.</p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="form-fields">
        <mat-slide-toggle formControlName="enabled">Enabled</mat-slide-toggle>

        <mat-form-field appearance="outline">
          <mat-label>Bot Token</mat-label>
          <input matInput formControlName="token" type="password" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Guild (Server) ID</mat-label>
          <input matInput formControlName="guildId" placeholder="123456789012345678" />
        </mat-form-field>

        <div class="field-group">
          <label class="field-label">Allowed Channel IDs</label>
          <mat-chip-grid #chipGrid>
            @for (id of allowChannels; track id) {
              <mat-chip [removable]="true" (removed)="removeChannel(id)">
                {{ id }}<button matChipRemove><mat-icon>cancel</mat-icon></button>
              </mat-chip>
            }
            <input placeholder="Add channel ID…" [matChipInputFor]="chipGrid"
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
  styles: [`.channel-form{padding:20px 0;max-width:520px} .channel-title{font-size:16px;font-weight:600;margin:0 0 6px;display:flex;align-items:center;gap:8px} .channel-hint{color:var(--text-secondary);font-size:13px;margin-bottom:20px} .channel-hint a{color:var(--accent-blue)} .form-fields{display:flex;flex-direction:column;gap:16px} mat-form-field{width:100%} .field-group{display:flex;flex-direction:column;gap:6px} .field-label{font-size:13px;color:var(--text-secondary)} .form-actions{display:flex;justify-content:flex-end}`],
})
export class DiscordConfigComponent extends ChannelBase implements OnInit {
  override readonly channelType = 'discord';
  private readonly fb = inject(FormBuilder);
  readonly separatorKeys = [ENTER, COMMA];
  allowChannels: string[] = [];

  readonly form = this.fb.group({
    enabled: [false],
    token:   ['', Validators.required],
    guildId: ['', Validators.required],
  });

  ngOnInit(): void {
    const cfg = this.parsedConfig<{ token?: string; guildId?: string; allowChannels?: string[] }>();
    this.form.patchValue({ enabled: this.config().isEnabled, token: cfg.token ?? '', guildId: cfg.guildId ?? '' });
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
    const { enabled, token, guildId } = this.form.getRawValue();
    await this.saveConfig(!!enabled, { token, guildId, allowChannels: this.allowChannels });
  }
}
