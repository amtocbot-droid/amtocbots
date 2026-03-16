import { Directive, EventEmitter, Output, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChannelConfigData } from './channel-config.component';

@Directive()
export abstract class ChannelBase {
  abstract readonly channelType: string;

  readonly instanceId = input.required<string>();
  readonly config     = input<ChannelConfigData>({ channelType: '', isEnabled: false, configJson: '{}' });

  @Output() saved = new EventEmitter<ChannelConfigData>();

  protected readonly http  = inject(HttpClient);
  protected readonly snack = inject(MatSnackBar);
  readonly saving = signal(false);

  protected async saveConfig(isEnabled: boolean, configObj: Record<string, unknown>): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.http.put<void>(
          `${environment.apiBase}/channels/instances/${this.instanceId()}/channels/${this.channelType}`,
          { isEnabled, configJson: JSON.stringify(configObj) }
        )
      );
      const updated: ChannelConfigData = {
        ...this.config(),
        channelType: this.channelType,
        isEnabled,
        configJson: JSON.stringify(configObj),
      };
      this.saved.emit(updated);
      this.snack.open(`${this.channelType} config saved. Container will restart.`, undefined, { duration: 3500 });
    } catch (e: any) {
      this.snack.open(e?.error?.detail ?? 'Save failed', 'Dismiss', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  protected parsedConfig<T extends Record<string, unknown>>(): T {
    try { return JSON.parse(this.config().configJson) as T; }
    catch { return {} as T; }
  }
}
