import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ChannelBase } from '../channel-base';
import { environment } from '../../../../environments/environment';

type PairingState = 'idle' | 'polling' | 'paired' | 'error';

@Component({
  selector: 'app-whatsapp-config',
  standalone: true,
  imports: [MatButtonModule, MatSlideToggleModule, MatChipsModule, MatIconModule,
    MatProgressSpinnerModule, FormsModule],
  template: `
    <div class="channel-form">
      <h3 class="channel-title"><span>📱</span> WhatsApp</h3>
      <p class="channel-hint">
        WhatsApp uses QR code pairing (Baileys WebSocket protocol). No bot token required.
        The instance must be running to display the QR code.
      </p>

      <div class="pairing-section">
        @switch (pairingState()) {
          @case ('idle') {
            <button mat-flat-button color="primary" (click)="startPairing()">
              <mat-icon>qr_code_2</mat-icon> Show QR Code
            </button>
          }
          @case ('polling') {
            <div class="qr-wrap">
              @if (qrUrl()) {
                <img [src]="qrUrl()!" class="qr-image" alt="WhatsApp QR code" />
                <p class="qr-hint">Scan with WhatsApp → Linked Devices → Link a Device</p>
                <p class="qr-timer">Refreshing every 3s…</p>
              } @else {
                <mat-spinner diameter="48" />
                <p>Fetching QR code…</p>
              }
            </div>
            <button mat-stroked-button (click)="stopPairing()">Cancel</button>
          }
          @case ('paired') {
            <div class="paired-badge">
              <mat-icon>check_circle</mat-icon> WhatsApp paired successfully!
            </div>
          }
          @case ('error') {
            <div class="error-badge">
              <mat-icon>error</mat-icon> Failed to fetch QR. Is the instance running?
            </div>
            <button mat-stroked-button (click)="startPairing()">Retry</button>
          }
        }
      </div>

      <div class="allow-section">
        <label class="field-label">Allow From (phone numbers)</label>
        <mat-chip-grid #chipGrid>
          @for (num of allowFrom; track num) {
            <mat-chip [removable]="true" (removed)="removeAllow(num)">
              {{ num }}<button matChipRemove><mat-icon>cancel</mat-icon></button>
            </mat-chip>
          }
          <input placeholder="+15551234567" [matChipInputFor]="chipGrid"
            [matChipInputSeparatorKeyCodes]="separatorKeys"
            (matChipInputTokenEnd)="addAllow($event)" />
        </mat-chip-grid>

        <div class="form-actions">
          <mat-slide-toggle [(ngModel)]="isEnabled">Enabled</mat-slide-toggle>
          <button mat-flat-button color="primary" (click)="save()" [disabled]="saving()">
            @if (saving()) { Saving… } @else { Save & Apply }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .channel-form   { padding: 20px 0; max-width: 520px; }
    .channel-title  { font-size: 16px; font-weight: 600; margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
    .channel-hint   { color: var(--text-secondary); font-size: 13px; margin-bottom: 20px; }
    .pairing-section { margin-bottom: 24px; }
    .qr-wrap        { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-bottom: 12px; }
    .qr-image       { width: 220px; height: 220px; border-radius: var(--radius-md);
      border: 2px solid var(--border); background: #fff; }
    .qr-hint        { font-size: 13px; color: var(--text-secondary); margin: 0; }
    .qr-timer       { font-size: 11px; color: var(--text-secondary); margin: 0; }
    .paired-badge   { display: flex; align-items: center; gap: 8px; color: var(--accent-green); font-weight: 600; }
    .error-badge    { display: flex; align-items: center; gap: 8px; color: var(--accent-red); margin-bottom: 12px; }
    .allow-section  { display: flex; flex-direction: column; gap: 12px; }
    .field-label    { font-size: 13px; color: var(--text-secondary); }
    .form-actions   { display: flex; justify-content: space-between; align-items: center; }
  `],
})
export class WhatsappConfigComponent extends ChannelBase implements OnInit, OnDestroy {
  override readonly channelType = 'whatsapp';

  readonly separatorKeys = [ENTER, COMMA];
  allowFrom: string[] = [];
  isEnabled = false;

  readonly pairingState = signal<PairingState>('idle');
  readonly qrUrl        = signal<string | null>(null);

  private pollInterval?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    const cfg = this.parsedConfig<{ allowFrom?: string[] }>();
    this.allowFrom = cfg.allowFrom ?? [];
    this.isEnabled = this.config().isEnabled;
  }

  startPairing(): void {
    this.pairingState.set('polling');
    this.pollQr();
    this.pollInterval = setInterval(() => this.pollQr(), 3000);
  }

  stopPairing(): void {
    clearInterval(this.pollInterval);
    this.pairingState.set('idle');
    this.qrUrl.set(null);
  }

  private async pollQr(): Promise<void> {
    try {
      const blob = await firstValueFrom(
        this.http.get(
          `${environment.apiBase}/channels/instances/${this.instanceId()}/channels/whatsapp/qr`,
          { responseType: 'blob' }
        )
      );
      const url = URL.createObjectURL(blob);
      const old = this.qrUrl();
      if (old) URL.revokeObjectURL(old);
      this.qrUrl.set(url);
      this.pairingState.set('polling');
    } catch {
      clearInterval(this.pollInterval);
      this.pairingState.set('error');
    }
  }

  addAllow(e: MatChipInputEvent): void {
    const v = (e.value ?? '').trim();
    if (v) this.allowFrom = [...this.allowFrom, v];
    e.chipInput!.clear();
  }
  removeAllow(num: string): void { this.allowFrom = this.allowFrom.filter(x => x !== num); }

  async save(): Promise<void> {
    await this.saveConfig(this.isEnabled, { allowFrom: this.allowFrom });
  }

  ngOnDestroy(): void {
    clearInterval(this.pollInterval);
    const url = this.qrUrl();
    if (url) URL.revokeObjectURL(url);
  }
}
