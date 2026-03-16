namespace AmtocBots.Api.Models;

public sealed class TokenUsageRecord
{
    public Guid Id { get; set; }
    public Guid InstanceId { get; set; }
    public BotInstance? Instance { get; set; }

    public string Model { get; set; } = string.Empty;
    public DateOnly UsageDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public long PromptTokens { get; set; }
    public long CompletionTokens { get; set; }
    public long TotalTokens { get; set; }
    public decimal? EstimatedCostUsd { get; set; }
}
