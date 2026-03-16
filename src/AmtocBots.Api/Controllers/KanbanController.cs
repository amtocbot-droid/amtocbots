using AmtocBots.Api.Data;
using AmtocBots.Api.DTOs.Kanban;
using AmtocBots.Api.Hubs;
using AmtocBots.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AmtocBots.Api.Controllers;

[ApiController]
[Route("api/kanban")]
[Authorize]
public sealed class KanbanController(
    AppDbContext db,
    IHubContext<KanbanHub> hub) : ControllerBase
{
    [HttpGet("boards")]
    public async Task<IActionResult> ListBoards(CancellationToken ct)
    {
        var boards = await db.KanbanBoards
            .Select(b => new BoardSummaryDto(b.Id, b.Name, b.Description, b.CreatedAt))
            .ToListAsync(ct);
        return Ok(boards);
    }

    [HttpPost("boards")]
    [Authorize(Roles = "admin,operator")]
    public async Task<IActionResult> CreateBoard([FromBody] CreateBoardRequest req, CancellationToken ct)
    {
        var board = new KanbanBoard { Name = req.Name, Description = req.Description, CreatedBy = GetUserId() };
        // Default columns
        board.Columns.Add(new KanbanColumn { Name = "Backlog",     Position = 0 });
        board.Columns.Add(new KanbanColumn { Name = "In Progress", Position = 1, Color = "#3b82f6" });
        board.Columns.Add(new KanbanColumn { Name = "Review",      Position = 2, Color = "#f59e0b" });
        board.Columns.Add(new KanbanColumn { Name = "Done",        Position = 3, Color = "#10b981" });
        db.KanbanBoards.Add(board);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetBoard), new { id = board.Id }, board.Id);
    }

    [HttpGet("boards/{id:guid}")]
    public async Task<IActionResult> GetBoard(Guid id, CancellationToken ct)
    {
        var board = await db.KanbanBoards
            .Include(b => b.Columns.OrderBy(c => c.Position))
                .ThenInclude(c => c.Cards.OrderBy(k => k.Position))
                    .ThenInclude(k => k.AssignedInstance)
            .FirstOrDefaultAsync(b => b.Id == id, ct);
        if (board is null) return NotFound();

        return Ok(new BoardDetailDto(board.Id, board.Name, board.Description,
            board.Columns.Select(c => new ColumnDto(c.Id, c.Name, c.Position, c.Color, c.WipLimit,
                c.Cards.Select(k => MapCard(k)).ToList())).ToList()));
    }

    [HttpPost("boards/{id:guid}/cards")]
    public async Task<IActionResult> CreateCard(Guid id, [FromBody] CreateCardRequest req, CancellationToken ct)
    {
        var firstCol = await db.KanbanColumns
            .Where(c => c.BoardId == id)
            .OrderBy(c => c.Position)
            .FirstOrDefaultAsync(ct);
        if (firstCol is null) return BadRequest("Board has no columns");

        var maxPos = await db.KanbanCards.Where(k => k.ColumnId == firstCol.Id).MaxAsync(k => (int?)k.Position, ct) ?? -1;
        var card = new KanbanCard
        {
            ColumnId = firstCol.Id,
            BoardId = id,
            Title = req.Title,
            Description = req.Description,
            Priority = req.Priority,
            Labels = req.Labels ?? [],
            DueDate = req.DueDate,
            Position = maxPos + 1,
            AssignedInstanceId = req.AssignedInstanceId,
            AssignedUserId = req.AssignedUserId,
            CreatedByType = "human",
            CreatedById = GetUserId(),
        };
        db.KanbanCards.Add(card);
        await db.SaveChangesAsync(ct);

        await hub.Clients.Group($"board:{id}").SendAsync("CardCreated", MapCard(card), ct);
        return CreatedAtAction(nameof(GetBoard), new { id }, card.Id);
    }

    [HttpPatch("cards/{cardId:guid}/move")]
    public async Task<IActionResult> MoveCard(Guid cardId, [FromBody] MoveCardRequest req, CancellationToken ct)
    {
        var card = await db.KanbanCards.FindAsync([cardId], ct);
        if (card is null) return NotFound();

        card.ColumnId = req.TargetColumnId;
        card.Position = req.Position;
        card.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        await hub.Clients.Group($"board:{card.BoardId}").SendAsync("CardMoved",
            new { cardId, targetColumnId = req.TargetColumnId, position = req.Position }, ct);
        return NoContent();
    }

    [HttpPost("bot-webhook")]
    [AllowAnonymous] // auth handled manually via API key
    public async Task<IActionResult> BotWebhook([FromBody] BotWebhookCardRequest req, CancellationToken ct)
    {
        var instance = await db.Instances
            .Where(i => i.Id == req.InstanceId)
            .Select(i => new { i.ApiBearerTokenHash })
            .FirstOrDefaultAsync(ct);

        if (instance?.ApiBearerTokenHash is null || !BCrypt.Net.BCrypt.Verify(req.ApiKey, instance.ApiBearerTokenHash))
            return Unauthorized();

        var colId = req.ColumnId ?? (await db.KanbanColumns
            .Where(c => c.BoardId == req.BoardId)
            .OrderBy(c => c.Position)
            .Select(c => c.Id)
            .FirstOrDefaultAsync(ct));

        if (colId == default) return BadRequest("Board not found or has no columns");

        var maxPos = await db.KanbanCards.Where(k => k.ColumnId == colId).MaxAsync(k => (int?)k.Position, ct) ?? -1;
        var card = new KanbanCard
        {
            ColumnId = colId,
            BoardId = req.BoardId,
            Title = req.Title,
            Description = req.Description,
            Priority = req.Priority,
            Position = maxPos + 1,
            AssignedInstanceId = req.InstanceId,
            CreatedByType = "bot",
            CreatedById = req.InstanceId,
        };
        db.KanbanCards.Add(card);
        await db.SaveChangesAsync(ct);

        await hub.Clients.Group($"board:{req.BoardId}").SendAsync("CardCreated", MapCard(card), ct);
        return Ok(card.Id);
    }

    private static CardDto MapCard(KanbanCard k) => new(
        k.Id, k.ColumnId, k.Title, k.Description, k.Priority, k.Labels, k.DueDate,
        k.Position, k.AssignedInstanceId, k.AssignedUserId, k.CreatedByType, k.CreatedById, k.CreatedAt);

    private Guid GetUserId() => Guid.Parse(User.FindFirst("sub")!.Value);
}
