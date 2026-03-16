import { Component, OnDestroy, OnInit, inject, input, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragHandle, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { KanbanStore, CardDto, ColumnDto } from '../kanban.store';

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'var(--accent-red)',
  high:     'var(--accent-amber)',
  medium:   'var(--accent-blue)',
  low:      'var(--text-secondary)',
};

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [
    RouterLink, CdkDropList, CdkDrag, CdkDragHandle,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, FormsModule, DatePipe,
  ],
  template: `
    @if (store.loading()) {
      <div class="center-spinner"><mat-spinner diameter="40" /></div>
    } @else if (store.board()) {
      <div class="board-page">
        <div class="board-header">
          <a mat-icon-button routerLink="/kanban"><mat-icon>arrow_back</mat-icon></a>
          <h1 class="board-title">{{ store.board()!.name }}</h1>
          <span class="spacer"></span>
          <span class="card-count">{{ store.totalCards() }} cards</span>
          <button mat-flat-button color="primary" (click)="openAdd()">
            <mat-icon>add</mat-icon> Add Card
          </button>
        </div>

        <div class="columns-row"
          cdkDropListGroup>
          @for (col of store.board()!.columns; track col.id) {
            <div class="column">
              <div class="col-header" [style.border-top-color]="col.color || 'var(--border)'">
                <span class="col-name">{{ col.name }}</span>
                <span class="col-count">{{ col.cards.length }}</span>
                @if (col.wipLimit && col.cards.length >= col.wipLimit) {
                  <span class="wip-badge" matTooltip="WIP limit reached">WIP</span>
                }
              </div>
              <div class="cards-list"
                cdkDropList
                [id]="col.id"
                [cdkDropListData]="col.cards"
                [cdkDropListConnectedTo]="connectedLists()"
                (cdkDropListDropped)="onDrop($event, col)">
                @for (card of col.cards; track card.id) {
                  <div class="card" cdkDrag [cdkDragData]="card">
                    <div class="card-drag-handle" cdkDragHandle>
                      <mat-icon>drag_indicator</mat-icon>
                    </div>
                    <div class="card-body">
                      <div class="card-title">{{ card.title }}</div>
                      @if (card.description) {
                        <div class="card-desc">{{ card.description }}</div>
                      }
                      <div class="card-footer">
                        <span class="priority-dot"
                          [style.background]="priorityColor(card.priority)"
                          [matTooltip]="card.priority">
                        </span>
                        @if (card.labels.length > 0) {
                          @for (lbl of card.labels; track lbl) {
                            <span class="label-chip">{{ lbl }}</span>
                          }
                        }
                        @if (card.dueDate) {
                          <span class="due-date" [class.overdue]="isOverdue(card.dueDate)">
                            <mat-icon>event</mat-icon>{{ card.dueDate | date:'MMM d' }}
                          </span>
                        }
                        @if (card.createdByType === 'bot') {
                          <mat-icon class="bot-icon" matTooltip="Created by bot">smart_toy</mat-icon>
                        }
                      </div>
                    </div>
                    <div *cdkDragPlaceholder class="card-placeholder"></div>
                  </div>
                } @empty {
                  <div class="empty-col cdkDragDisabled">Drop cards here</div>
                }
              </div>
            </div>
          }
        </div>
      </div>

      @if (addCardOpen()) {
        <div class="overlay" (click)="addCardOpen.set(false)">
          <div class="add-dialog" (click)="$event.stopPropagation()">
            <h2>Add Card</h2>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Title</mat-label>
              <input matInput [(ngModel)]="newCard.title" autofocus (keydown.enter)="saveCard()" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description</mat-label>
              <textarea matInput [(ngModel)]="newCard.description" rows="3"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Priority</mat-label>
              <mat-select [(ngModel)]="newCard.priority">
                <mat-option value="low">Low</mat-option>
                <mat-option value="medium">Medium</mat-option>
                <mat-option value="high">High</mat-option>
                <mat-option value="critical">Critical</mat-option>
              </mat-select>
            </mat-form-field>
            <div class="dialog-actions">
              <button mat-stroked-button (click)="addCardOpen.set(false)">Cancel</button>
              <button mat-flat-button color="primary" (click)="saveCard()" [disabled]="!newCard.title.trim()">
                Add
              </button>
            </div>
          </div>
        </div>
      }
    } @else {
      <p class="error-state">Board not found.</p>
    }
  `,
  styles: [`
    .center-spinner { display: flex; justify-content: center; padding: 64px; }
    .board-page     { display: flex; flex-direction: column; height: 100%; gap: 16px; }
    .board-header   { display: flex; align-items: center; gap: 12px; }
    .board-title    { font-size: 22px; font-weight: 700; margin: 0; }
    .spacer         { flex: 1; }
    .card-count     { font-size: 13px; color: var(--text-secondary); }
    .columns-row    { display: flex; gap: 16px; overflow-x: auto; align-items: flex-start; padding-bottom: 16px; }
    .column         { min-width: 260px; max-width: 260px; background: var(--bg-surface);
                      border: 1px solid var(--border); border-radius: var(--radius-md);
                      display: flex; flex-direction: column; }
    .col-header     { display: flex; align-items: center; gap: 8px; padding: 12px 14px 10px;
                      border-top: 3px solid var(--border); border-radius: var(--radius-md) var(--radius-md) 0 0; }
    .col-name       { font-weight: 600; font-size: 13px; flex: 1; }
    .col-count      { font-size: 11px; color: var(--text-secondary);
                      background: var(--border); padding: 1px 6px; border-radius: 999px; }
    .wip-badge      { font-size: 10px; color: var(--accent-amber); border: 1px solid var(--accent-amber);
                      padding: 1px 5px; border-radius: 999px; }
    .cards-list     { padding: 8px; display: flex; flex-direction: column; gap: 8px;
                      min-height: 80px; }
    .card           { background: var(--bg-base); border: 1px solid var(--border); border-radius: var(--radius-sm);
                      display: flex; cursor: grab; transition: box-shadow .15s; }
    .card:hover     { box-shadow: 0 2px 10px rgba(0,0,0,.25); }
    .card.cdk-drag-dragging { opacity: .7; box-shadow: 0 6px 24px rgba(0,0,0,.4); }
    .card-drag-handle { display: flex; align-items: flex-start; padding: 8px 4px 8px 6px;
                        cursor: grab; color: var(--text-secondary); }
    .card-drag-handle mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .card-body      { flex: 1; padding: 8px 10px 8px 0; }
    .card-title     { font-size: 13px; font-weight: 500; margin-bottom: 4px; line-height: 1.4; }
    .card-desc      { font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;
                      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .card-footer    { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .priority-dot   { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .label-chip     { font-size: 10px; padding: 1px 6px; border-radius: 999px;
                      background: rgba(59,130,246,.12); color: var(--accent-blue); }
    .due-date       { display: flex; align-items: center; gap: 2px; font-size: 11px;
                      color: var(--text-secondary); }
    .due-date.overdue { color: var(--accent-red); }
    .due-date mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .bot-icon       { font-size: 12px; width: 12px; height: 12px; color: var(--accent-green); }
    .empty-col      { font-size: 12px; color: var(--text-secondary); text-align: center;
                      padding: 16px; border: 1px dashed var(--border); border-radius: var(--radius-sm); }
    .card-placeholder { border: 2px dashed var(--accent-blue); border-radius: var(--radius-sm);
                        height: 60px; background: rgba(59,130,246,.06); }
    .cdk-drop-list-dragging .card:not(.cdk-drag-placeholder) { transition: transform 250ms cubic-bezier(0,0,.2,1); }
    .error-state    { color: var(--accent-red); }
    .overlay        { position: fixed; inset: 0; background: rgba(0,0,0,.5);
                      display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .add-dialog     { background: var(--bg-surface); border: 1px solid var(--border);
                      border-radius: var(--radius-md); padding: 24px; min-width: 380px; }
    .add-dialog h2  { margin: 0 0 20px; font-size: 18px; font-weight: 700; }
    .full-width     { width: 100%; }
    .half-width     { width: 160px; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  `],
})
export class KanbanBoardComponent implements OnInit, OnDestroy {
  readonly id = input.required<string>();
  readonly store = inject(KanbanStore);

  readonly addCardOpen = signal(false);
  newCard = { title: '', description: '', priority: 'medium' as const };

  readonly connectedLists = computed(() =>
    this.store.board()?.columns.map(c => c.id) ?? []
  );

  async ngOnInit() {
    await this.store.loadBoard(this.id());
  }

  ngOnDestroy() {
    this.store.leaveBoard(this.id());
  }

  onDrop(event: CdkDragDrop<CardDto[]>, targetCol: ColumnDto) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      const card = event.container.data[event.currentIndex];
      this.store.moveCard(card.id, targetCol.id, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      const card = event.container.data[event.currentIndex];
      this.store.moveCard(card.id, targetCol.id, event.currentIndex);
    }
  }

  priorityColor(p: string) {
    return PRIORITY_COLORS[p] ?? 'var(--text-secondary)';
  }

  isOverdue(dateStr: string): boolean {
    return new Date(dateStr) < new Date();
  }

  openAdd() {
    this.newCard = { title: '', description: '', priority: 'medium' };
    this.addCardOpen.set(true);
  }

  async saveCard() {
    if (!this.newCard.title.trim()) return;
    await this.store.createCard(this.id(), { ...this.newCard });
    this.addCardOpen.set(false);
  }
}
