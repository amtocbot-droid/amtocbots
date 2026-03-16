using AmtocBots.Api.Data;
using AmtocBots.Api.Hubs;
using AmtocBots.Api.Services.Docker;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AmtocBots.Api.BackgroundServices;

public sealed class MetricsPollingService(
    IServiceScopeFactory scopeFactory,
    IHubContext<InstanceHub> hub,
    IDockerService docker,
    ILogger<MetricsPollingService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        log.LogInformation("Metrics polling service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PollAndBroadcastAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                log.LogWarning(ex, "Error during metrics polling");
            }

            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }

    private async Task PollAndBroadcastAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var running = await db.Instances
            .Where(i => i.ContainerId != null && i.Status == "running")
            .Select(i => new { i.Id, ContainerId = i.ContainerId! })
            .ToListAsync(ct);

        if (running.Count == 0) return;

        var stats = await docker.GetAllManagedStatsAsync(
            running.Select(r => (r.Id, r.ContainerId)), ct);

        foreach (var stat in stats)
        {
            await hub.Clients.Group($"instance:{stat.InstanceId}")
                .SendAsync("StatusUpdate", stat, ct);
        }

        // Sync status changes back to DB
        var statusMap = stats.ToDictionary(s => s.InstanceId, s => s.Status);
        foreach (var inst in running)
        {
            if (statusMap.TryGetValue(inst.Id, out var newStatus))
            {
                var entity = await db.Instances.FindAsync([inst.Id], ct);
                if (entity is not null && entity.Status != newStatus)
                {
                    entity.Status = newStatus;
                    entity.UpdatedAt = DateTimeOffset.UtcNow;
                }
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
