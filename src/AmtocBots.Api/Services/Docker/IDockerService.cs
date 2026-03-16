using AmtocBots.Api.Models;

namespace AmtocBots.Api.Services.Docker;

public sealed record ContainerStats(
    Guid InstanceId,
    string Status,
    double CpuPercent,
    long MemoryUsageMb,
    long MemoryLimitMb);

public interface IDockerService
{
    Task<string> CreateAndStartContainerAsync(BotInstance instance, CancellationToken ct = default);
    Task StopContainerAsync(string containerId, CancellationToken ct = default);
    Task RestartContainerAsync(string containerId, CancellationToken ct = default);
    Task RemoveContainerAsync(string containerId, bool force = true, CancellationToken ct = default);
    Task<ContainerStats?> GetStatsAsync(Guid instanceId, string containerId, CancellationToken ct = default);
    Task<IReadOnlyList<ContainerStats>> GetAllManagedStatsAsync(IEnumerable<(Guid Id, string ContainerId)> instances, CancellationToken ct = default);
    Task<string> GetLogsAsync(string containerId, int tailLines = 200, CancellationToken ct = default);
    Task WriteConfigVolumeAsync(Guid instanceId, string json5Content, CancellationToken ct = default);
}
