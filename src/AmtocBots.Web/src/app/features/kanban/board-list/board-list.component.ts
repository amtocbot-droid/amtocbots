import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { KanbanStore } from '../kanban.store';

@Component({
  selector: 'app-board-list',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <div class="page-header">
      <h1 class="page-title">Kanban Boards</h1>
      <button mat-flat-button color="primary" (click)="openCreate()">
        <mat-icon>add</mat-icon> New Board
      </button>
    </div>

    @if (store.loading()) {
      <p class="hint">Loading…</p>
    }

    <div class="boards-grid">
      @for (b of store.boards(); track b.id) {
        <mat-card class="board-card" [routerLink]="['/kanban', b.id]">
          <mat-card-content>
            <div class="board-name">{{ b.name }}</div>
            @if (b.description) {
              <div class="board-desc">{{ b.description }}</div>
            }
            <div class="board-meta">{{ b.createdAt | date:'mediumDate' }}</div>
          </mat-card-content>
        </mat-card>
      } @empty {
        @if (!store.loading()) {
          <p class="empty-state">No boards yet. Create one to get started.</p>
        }
      }
    </div>

    @if (creating()) {
      <div class="create-overlay" (click)="creating.set(false)">
        <div class="create-dialog" (click)="$event.stopPropagation()">
          <h2>New Board</h2>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Board name</mat-label>
            <input matInput [(ngModel)]="newName" (keydown.enter)="save()" autofocus />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description (optional)</mat-label>
            <input matInput [(ngModel)]="newDesc" />
          </mat-form-field>
          <div class="dialog-actions">
            <button mat-stroked-button (click)="creating.set(false)">Cancel</button>
            <button mat-flat-button color="primary" (click)="save()" [disabled]="!newName.trim() || saving()">
              Create
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-header  { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .page-title   { font-size: 22px; font-weight: 700; margin: 0; flex: 1; }
    .boards-grid  { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .board-card   { background: var(--bg-surface); border: 1px solid var(--border); cursor: pointer;
                    transition: box-shadow .2s; }
    .board-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.3); }
    .board-name   { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
    .board-desc   { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
    .board-meta   { font-size: 11px; color: var(--text-secondary); }
    .empty-state, .hint { color: var(--text-secondary); font-size: 13px; }
    .create-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex;
                      align-items: center; justify-content: center; z-index: 1000; }
    .create-dialog  { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-md);
                      padding: 24px; min-width: 360px; }
    .create-dialog h2 { margin: 0 0 20px; font-size: 18px; font-weight: 700; }
    .full-width   { width: 100%; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  `],
})
export class BoardListComponent implements OnInit {
  readonly store = inject(KanbanStore);

  readonly creating = signal(false);
  readonly saving   = signal(false);
  newName = '';
  newDesc = '';

  async ngOnInit() {
    await this.store.loadBoards();
  }

  openCreate() {
    this.newName = '';
    this.newDesc = '';
    this.creating.set(true);
  }

  async save() {
    if (!this.newName.trim()) return;
    this.saving.set(true);
    try {
      await this.store.createBoard(this.newName.trim(), this.newDesc.trim() || undefined);
      this.creating.set(false);
    } finally {
      this.saving.set(false);
    }
  }
}
