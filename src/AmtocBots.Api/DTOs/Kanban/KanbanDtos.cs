using System.ComponentModel.DataAnnotations;

namespace AmtocBots.Api.DTOs.Kanban;

public sealed record BoardSummaryDto(Guid Id, string Name, string? Description, DateTimeOffset CreatedAt);

public sealed record BoardDetailDto(Guid Id, string Name, string? Description, List<ColumnDto> Columns);

public sealed record ColumnDto(Guid Id, string Name, int Position, string? Color, int? WipLimit, List<CardDto> Cards);

public sealed record CardDto(
    Guid Id,
    Guid ColumnId,
    string Title,
    string? Description,
    string? Priority,
    string[] Labels,
    DateTimeOffset? DueDate,
    int Position,
    Guid? AssignedInstanceId,
    Guid? AssignedUserId,
    string CreatedByType,
    Guid CreatedById,
    DateTimeOffset CreatedAt);

public sealed record CreateBoardRequest([Required, MaxLength(100)] string Name, string? Description);

public sealed record CreateColumnRequest([Required] string Name, int Position, string? Color, int? WipLimit);

public sealed record CreateCardRequest(
    [Required, MaxLength(255)] string Title,
    string? Description,
    string? Priority,
    string[]? Labels,
    DateTimeOffset? DueDate,
    Guid? AssignedInstanceId,
    Guid? AssignedUserId);

public sealed record MoveCardRequest(Guid TargetColumnId, int Position);

public sealed record BotWebhookCardRequest(
    [Required] string ApiKey,
    [Required] Guid BoardId,
    Guid? ColumnId, // defaults to first column if omitted
    [Required, MaxLength(255)] string Title,
    string? Description,
    string? Priority,
    Guid InstanceId);
