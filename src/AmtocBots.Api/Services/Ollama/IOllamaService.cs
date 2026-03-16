namespace AmtocBots.Api.Services.Ollama;

public sealed record OllamaModel(string Name, string? Size, DateTimeOffset? ModifiedAt);

public interface IOllamaService
{
    Task<IReadOnlyList<OllamaModel>> ListModelsAsync(CancellationToken ct = default);
    Task PullModelAsync(string modelName, CancellationToken ct = default);
    Task<bool> IsHealthyAsync(CancellationToken ct = default);
    Task<float[]> GenerateEmbeddingAsync(string text, string model = "nomic-embed-text", CancellationToken ct = default);
}
