namespace AmtocBots.Api.Services.Models;

public sealed record TokenUsageSample(
    Guid InstanceId,
    string Model,
    long PromptTokens,
    long CompletionTokens,
    decimal? CostUsd = null);

public interface ITokenTracker
{
    Task RecordAsync(TokenUsageSample sample, CancellationToken ct = default);
    Task<(long Prompt, long Completion, long Total)> GetTodayTotalsAsync(Guid instanceId, string model, CancellationToken ct = default);
    Task<Dictionary<string, long>> GetAllModelTotalsForInstanceAsync(Guid instanceId, DateOnly date, CancellationToken ct = default);
}
