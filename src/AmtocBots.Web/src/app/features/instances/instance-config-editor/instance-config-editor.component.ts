import { Component, OnInit, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-instance-config-editor',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MonacoEditorModule, FormsModule],
  template: `
    <div class="editor-toolbar">
      <span class="editor-label">JSON5 Configuration</span>
      <span class="spacer"></span>
      <button mat-stroked-button (click)="reload()" [disabled]="loading()">
        <mat-icon>refresh</mat-icon> Reload
      </button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="loading() || !dirty()">
        <mat-icon>save</mat-icon> Save & Restart
      </button>
    </div>

    <ngx-monaco-editor
      class="config-editor"
      [options]="editorOptions"
      [(ngModel)]="configValue"
      (ngModelChange)="dirty.set(true)" />

    @if (dirty()) {
      <div class="dirty-banner">
        <mat-icon>warning</mat-icon> Unsaved changes — saving will restart the container.
      </div>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; }
    .editor-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .editor-label   { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
    .spacer         { flex: 1; }
    .config-editor  { height: 460px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
    .dirty-banner   { display: flex; align-items: center; gap: 6px; margin-top: 8px;
      font-size: 12px; color: var(--accent-amber); }
    .dirty-banner mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `],
})
export class InstanceConfigEditorComponent implements OnInit {
  readonly instanceId = input.required<string>();

  private readonly http  = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);

  readonly loading     = signal(false);
  readonly dirty       = signal(false);
  configValue          = '';

  readonly editorOptions = {
    theme: 'vs-dark',
    language: 'json',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
  };

  async ngOnInit() { await this.reload(); }

  async reload() {
    this.loading.set(true);
    try {
      this.configValue = await firstValueFrom(
        this.http.get(`${environment.apiBase}/instances/${this.instanceId()}/config`, { responseType: 'text' })
      );
      this.dirty.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  async save() {
    this.loading.set(true);
    try {
      // TODO Phase 5: add PUT /instances/:id/config endpoint and call it here
      // For now just notify — config is rebuilt from channel configs
      this.snack.open('Config will be rebuilt from channel settings on next start.', undefined, { duration: 4000 });
      this.dirty.set(false);
    } finally {
      this.loading.set(false);
    }
  }
}
