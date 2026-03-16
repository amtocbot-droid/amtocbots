using AmtocBots.Api.Data;
using AmtocBots.Api.Services.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;

namespace AmtocBots.Api.Controllers;

/// <summary>
/// Receives callbacks from OpenClaw instances (or the token-tracking sidecar proxy).
/// These endpoints use instance API key auth, not JWT.
/// </summary>
[ApiController]
[Route("api/webhooks/openclaw")]
public sealed class WebhookController(
    AppDbContext db,
    ITokenTracker tracker,
    ILogger<WebhookController> log) : ControllerBase
{
    [HttpPost("{instanceId:guid}/token-usage")]
    public async Task<IActionResult> TokenUsage(Guid instanceId, [FromBody] TokenUsagePayload payload, CancellationToken ct)
    {
        if (!await ValidateApiKey(instanceId, ct)) return Unauthorized();

        await tracker.RecordAsync(new TokenUsageSample(
            instanceId,
            payload.Model,
            payload.PromptTokens,
            payload.CompletionTokens,
            payload.CostUsd), ct);

        return Ok();
    }

    [HttpPost("{instanceId:guid}/event")]
    public async Task<IActionResult> Event(Guid instanceId, [FromBody] EventPayload payload, CancellationToken ct)
    {
        if (!await ValidateApiKey(instanceId, ct)) return Unauthorized();

        log.LogInformation("OpenClaw event from instance {Id}: {Type}", instanceId, payload.Type);
        // Future: handle specific events (session reset, error, etc.)
        return Ok();
    }

    private async Task<bool> ValidateApiKey(Guid instanceId, CancellationToken ct)
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (authHeader is null || !authHeader.StartsWith("Bearer ")) return false;
        var token = authHeader["Bearer ".Length..];

        var instance = await db.Instances
            .Where(i => i.Id == instanceId)
            .Select(i => new { i.ApiBearerTokenHash })
            .FirstOrDefaultAsync(ct);

        return instance?.ApiBearerTokenHash is not null
               && BCrypt.Net.BCrypt.Verify(token, instance.ApiBearerTokenHash);
    }
}

public sealed record TokenUsagePayload(
    [property: JsonPropertyName("model")] string Model,
    [property: JsonPropertyName("prompt_tokens")] long PromptTokens,
    [property: JsonPropertyName("completion_tokens")] long CompletionTokens,
    [property: JsonPropertyName("cost_usd")] decimal? CostUsd);

public sealed record EventPayload(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("data")] object? Data);
