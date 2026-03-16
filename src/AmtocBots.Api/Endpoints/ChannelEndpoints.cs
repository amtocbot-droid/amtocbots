using AmtocBots.Api.Data;
using AmtocBots.Api.Models;
using AmtocBots.Api.Services.Docker;
using AmtocBots.Api.Services.OpenClaw;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AmtocBots.Api.Endpoints;

public static class ChannelEndpoints
{
    public static RouteGroupBuilder MapChannelEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/instances/{id:guid}/channels", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var configs = await db.ChannelConfigs
                .Where(c => c.InstanceId == id)
                .Select(c => new { c.Id, c.ChannelType, c.IsEnabled, c.UpdatedAt })
                .ToListAsync(ct);
            return Results.Ok(configs);
        });

        group.MapPut("/instances/{id:guid}/channels/{type}", async (
            Guid id, string type,
            [FromBody] UpsertChannelRequest req,
            AppDbContext db,
            IDockerService docker,
            OpenClawConfigBuilder configBuilder,
            CancellationToken ct) =>
        {
            var existing = await db.ChannelConfigs
                .FirstOrDefaultAsync(c => c.InstanceId == id && c.ChannelType == type, ct);

            if (existing is null)
            {
                db.ChannelConfigs.Add(new ChannelConfig
                {
                    InstanceId = id, ChannelType = type,
                    IsEnabled = req.IsEnabled, ConfigJson = req.ConfigJson,
                });
            }
            else
            {
                existing.IsEnabled = req.IsEnabled;
                existing.ConfigJson = req.ConfigJson;
                existing.UpdatedAt = DateTimeOffset.UtcNow;
            }

            await db.SaveChangesAsync(ct);

            // Rebuild and write config, then restart if running
            var instance = await db.Instances.Include(i => i.ChannelConfigs).FirstOrDefaultAsync(i => i.Id == id, ct);
            if (instance is not null)
            {
                var config = configBuilder.Build(instance, instance.ChannelConfigs, "placeholder");
                await docker.WriteConfigVolumeAsync(id, config, ct);
                if (instance.ContainerId is not null && instance.Status == "running")
                    await docker.RestartContainerAsync(instance.ContainerId, ct);
            }

            return Results.NoContent();
        });

        group.MapGet("/instances/{id:guid}/channels/whatsapp/qr", async (
            Guid id, AppDbContext db,
            IOpenClawClient openClaw, CancellationToken ct) =>
        {
            var instance = await db.Instances.FindAsync([id], ct);
            if (instance is null) return Results.NotFound();
            if (instance.ContainerId is null) return Results.BadRequest("Instance not running");

            // Proxy QR from container on openclaw network
            var baseUrl = $"http://{instance.ContainerName}:18789";
            var qr = await openClaw.GetWhatsAppQrAsync(baseUrl, string.Empty, ct);
            if (qr is null) return Results.NotFound("QR not available yet");

            return Results.File(qr.ImageBytes, qr.ContentType);
        });

        return group;
    }
}

public sealed record UpsertChannelRequest(bool IsEnabled, string ConfigJson);
