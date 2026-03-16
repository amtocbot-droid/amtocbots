using AmtocBots.Api.Configuration;
using AmtocBots.Api.Models;
using Docker.DotNet;
using Docker.DotNet.Models;
using Microsoft.Extensions.Options;

namespace AmtocBots.Api.Services.Docker;

public sealed class DockerService : IDockerService, IDisposable
{
    private readonly DockerClient _client;
    private readonly DockerOptions _opts;
    private readonly ILogger<DockerService> _log;

    public DockerService(IOptions<DockerOptions> opts, ILogger<DockerService> log)
    {
        _opts = opts.Value;
        _log = log;
        _client = new DockerClientConfiguration(new Uri($"unix://{_opts.SocketPath}"))
            .CreateClient();
    }

    public async Task<string> CreateAndStartContainerAsync(BotInstance instance, CancellationToken ct = default)
    {
        var containerName = instance.ContainerName;
        var volumeName = $"openclaw-config-{instance.Id}";

        // Ensure config volume exists
        await _client.Volumes.CreateAsync(new VolumesCreateParameters { Name = volumeName }, ct);

        var hostConfig = new HostConfig
        {
            NetworkMode = _opts.OpenClawNetwork,
            Binds = [$"{volumeName}:/root/.openclaw"],
            RestartPolicy = new RestartPolicy { Name = RestartPolicyKind.UnlessStopped },
        };

        if (instance.MemoryLimitMb.HasValue)
            hostConfig.Memory = instance.MemoryLimitMb.Value * 1024L * 1024L;

        if (instance.CpuLimit.HasValue)
            hostConfig.NanoCPUs = (long)((double)instance.CpuLimit.Value * 1e9);

        var create = await _client.Containers.CreateContainerAsync(new CreateContainerParameters
        {
            Name = containerName,
            Image = _opts.OpenClawImage,
            HostConfig = hostConfig,
            Labels = new Dictionary<string, string>
            {
                ["amtocbots.managed"] = "true",
                ["amtocbots.instance-id"] = instance.Id.ToString(),
            },
        }, ct);

        await _client.Containers.StartContainerAsync(create.ID, new ContainerStartParameters(), ct);
        _log.LogInformation("Started container {Name} ({Id})", containerName, create.ID);
        return create.ID;
    }

    public async Task StopContainerAsync(string containerId, CancellationToken ct = default)
    {
        await _client.Containers.StopContainerAsync(containerId,
            new ContainerStopParameters { WaitBeforeKillSeconds = 10 }, ct);
    }

    public async Task RestartContainerAsync(string containerId, CancellationToken ct = default)
    {
        await _client.Containers.RestartContainerAsync(containerId,
            new ContainerRestartParameters { WaitBeforeKillSeconds = 10 }, ct);
    }

    public async Task RemoveContainerAsync(string containerId, bool force = true, CancellationToken ct = default)
    {
        await _client.Containers.RemoveContainerAsync(containerId,
            new ContainerRemoveParameters { Force = force, RemoveVolumes = false }, ct);
    }

    public async Task<ContainerStats?> GetStatsAsync(Guid instanceId, string containerId, CancellationToken ct = default)
    {
        try
        {
            var inspect = await _client.Containers.InspectContainerAsync(containerId, ct);
            var status = inspect.State.Running ? "running" : inspect.State.Status;

            // Stats stream — read one sample then cancel
            double cpuPct = 0;
            long memUsage = 0, memLimit = 0;

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            await _client.Containers.GetContainerStatsAsync(containerId,
                new ContainerStatsParameters { Stream = false },
                new Progress<ContainerStatsResponse>(s =>
                {
                    cpuPct = CalculateCpuPercent(s);
                    memUsage = (long)s.MemoryStats.Usage / (1024 * 1024);
                    memLimit = (long)s.MemoryStats.Limit / (1024 * 1024);
                    cts.Cancel();
                }), cts.Token);

            return new ContainerStats(instanceId, status, cpuPct, memUsage, memLimit);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Could not get stats for container {Id}", containerId);
            return null;
        }
    }

    public async Task<IReadOnlyList<ContainerStats>> GetAllManagedStatsAsync(
        IEnumerable<(Guid Id, string ContainerId)> instances, CancellationToken ct = default)
    {
        var tasks = instances.Select(i => GetStatsAsync(i.Id, i.ContainerId, ct));
        var results = await Task.WhenAll(tasks);
        return results.OfType<ContainerStats>().ToList();
    }

    public async Task<string> GetLogsAsync(string containerId, int tailLines = 200, CancellationToken ct = default)
    {
        var stream = await _client.Containers.GetContainerLogsAsync(containerId,
            false,
            new ContainerLogsParameters
            {
                ShowStdout = true,
                ShowStderr = true,
                Tail = tailLines.ToString(),
                Timestamps = true,
            }, ct);

        var (stdout, _) = await stream.ReadOutputToEndAsync(ct);
        return stdout;
    }

    public async Task WriteConfigVolumeAsync(Guid instanceId, string json5Content, CancellationToken ct = default)
    {
        // Write the JSON5 config into the named volume via a temporary busybox container
        var volumeName = $"openclaw-config-{instanceId}";
        var encoded = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(json5Content));

        var create = await _client.Containers.CreateContainerAsync(new CreateContainerParameters
        {
            Image = "busybox",
            Cmd = ["sh", "-c", $"echo {encoded} | base64 -d > /data/openclaw.json"],
            HostConfig = new HostConfig
            {
                Binds = [$"{volumeName}:/data"],
                AutoRemove = true,
            },
        }, ct);

        await _client.Containers.StartContainerAsync(create.ID, new ContainerStartParameters(), ct);

        // Wait for the helper container to finish
        await _client.Containers.WaitContainerAsync(create.ID, ct);
        _log.LogDebug("Config written to volume {Volume} for instance {Id}", volumeName, instanceId);
    }

    private static double CalculateCpuPercent(ContainerStatsResponse s)
    {
        var cpuDelta = (double)(s.CPUStats.CPUUsage.TotalUsage - s.PreCPUStats.CPUUsage.TotalUsage);
        var systemDelta = (double)(s.CPUStats.SystemUsage - s.PreCPUStats.SystemUsage);
        var numCpus = s.CPUStats.OnlineCPUs > 0 ? s.CPUStats.OnlineCPUs : (ulong)Environment.ProcessorCount;
        return systemDelta > 0 ? cpuDelta / systemDelta * numCpus * 100.0 : 0;
    }

    public void Dispose() => _client.Dispose();
}
