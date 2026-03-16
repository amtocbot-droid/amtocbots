using AmtocBots.Api.Data;
using AmtocBots.Api.Services.Models;
using Microsoft.EntityFrameworkCore;
using NCrontab;

namespace AmtocBots.Api.BackgroundServices;

public sealed class ModelSwitchScheduler(
    IServiceScopeFactory scopeFactory,
    ILogger<ModelSwitchScheduler> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        log.LogInformation("Model switch scheduler started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await EvaluateAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                log.LogWarning(ex, "Error in model switch scheduler");
            }

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private async Task EvaluateAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var switcher = scope.ServiceProvider.GetRequiredService<IModelSwitchingService>();

        var now = DateTime.UtcNow;
        var cronRules = await db.SwitchRules
            .Where(r => r.IsActive && r.RuleType == "cron" && r.CronExpression != null)
            .ToListAsync(ct);

        foreach (var rule in cronRules)
        {
            try
            {
                var schedule = CrontabSchedule.Parse(rule.CronExpression!, new CrontabSchedule.ParseOptions { IncludingSeconds = false });
                var next = schedule.GetNextOccurrence(now.AddMinutes(-1));
                if (next <= now)
                {
                    log.LogInformation("Cron rule triggered for instance {Id}: switch to {Model}", rule.InstanceId, rule.TargetModel);
                    await switcher.SwitchModelAsync(rule.InstanceId, rule.TargetModel, ct);
                }
            }
            catch (Exception ex)
            {
                log.LogWarning(ex, "Failed to evaluate cron rule {Id}", rule.Id);
            }
        }

        // Also evaluate threshold rules for all running instances
        var runningIds = await db.Instances
            .Where(i => i.Status == "running")
            .Select(i => i.Id)
            .ToListAsync(ct);

        foreach (var id in runningIds)
            await switcher.EvaluateThresholdRulesAsync(id, ct);
    }
}
