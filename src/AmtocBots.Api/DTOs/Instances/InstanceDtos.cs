using System.ComponentModel.DataAnnotations;

namespace AmtocBots.Api.DTOs.Instances;

public sealed record InstanceSummaryDto(
    Guid Id,
    string Name,
    string? Description,
    string Status,
    string CurrentModel,
    string ContainerName,
    int HostPort,
    decimal? CpuLimit,
    int? MemoryLimitMb,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record InstanceDetailDto(
    Guid Id,
    string Name,
    string? Description,
    string Status,
    string CurrentModel,
    string ContainerName,
    string? ContainerId,
    int HostPort,
    decimal? CpuLimit,
    int? MemoryLimitMb,
    string? ConfigJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record CreateInstanceRequest(
    [Required, MaxLength(100)] string Name,
    string? Description,
    string Model = "anthropic/claude-sonnet-4-6",
    decimal? CpuLimit = null,
    int? MemoryLimitMb = null);

public sealed record UpdateInstanceRequest(
    string? Name,
    string? Description,
    string? Model,
    decimal? CpuLimit,
    int? MemoryLimitMb);

public sealed record InstanceTokenResponse(
    Guid InstanceId,
    string Token); // shown once on creation
