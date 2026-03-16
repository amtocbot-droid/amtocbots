using System.ComponentModel.DataAnnotations;

namespace AmtocBots.Api.DTOs.Models;

public sealed record SwitchRuleDto(
    Guid Id,
    string RuleType,
    string? TriggerModel,
    int? ThresholdPct,
    string? CronExpression,
    string TargetModel,
    bool IsActive,
    int Priority);

public sealed record CreateSwitchRuleRequest(
    [Required] string RuleType,
    string? TriggerModel,
    int? ThresholdPct,
    string? CronExpression,
    [Required] string TargetModel,
    int Priority = 0,
    bool IsActive = true);

public sealed record TokenUsageSummaryDto(
    Guid InstanceId,
    string Model,
    DateOnly Date,
    long PromptTokens,
    long CompletionTokens,
    long TotalTokens,
    decimal? EstimatedCostUsd);

public sealed record SwitchModelRequest([Required] string Model);
