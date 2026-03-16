namespace AmtocBots.Api.Models;

public sealed class BotInstance
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Docker
    public string? ContainerId { get; set; }
    public string ContainerName { get; set; } = string.Empty;
    public int HostPort { get; set; }
    public string Status { get; set; } = "stopped"; // stopped | starting | running | error

    // Model
    public string CurrentModel { get; set; } = "anthropic/claude-sonnet-4-6";

    // Resource limits
    public decimal? CpuLimit { get; set; }
    public int? MemoryLimitMb { get; set; }

    // Stored as JSON5 text; built from ChannelConfigs + model by OpenClawConfigBuilder
    public string? ConfigJson { get; set; }

    // Bcrypt hash of the bearer token issued to this instance for /hooks/* calls
    public string? ApiBearerTokenHash { get; set; }

    public Guid CreatedBy { get; set; }
    public AppUser? Creator { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<ChannelConfig> ChannelConfigs { get; set; } = [];
    public ICollection<ModelSwitchRule> SwitchRules { get; set; } = [];
    public ICollection<TokenUsageRecord> TokenUsage { get; set; } = [];
    public ICollection<BotLearning> Learnings { get; set; } = [];
}
