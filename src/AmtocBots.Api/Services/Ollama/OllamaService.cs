using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AmtocBots.Api.Services.Ollama;

public sealed class OllamaService(HttpClient http, ILogger<OllamaService> log) : IOllamaService
{
    public async Task<IReadOnlyList<OllamaModel>> ListModelsAsync(CancellationToken ct = default)
    {
        try
        {
            var resp = await http.GetFromJsonAsync<OllamaListResponse>("/api/tags", ct);
            return resp?.Models.Select(m => new OllamaModel(m.Name, m.Size, m.ModifiedAt)).ToList()
                ?? [];
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Failed to list Ollama models");
            return [];
        }
    }

    public async Task PullModelAsync(string modelName, CancellationToken ct = default)
    {
        var body = new StringContent(JsonSerializer.Serialize(new { name = modelName }), Encoding.UTF8, "application/json");
        using var resp = await http.PostAsync("/api/pull", body, ct);
        resp.EnsureSuccessStatusCode();
    }

    public async Task<bool> IsHealthyAsync(CancellationToken ct = default)
    {
        try
        {
            var resp = await http.GetAsync("/", ct);
            return resp.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    public async Task<float[]> GenerateEmbeddingAsync(string text, string model = "nomic-embed-text", CancellationToken ct = default)
    {
        var payload = new StringContent(
            JsonSerializer.Serialize(new { model, prompt = text }),
            Encoding.UTF8, "application/json");
        var resp = await http.PostAsync("/api/embeddings", payload, ct);
        resp.EnsureSuccessStatusCode();
        var result = await resp.Content.ReadFromJsonAsync<OllamaEmbeddingResponse>(cancellationToken: ct);
        return result?.Embedding ?? [];
    }

    private sealed record OllamaListResponse([property: JsonPropertyName("models")] List<OllamaModelDto> Models);
    private sealed record OllamaModelDto(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("size")] string? Size,
        [property: JsonPropertyName("modified_at")] DateTimeOffset? ModifiedAt);
    private sealed record OllamaEmbeddingResponse([property: JsonPropertyName("embedding")] float[] Embedding);
}
