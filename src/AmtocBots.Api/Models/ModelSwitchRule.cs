namespace AmtocBots.Api.Models;

public sealed class ModelSwitchRule
{
    public Guid Id { get; set; }
    public Guid InstanceId { get; set; }
    public BotInstance? Instance { get; set; }

    /// <summary>threshold | cron | manual</summary>
    public string RuleType { get; set; } = "threshold";

    // Threshold rules
    public string? TriggerModel { get; set; }
    public int? ThresholdPct { get; set; }

    // Cron rules
    public string? CronExpression { get; set; }

    public string TargetModel { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public int Priority { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
