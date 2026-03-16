using AmtocBots.Api.Data;
using AmtocBots.Api.Services.Docker;
using AmtocBots.Api.Services.OpenClaw;
using Microsoft.EntityFrameworkCore;

namespace AmtocBots.Api.Services.Models;

public sealed class ModelSwitchingService(
    AppDbContext db,
    IDockerService docker,
    OpenClawConfigBuilder configBuilder,
    ILogger<ModelSwitchingService> log) : IModelSwitchingService
{
    // Daily token limits per model provider (configurable, sensible defaults)
    private static readonly Dictionary<string, long> DailyTokenLimits = new()
    {
        ["anthropic/"] = 1_000_000,
        ["openai/"] = 1_000_000,
        ["google/"] = 1_000_000,
    };

    public async Task EvaluateThresholdRulesAsync(Guid instanceId, CancellationToken ct = default)
    {
        var rules = await db.SwitchRules
            .Where(r => r.InstanceId == instanceId && r.IsActive && r.RuleType == "threshold")
            .OrderByDescending(r => r.Priority)
            .ToListAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        foreach (var rule in rules)
        {
            if (rule.TriggerModel is null || rule.ThresholdPct is null) continue;

            var usage = await db.TokenUsage
                .Where(u => u.InstanceId == instanceId && u.Model == rule.TriggerModel && u.UsageDate == today)
                .FirstOrDefaultAsync(ct);

            if (usage is null) continue;

            var limit = GetDailyLimit(rule.TriggerModel);
            var usedPct = (int)(usage.TotalTokens * 100 / limit);

            if (usedPct >= rule.ThresholdPct)
            {
                log.LogInformation("Instance {Id}: model {Model} at {Pct}% — switching to {Target}",
                    instanceId, rule.TriggerModel, usedPct, rule.TargetModel);
                await SwitchModelAsync(instanceId, rule.TargetModel, ct);
                return; // highest-priority rule wins
            }
        }
    }

    public async Task SwitchModelAsync(Guid instanceId, string targetModel, CancellationToken ct = default)
    {
        var instance = await db.Instances
            .Include(i => i.ChannelConfigs)
            .FirstOrDefaultAsync(i => i.Id == instanceId, ct)
            ?? throw new InvalidOperationException($"Instance {instanceId} not found");

        if (instance.CurrentModel == targetModel) return;

        instance.CurrentModel = targetModel;
        instance.UpdatedAt = DateTimeOffset.UtcNow;

        // Rebuild and write config
        var token = instance.ApiBearerTokenHash ?? string.Empty; // actual token stored separately
        var config = configBuilder.Build(instance, instance.ChannelConfigs, token);
        await docker.WriteConfigVolumeAsync(instanceId, config, ct);

        // Restart container to pick up new model
        if (instance.ContainerId is not null)
            await docker.RestartContainerAsync(instance.ContainerId, ct);

        await db.SaveChangesAsync(ct);
        log.LogInformation("Instance {Id} switched to model {Model}", instanceId, targetModel);
    }

    private static long GetDailyLimit(string model)
    {
        foreach (var (prefix, limit) in DailyTokenLimits)
            if (model.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return limit;
        return long.MaxValue; // Ollama / unknown → no limit
    }
}
