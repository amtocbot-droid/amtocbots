using AmtocBots.Api.Data;
using AmtocBots.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AmtocBots.Api.Services.Models;

public sealed class TokenTracker(AppDbContext db) : ITokenTracker
{
    public async Task RecordAsync(TokenUsageSample sample, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Upsert — increment today's record
        var existing = await db.TokenUsage
            .FirstOrDefaultAsync(r => r.InstanceId == sample.InstanceId
                                   && r.Model == sample.Model
                                   && r.UsageDate == today, ct);
        if (existing is null)
        {
            db.TokenUsage.Add(new TokenUsageRecord
            {
                InstanceId = sample.InstanceId,
                Model = sample.Model,
                UsageDate = today,
                PromptTokens = sample.PromptTokens,
                CompletionTokens = sample.CompletionTokens,
                TotalTokens = sample.PromptTokens + sample.CompletionTokens,
                EstimatedCostUsd = sample.CostUsd,
            });
        }
        else
        {
            existing.PromptTokens += sample.PromptTokens;
            existing.CompletionTokens += sample.CompletionTokens;
            existing.TotalTokens += sample.PromptTokens + sample.CompletionTokens;
            if (sample.CostUsd.HasValue)
                existing.EstimatedCostUsd = (existing.EstimatedCostUsd ?? 0) + sample.CostUsd.Value;
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task<(long Prompt, long Completion, long Total)> GetTodayTotalsAsync(
        Guid instanceId, string model, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rec = await db.TokenUsage
            .FirstOrDefaultAsync(r => r.InstanceId == instanceId && r.Model == model && r.UsageDate == today, ct);
        return rec is null ? (0, 0, 0) : (rec.PromptTokens, rec.CompletionTokens, rec.TotalTokens);
    }

    public async Task<Dictionary<string, long>> GetAllModelTotalsForInstanceAsync(
        Guid instanceId, DateOnly date, CancellationToken ct = default)
    {
        return await db.TokenUsage
            .Where(r => r.InstanceId == instanceId && r.UsageDate == date)
            .ToDictionaryAsync(r => r.Model, r => r.TotalTokens, ct);
    }
}
