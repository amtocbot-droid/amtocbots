using AmtocBots.Api.Data;
using AmtocBots.Api.DTOs.Chat;
using AmtocBots.Api.Hubs;
using AmtocBots.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AmtocBots.Api.Controllers;

[ApiController]
[Route("api/chat")]
[Authorize]
public sealed class ChatController(
    AppDbContext db,
    IHubContext<ChatHub> hub) : ControllerBase
{
    [HttpGet("rooms")]
    public async Task<IActionResult> ListRooms(CancellationToken ct)
    {
        var rooms = await db.ChatRooms
            .Select(r => new RoomSummaryDto(r.Id, r.Name, r.Description, r.IsGlobal))
            .ToListAsync(ct);
        return Ok(rooms);
    }

    [HttpPost("rooms")]
    [Authorize(Roles = "admin,operator")]
    public async Task<IActionResult> CreateRoom([FromBody] CreateRoomRequest req, CancellationToken ct)
    {
        var room = new ChatRoom
        {
            Name = req.Name,
            Description = req.Description,
            IsGlobal = req.IsGlobal,
            CreatedBy = GetUserId(),
        };
        db.ChatRooms.Add(room);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetMessages), new { id = room.Id }, room.Id);
    }

    [HttpGet("rooms/{id:guid}/messages")]
    public async Task<IActionResult> GetMessages(
        Guid id, [FromQuery] DateTimeOffset? before = null, [FromQuery] int limit = 50, CancellationToken ct = default)
    {
        var query = db.ChatMessages.Where(m => m.RoomId == id);
        if (before.HasValue) query = query.Where(m => m.CreatedAt < before.Value);

        var messages = await query
            .OrderByDescending(m => m.CreatedAt)
            .Take(limit)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(ct);

        var userIds = messages.Where(m => m.SenderType == "user").Select(m => m.SenderId).Distinct().ToList();
        var users = await db.Users.Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Username, ct);

        var botIds = messages.Where(m => m.SenderType == "bot").Select(m => m.SenderId).Distinct().ToList();
        var bots = await db.Instances.Where(i => botIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, i => i.Name, ct);

        var dtos = messages.Select(m => new MessageDto(
            m.Id, m.RoomId, m.SenderType, m.SenderId,
            m.SenderType == "user" ? users.GetValueOrDefault(m.SenderId, "Unknown") : bots.GetValueOrDefault(m.SenderId, "Bot"),
            m.Content, m.Mentions, m.ReplyToId, m.CreatedAt, m.EditedAt));

        return Ok(dtos);
    }

    [HttpPost("rooms/{id:guid}/members")]
    [Authorize(Roles = "admin,operator")]
    public async Task<IActionResult> AddMember(Guid id, [FromBody] AddMemberRequest req, CancellationToken ct)
    {
        var member = new ChatRoomMember { RoomId = id, MemberType = req.MemberType, MemberId = req.MemberId };
        db.ChatRoomMembers.Add(member);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("rooms/{id:guid}/bot-message")]
    [AllowAnonymous]
    public async Task<IActionResult> BotMessage(Guid id, [FromBody] BotMessageRequest req, CancellationToken ct)
    {
        // Extract instance ID from route context — identify via API key
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (authHeader is null || !authHeader.StartsWith("Bearer ")) return Unauthorized();
        var token = authHeader["Bearer ".Length..];

        var instance = await db.Instances
            .Where(i => i.ApiBearerTokenHash != null && db.Instances.Any(x => x.Id == i.Id))
            .ToListAsync(ct);

        var matched = instance.FirstOrDefault(i =>
            i.ApiBearerTokenHash is not null && BCrypt.Net.BCrypt.Verify(token, i.ApiBearerTokenHash));
        if (matched is null) return Unauthorized();

        var msg = new ChatMessage
        {
            RoomId = id,
            SenderType = "bot",
            SenderId = matched.Id,
            Content = req.Content,
            ReplyToId = req.ReplyToId,
        };
        db.ChatMessages.Add(msg);
        await db.SaveChangesAsync(ct);

        await hub.Clients.Group($"room:{id}").SendAsync("MessageReceived", new
        {
            id = msg.Id,
            roomId = id,
            senderType = "bot",
            senderId = matched.Id,
            senderName = matched.Name,
            content = req.Content,
            replyToId = req.ReplyToId,
            createdAt = msg.CreatedAt,
        }, ct);

        return Ok(msg.Id);
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirst("sub")!.Value);
}

public sealed record AddMemberRequest(string MemberType, Guid MemberId);
