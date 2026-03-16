using AmtocBots.Api.Data;
using AmtocBots.Api.DTOs.Models;
using AmtocBots.Api.Models;
using AmtocBots.Api.Services.Models;
using AmtocBots.Api.Services.Ollama;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AmtocBots.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class ModelsController(
    AppDbContext db,
    IModelSwitchingService switcher,
    ITokenTracker tracker,
    IOllamaService ollama) : ControllerBase
{
    private static readonly string[] BuiltInProviders =
    [
        "anthropic/claude-opus-4-6",
        "anthropic/claude-sonnet-4-6",
        "anthropic/claude-haiku-4-5-20251001",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "google/gemini-2.0-flash",
        "openrouter/auto",
    ];

    [HttpGet("models/available")]
    public async Task<IActionResult> Available(CancellationToken ct)
    {
        var ollamaModels = await ollama.ListModelsAsync(ct);
        var all = BuiltInProviders
            .Select(m => new { id = m, provider = m.Split('/')[0], local = false })
            .Concat(ollamaModels.Select(m => new { id = $"ollama/{m.Name}", provider = "ollama", local = true }));
        return Ok(all);
    }

    [HttpGet("instances/{id:guid}/model")]
    public async Task<IActionResult> GetModel(Guid id, CancellationToken ct)
    {
        var instance = await db.Instances.FindAsync([id], ct);
        if (instance is null) return NotFound();
        return Ok(new { model = instance.CurrentModel });
    }

    [HttpPut("instances/{id:guid}/model")]
    [Authorize(Roles = "admin,operator")]
    public async Task<IActionResult> SwitchModel(Guid id, [FromBody] SwitchModelRequest req, CancellationToken ct)
    {
        await switcher.SwitchModelAsync(id, req.Model, ct);
        return NoContent();
    }

    [HttpGet("instances/{id:guid}/token-usage")]
    public async Task<IActionResult> InstanceUsage(Guid id, [FromQuery] int days = 7, CancellationToken ct = default)
    {
        var from = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-days));
        var records = await db.TokenUsage
            .Where(r => r.InstanceId == id && r.UsageDate >= from)
            .OrderBy(r => r.UsageDate)
            .Select(r => new TokenUsageSummaryDto(r.InstanceId, r.Model, r.UsageDate,
                r.PromptTokens, r.CompletionTokens, r.TotalTokens, r.EstimatedCostUsd))
            .ToListAsync(ct);
        return Ok(records);
    }

    [HttpGet("token-usage/summary")]
    public async Task<IActionResult> Summary([FromQuery] int days = 7, CancellationToken ct = default)
    {
        var from = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-days));
        var records = await db.TokenUsage
            .Where(r => r.UsageDate >= from)
            .OrderBy(r => r.UsageDate)
            .Select(r => new TokenUsageSummaryDto(r.InstanceId, r.Model, r.UsageDate,
                r.PromptTokens, r.CompletionTokens, r.TotalTokens, r.EstimatedCostUsd))
            .ToListAsync(ct);
        return Ok(records);
    }

    [HttpGet("instances/{id:guid}/switch-rules")]
    public async Task<IActionResult> ListRules(Guid id, CancellationToken ct)
    {
        var rules = await db.SwitchRules
            .Where(r => r.InstanceId == id)
            .OrderByDescending(r => r.Priority)
            .Select(r => new SwitchRuleDto(r.Id, r.RuleType, r.TriggerModel, r.ThresholdPct,
                r.CronExpression, r.TargetModel, r.IsActive, r.Priority))
            .ToListAsync(ct);
        return Ok(rules);
    }

    [HttpPost("instances/{id:guid}/switch-rules")]
    [Authorize(Roles = "admin,operator")]
    public async Task<IActionResult> CreateRule(Guid id, [FromBody] CreateSwitchRuleRequest req, CancellationToken ct)
    {
        var rule = new ModelSwitchRule
        {
            InstanceId = id,
            RuleType = req.RuleType,
            TriggerModel = req.TriggerModel,
            ThresholdPct = req.ThresholdPct,
            CronExpression = req.CronExpression,
            TargetModel = req.TargetModel,
            Priority = req.Priority,
        };
        db.SwitchRules.Add(rule);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(ListRules), new { id }, rule.Id);
    }

    [HttpPut("instances/{id:guid}/switch-rules/{ruleId:guid}")]
    [Authorize(Roles = "admin,operator")]
    public async Task<IActionResult> UpdateRule(Guid id, Guid ruleId, [FromBody] CreateSwitchRuleRequest req, CancellationToken ct)
    {
        var rule = await db.SwitchRules.FirstOrDefaultAsync(r => r.Id == ruleId && r.InstanceId == id, ct);
        if (rule is null) return NotFound();
        rule.RuleType = req.RuleType;
        rule.TriggerModel = req.TriggerModel;
        rule.ThresholdPct = req.ThresholdPct;
        rule.CronExpression = req.CronExpression;
        rule.TargetModel = req.TargetModel;
        rule.Priority = req.Priority;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("instances/{id:guid}/switch-rules/{ruleId:guid}")]
    [Authorize(Roles = "admin,operator")]
    public async Task<IActionResult> DeleteRule(Guid id, Guid ruleId, CancellationToken ct)
    {
        var rule = await db.SwitchRules.FirstOrDefaultAsync(r => r.Id == ruleId && r.InstanceId == id, ct);
        if (rule is null) return NotFound();
        db.SwitchRules.Remove(rule);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
