using Pgvector;

namespace AmtocBots.Api.Models;

public sealed class BotLearning
{
    public Guid Id { get; set; }
    public Guid SourceInstanceId { get; set; }
    public BotInstance? SourceInstance { get; set; }

    public string Content { get; set; } = string.Empty;

    /// <summary>1536-dimension vector embedding (OpenAI/Ollama compatible).</summary>
    public Vector? Embedding { get; set; }

    public string[] Tags { get; set; } = [];
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
