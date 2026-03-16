using AmtocBots.Api.Data;
using AmtocBots.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AmtocBots.Api.Hubs;

[Authorize]
public sealed class ChatHub(AppDbContext db) : Hub
{
    public async Task JoinRoom(string roomId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"room:{roomId}");
        await Clients.Group($"room:{roomId}")
            .SendAsync("UserJoined", GetUserId(), GetUsername());
    }

    public async Task LeaveRoom(string roomId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"room:{roomId}");
        await Clients.Group($"room:{roomId}")
            .SendAsync("UserLeft", GetUserId(), GetUsername());
    }

    public async Task SendMessage(string roomId, string content, string? replyToId = null)
    {
        var userId = GetUserId();
        var msg = new ChatMessage
        {
            RoomId = Guid.Parse(roomId),
            SenderType = "user",
            SenderId = userId,
            Content = content,
            ReplyToId = replyToId is null ? null : Guid.Parse(replyToId),
        };

        db.ChatMessages.Add(msg);
        await db.SaveChangesAsync();

        await Clients.Group($"room:{roomId}").SendAsync("MessageReceived", new
        {
            id = msg.Id,
            roomId,
            senderType = "user",
            senderId = userId,
            senderName = GetUsername(),
            content,
            replyToId,
            createdAt = msg.CreatedAt,
        });
    }

    public Task SendTyping(string roomId) =>
        Clients.OthersInGroup($"room:{roomId}")
            .SendAsync("UserTyping", GetUserId(), GetUsername());

    private Guid GetUserId() =>
        Guid.Parse(Context.User!.FindFirst("sub")!.Value);

    private string GetUsername() =>
        Context.User!.FindFirst("preferred_username")?.Value ?? "Unknown";
}
