import { Component, OnInit, inject, input, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TelegramConfigComponent } from './telegram/telegram-config.component';
import { DiscordConfigComponent } from './discord/discord-config.component';
import { SlackConfigComponent } from './slack/slack-config.component';
import { WhatsappConfigComponent } from './whatsapp/whatsapp-config.component';

export interface ChannelConfigData {
  id?: string;
  channelType: string;
  isEnabled: boolean;
  configJson: string;
}

@Component({
  selector: 'app-channel-config',
  standalone: true,
  imports: [MatTabsModule, TelegramConfigComponent, DiscordConfigComponent, SlackConfigComponent, WhatsappConfigComponent],
  template: `
    <mat-tab-group animationDuration="200ms">
      <mat-tab label="Telegram">
        <app-telegram-config [instanceId]="instanceId()" [config]="getConfig('telegram')" (saved)="onSaved('telegram', $event)" />
      </mat-tab>
      <mat-tab label="WhatsApp">
        <app-whatsapp-config [instanceId]="instanceId()" [config]="getConfig('whatsapp')" (saved)="onSaved('whatsapp', $event)" />
      </mat-tab>
      <mat-tab label="Discord">
        <app-discord-config [instanceId]="instanceId()" [config]="getConfig('discord')" (saved)="onSaved('discord', $event)" />
      </mat-tab>
      <mat-tab label="Slack">
        <app-slack-config [instanceId]="instanceId()" [config]="getConfig('slack')" (saved)="onSaved('slack', $event)" />
      </mat-tab>
    </mat-tab-group>
  `,
})
export class ChannelConfigComponent implements OnInit {
  readonly instanceId = input.required<string>();
  private readonly http = inject(HttpClient);

  readonly configs = signal<ChannelConfigData[]>([]);

  async ngOnInit() {
    const data = await firstValueFrom(
      this.http.get<ChannelConfigData[]>(
        `${environment.apiBase}/channels/instances/${this.instanceId()}/channels`
      )
    );
    this.configs.set(data);
  }

  getConfig(type: string): ChannelConfigData {
    return this.configs().find(c => c.channelType === type)
      ?? { channelType: type, isEnabled: false, configJson: '{}' };
  }

  onSaved(type: string, updated: ChannelConfigData): void {
    this.configs.update(list => {
      const idx = list.findIndex(c => c.channelType === type);
      return idx >= 0 ? [...list.slice(0, idx), updated, ...list.slice(idx + 1)] : [...list, updated];
    });
  }
}
