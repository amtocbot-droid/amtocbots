using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AmtocBots.Api.Hubs;

[Authorize]
public sealed class InstanceHub : Hub
{
    public Task SubscribeToInstance(string instanceId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, $"instance:{instanceId}");

    public Task UnsubscribeFromInstance(string instanceId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, $"instance:{instanceId}");
}
