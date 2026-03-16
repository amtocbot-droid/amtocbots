using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AmtocBots.Api.Hubs;

[Authorize]
public sealed class KanbanHub : Hub
{
    public Task JoinBoard(string boardId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, $"board:{boardId}");

    public Task LeaveBoard(string boardId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, $"board:{boardId}");
}
