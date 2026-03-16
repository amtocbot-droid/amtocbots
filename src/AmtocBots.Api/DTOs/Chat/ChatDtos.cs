using System.ComponentModel.DataAnnotations;

namespace AmtocBots.Api.DTOs.Chat;

public sealed record RoomSummaryDto(Guid Id, string Name, string? Description, bool IsGlobal);

public sealed record MessageDto(
    Guid Id,
    Guid RoomId,
    string SenderType,
    Guid SenderId,
    string SenderName,
    string Content,
    Guid[] Mentions,
    Guid? ReplyToId,
    DateTimeOffset CreatedAt,
    DateTimeOffset? EditedAt);

public sealed record CreateRoomRequest([Required, MaxLength(100)] string Name, string? Description, bool IsGlobal = false);

public sealed record BotMessageRequest(
    [Required] string ApiKey,
    [Required] string Content,
    Guid? ReplyToId = null);
