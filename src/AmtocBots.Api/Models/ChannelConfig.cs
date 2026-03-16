namespace AmtocBots.Api.Models;

public sealed class ChannelConfig
{
    public Guid Id { get; set; }
    public Guid InstanceId { get; set; }
    public BotInstance? Instance { get; set; }

    /// <summary>telegram | whatsapp | discord | slack</summary>
    public string ChannelType { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }

    /// <summary>
    /// Channel-specific fields as JSON. Sensitive tokens are AES-256 encrypted at rest
    /// via EF Core value converter (see AppDbContext).
    /// </summary>
    public string ConfigJson { get; set; } = "{}";

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
