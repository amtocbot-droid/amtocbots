import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';

interface OllamaModel {
  name: string;
  size?: string;
  modifiedAt?: string;
}

interface LearningDto {
  id: string;
  sourceInstanceId: string;
  content: string;
  tags: string[];
  createdAt: string;
}

interface InstanceSummary {
  id: string;
  name: string;
}

@Component({
  selector: 'app-ollama-dashboard',
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatChipsModule, MatProgressSpinnerModule, MatTooltipModule,
    MatSelectModule, MatSnackBarModule, DatePipe,
  ],
  template: `
    <h1 class="page-title">Ollama & Learnings</h1>

    <!-- Ollama status card -->
    <div class="section-grid">
      <mat-card class="status-card">
        <mat-card-header><mat-card-title>Ollama</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="status-row">
            <span class="status-dot" [class.green]="ollamaHealthy()" [class.red]="ollamaHealthy() === false"></span>
            <span>{{ ollamaHealthy() === null ? 'Checking…' : ollamaHealthy() ? 'Running' : 'Unreachable' }}</span>
          </div>

          <div class="pull-row">
            <mat-form-field appearance="outline" class="pull-field">
              <mat-label>Pull model</mat-label>
              <input matInput [(ngModel)]="pullModel" placeholder="llama3.2" (keydown.enter)="pullOllamaModel()" />
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="pullOllamaModel()"
              [disabled]="!pullModel.trim() || pulling()">
              @if (pulling()) { <mat-spinner diameter="18"></mat-spinner> }
              @else { <mat-icon>download</mat-icon> Pull }
            </button>
          </div>

          <div class="models-list">
            @for (m of ollamaModels(); track m.name) {
              <div class="model-item">
                <mat-icon>memory</mat-icon>
                <span class="model-name">{{ m.name }}</span>
                @if (m.size) { <span class="model-size">{{ m.size }}</span> }
              </div>
            } @empty {
              <p class="empty-hint">No local models. Pull one above.</p>
            }
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Learnings search card -->
      <mat-card class="search-card">
        <mat-card-header><mat-card-title>Semantic Search</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="search-row">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Search learnings</mat-label>
              <input matInput [(ngModel)]="searchQuery" (keydown.enter)="search()" />
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="search()" [disabled]="!searchQuery.trim() || searching()">
              @if (searching()) { <mat-spinner diameter="18"></mat-spinner> }
              @else { <mat-icon>search</mat-icon> Search }
            </button>
          </div>
          @for (r of searchResults(); track r.id) {
            <div class="learning-result">
              <div class="learning-content">{{ r.content }}</div>
              <div class="learning-meta">
                @for (t of r.tags; track t) { <span class="tag-chip">{{ t }}</span> }
                <span class="learning-date">{{ r.createdAt | date:'mediumDate' }}</span>
              </div>
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>

    <!-- Learnings CRUD -->
    <mat-card class="learnings-card">
      <mat-card-header>
        <mat-card-title>Bot Learnings</mat-card-title>
        <div class="header-actions">
          <mat-form-field appearance="outline" class="filter-select">
            <mat-label>Instance</mat-label>
            <mat-select [(ngModel)]="filterInstance" (ngModelChange)="loadLearnings()">
              <mat-option value="">All</mat-option>
              @for (i of instances(); track i.id) {
                <mat-option [value]="i.id">{{ i.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="filter-select">
            <mat-label>Tag</mat-label>
            <input matInput [(ngModel)]="filterTag" (keydown.enter)="loadLearnings()" />
          </mat-form-field>
        </div>
      </mat-card-header>
      <mat-card-content>
        @for (l of learnings(); track l.id) {
          <div class="learning-row">
            <div class="learning-body">
              <div class="learning-content">{{ l.content }}</div>
              <div class="learning-meta">
                <span class="source-name">{{ instanceName(l.sourceInstanceId) }}</span>
                @for (t of l.tags; track t) { <span class="tag-chip">{{ t }}</span> }
                <span class="learning-date">{{ l.createdAt | date:'mediumDate' }}</span>
              </div>
            </div>
            @if (auth.isOperator()) {
              <button mat-icon-button color="warn" (click)="deleteLearning(l.id)" matTooltip="Delete">
                <mat-icon>delete</mat-icon>
              </button>
            }
          </div>
        } @empty {
          <p class="empty-hint">No learnings recorded yet.</p>
        }

        @if (auth.isOperator()) {
          <div class="add-learning">
            <h3>Add Learning</h3>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Source Instance</mat-label>
              <mat-select [(ngModel)]="newLearning.instanceId">
                @for (i of instances(); track i.id) {
                  <mat-option [value]="i.id">{{ i.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Content</mat-label>
              <textarea matInput [(ngModel)]="newLearning.content" rows="3"
                placeholder="Describe what was learned…"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Tags (comma-separated)</mat-label>
              <input matInput [(ngModel)]="newLearning.tagsRaw" placeholder="trading, strategy, risk" />
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="addLearning()"
              [disabled]="!newLearning.content.trim() || !newLearning.instanceId || saving()">
              <mat-icon>save</mat-icon> Save Learning
            </button>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .page-title       { font-size: 22px; font-weight: 700; margin: 0 0 24px; }
    .section-grid     { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    @media (max-width: 900px) { .section-grid { grid-template-columns: 1fr; } }
    .status-card, .search-card, .learnings-card { background: var(--bg-surface); border: 1px solid var(--border); }
    .status-row       { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 14px; }
    .status-dot       { width: 10px; height: 10px; border-radius: 50%; background: var(--text-secondary); }
    .status-dot.green { background: var(--accent-green); }
    .status-dot.red   { background: var(--accent-red); }
    .pull-row         { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
    .pull-field       { flex: 1; }
    .models-list      { display: flex; flex-direction: column; gap: 6px; }
    .model-item       { display: flex; align-items: center; gap: 8px; font-size: 13px;
                        padding: 6px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
    .model-item mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--accent-blue); }
    .model-name       { flex: 1; }
    .model-size       { font-size: 11px; color: var(--text-secondary); }
    .search-row       { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
    .search-field     { flex: 1; }
    .learning-result  { border: 1px solid var(--border); border-radius: var(--radius-sm);
                        padding: 10px 14px; margin-bottom: 8px; background: var(--bg-base); }
    .learning-content { font-size: 13px; margin-bottom: 6px; line-height: 1.5; }
    .learning-meta    { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .tag-chip         { font-size: 10px; padding: 1px 7px; border-radius: 999px;
                        background: rgba(59,130,246,.12); color: var(--accent-blue); }
    .learning-date    { font-size: 11px; color: var(--text-secondary); }
    .header-actions   { display: flex; gap: 8px; margin-left: auto; align-items: center; }
    .filter-select    { width: 160px; }
    .learnings-card   { margin-bottom: 20px; }
    .learning-row     { display: flex; align-items: flex-start; gap: 8px; padding: 10px 0;
                        border-bottom: 1px solid var(--border); }
    .learning-row:last-of-type { border-bottom: none; }
    .learning-body    { flex: 1; }
    .source-name      { font-size: 11px; color: var(--text-secondary); font-weight: 500; }
    .add-learning     { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border);
                        display: flex; flex-direction: column; gap: 12px; }
    .add-learning h3  { margin: 0; font-size: 14px; font-weight: 600; }
    .full-width       { width: 100%; }
    .empty-hint       { font-size: 13px; color: var(--text-secondary); }
  `],
})
export class OllamaDashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly auth = inject(AuthService);
  private readonly snack = inject(MatSnackBar);

  readonly ollamaHealthy = signal<boolean | null>(null);
  readonly ollamaModels  = signal<OllamaModel[]>([]);
  readonly learnings     = signal<LearningDto[]>([]);
  readonly instances     = signal<InstanceSummary[]>([]);
  readonly searchResults = signal<LearningDto[]>([]);

  readonly pulling   = signal(false);
  readonly searching = signal(false);
  readonly saving    = signal(false);

  pullModel    = '';
  searchQuery  = '';
  filterInstance = '';
  filterTag    = '';

  newLearning = { instanceId: '', content: '', tagsRaw: '' };

  async ngOnInit() {
    await Promise.all([this.checkHealth(), this.loadModels(), this.loadLearnings(), this.loadInstances()]);
  }

  private async checkHealth() {
    const result = await firstValueFrom(this.http.get<{ healthy: boolean }>(`${environment.apiBase}/ollama/status`));
    this.ollamaHealthy.set(result.healthy);
  }

  private async loadModels() {
    const models = await firstValueFrom(this.http.get<OllamaModel[]>(`${environment.apiBase}/ollama/models`));
    this.ollamaModels.set(models);
  }

  private async loadInstances() {
    const list = await firstValueFrom(this.http.get<InstanceSummary[]>(`${environment.apiBase}/instances`));
    this.instances.set(list);
  }

  async loadLearnings() {
    const params = new URLSearchParams();
    if (this.filterInstance) params.set('instanceId', this.filterInstance);
    if (this.filterTag.trim()) params.set('tag', this.filterTag.trim());
    const data = await firstValueFrom(
      this.http.get<LearningDto[]>(`${environment.apiBase}/learnings?${params}`)
    );
    this.learnings.set(data);
  }

  async pullOllamaModel() {
    if (!this.pullModel.trim()) return;
    this.pulling.set(true);
    try {
      await firstValueFrom(this.http.post(`${environment.apiBase}/ollama/pull`, { model: this.pullModel.trim() }));
      this.snack.open(`Pulling ${this.pullModel}…`, undefined, { duration: 3000 });
      this.pullModel = '';
      await this.loadModels();
    } catch {
      this.snack.open('Pull failed — check Ollama is running', 'Dismiss', { duration: 5000 });
    } finally {
      this.pulling.set(false);
    }
  }

  async search() {
    if (!this.searchQuery.trim()) return;
    this.searching.set(true);
    try {
      const results = await firstValueFrom(
        this.http.get<LearningDto[]>(`${environment.apiBase}/learnings/search?q=${encodeURIComponent(this.searchQuery)}`)
      );
      this.searchResults.set(results);
    } finally {
      this.searching.set(false);
    }
  }

  async addLearning() {
    if (!this.newLearning.content.trim() || !this.newLearning.instanceId) return;
    this.saving.set(true);
    try {
      const tags = this.newLearning.tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
      await firstValueFrom(this.http.post(`${environment.apiBase}/learnings`, {
        sourceInstanceId: this.newLearning.instanceId,
        content: this.newLearning.content,
        tags,
      }));
      this.newLearning = { instanceId: '', content: '', tagsRaw: '' };
      await this.loadLearnings();
    } finally {
      this.saving.set(false);
    }
  }

  async deleteLearning(id: string) {
    await firstValueFrom(this.http.delete(`${environment.apiBase}/learnings/${id}`));
    this.learnings.update(ls => ls.filter(l => l.id !== id));
  }

  instanceName(id: string): string {
    return this.instances().find(i => i.id === id)?.name ?? id.substring(0, 8);
  }
}
