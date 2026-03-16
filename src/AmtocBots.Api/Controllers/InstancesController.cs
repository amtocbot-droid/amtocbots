using AmtocBots.Api.Data;
using AmtocBots.Api.DTOs.Instances;
using AmtocBots.Api.Models;
using AmtocBots.Api.Services.Docker;
using AmtocBots.Api.Services.OpenClaw;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AmtocBots.Api.Controllers;

[ApiController]
[Route("api/instances")]
[Authorize]
public sealed class InstancesController(
    AppDbContext db,
    IDockerService docker,
    OpenClawConfigBuilder configBuilder,
    ILogger<InstancesController> log) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var items = await db.Instances
            .OrderBy(i => i.Name)
            .Select(i => new InstanceSummaryDto(
                i.Id, i.Name, i.Description, i.Status, i.CurrentModel,
                i.ContainerName, i.HostPort, i.CpuLimit, i.MemoryLimitMb,
                i.CreatedAt, i.UpdatedAt))
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var i = await db.Instances.FindAsync([id], ct);
        if (i is null) return NotFound();
        return Ok(new InstanceDetailDto(i.Id, i.Name, i.Description, i.Status, i.CurrentModel,
            i.ContainerName, i.ContainerId, i.HostPort, i.CpuLimit, i.MemoryLimitMb,
            i.ConfigJson, i.CreatedAt, i.UpdatedAt));
    }

    [HttpPost]
    [Authorize(Roles = "admin,operator")]
    public async Task<IActionResult> Create([FromBody] CreateInstanceRequest req, CancellationToken ct)
    {
        var userId = GetUserId();

        // Allocate next port (serialized via DB transaction)
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var maxPort = await db.Instances.MaxAsync(i => (int?)i.HostPort, ct) ?? 18788;
        var port = maxPort + 1;

        // Generate a plain-text bearer token (shown once) + hash for storage
        var token = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
        var tokenHash = BCrypt.Net.BCrypt.HashPassword(token);

        var containerName = $"openclaw-{req.Name.ToLower().Replace(" ", "-")}";
        var instance = new BotInstance
        {
            Name = req.Name,
            Description = req.Description,
            CurrentModel = req.Model,
            ContainerName = containerName,
            HostPort = port,
            CpuLimit = req.CpuLimit,
            MemoryLimitMb = req.MemoryLimitMb,
            ApiBearerTokenHash = tokenHash,
            CreatedBy = userId,
        };

        db.Instances.Add(instance);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        log.LogInformation("Created instance {Name} (port {Port})", req.Name, port);

        return CreatedAtAction(nameof(Get), new { id = instance.Id },
            new InstanceTokenResponse(instance.Id, token));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "admin,operator")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateInstanceRequest req, CancellationToken ct)
    {
        var instance = await db.Instances.FindAsync([id], ct);
        if (instance is null) return NotFound();

        if (req.Name is not null) instance.Name = req.Name;
        if (req.Description is not null) instance.Description = req.Description;
        if (req.Model is not null) instance.CurrentModel = req.Model;
        if (req.CpuLimit.HasValue) instance.CpuLimit = req.CpuLimit;
        if (req.MemoryLimitMb.HasValue) instance.MemoryLimitMb = req.MemoryLimitMb;
        instance.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var instance = await db.Instances.FindAsync([id], ct);
        if (instance is null) return NotFound();

        if (instance.ContainerId is not null)
        {
            try { await docker.RemoveContainerAsync(instance.ContainerId, force: true, ct); }
            catch (Exception ex) { log.LogWarning(ex, "Failed to remove container for instance {Id}", id); }
        }

        db.Instances.Remove(instance);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/start")]
    [Authorize(Roles = "admin,operator")]
    public async Task<IActionResult> Start(Guid id, CancellationToken ct)
    {
        var instance = await db.Instances.Include(i => i.ChannelConfigs).FirstOrDefaultAsync(i => i.Id == id, ct);
        if (instance is null) return NotFound();

        // Write config to volume first
        var config = configBuilder.Build(instance, instance.ChannelConfigs, "placeholder");
        await docker.WriteConfigVolumeAsync(id, config, ct);

        var containerId = await docker.CreateAndStartContainerAsync(instance, ct);
        instance.ContainerId = containerId;
        instance.Status = "running";
        instance.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        return Ok(new { containerId });
    }

    [HttpPost("{id:guid}/stop")]
    [Authorize(Roles = "admin,operator")]
    public async Task<IActionResult> Stop(Guid id, CancellationToken ct)
    {
        var instance = await db.Instances.FindAsync([id], ct);
        if (instance is null) return NotFound();
        if (instance.ContainerId is null) return BadRequest("Instance not running");

        await docker.StopContainerAsync(instance.ContainerId, ct);
        instance.Status = "stopped";
        instance.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/restart")]
    [Authorize(Roles = "admin,operator")]
    public async Task<IActionResult> Restart(Guid id, CancellationToken ct)
    {
        var instance = await db.Instances.FindAsync([id], ct);
        if (instance is null) return NotFound();
        if (instance.ContainerId is null) return BadRequest("Instance not running");

        await docker.RestartContainerAsync(instance.ContainerId, ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/logs")]
    public async Task<IActionResult> Logs(Guid id, [FromQuery] int tail = 200, CancellationToken ct = default)
    {
        var instance = await db.Instances.FindAsync([id], ct);
        if (instance is null) return NotFound();
        if (instance.ContainerId is null) return BadRequest("Instance not running");

        var logs = await docker.GetLogsAsync(instance.ContainerId, tail, ct);
        return Content(logs, "text/plain");
    }

    [HttpGet("{id:guid}/config")]
    public async Task<IActionResult> GetConfig(Guid id, CancellationToken ct)
    {
        var instance = await db.Instances.Include(i => i.ChannelConfigs).FirstOrDefaultAsync(i => i.Id == id, ct);
        if (instance is null) return NotFound();
        var config = configBuilder.Build(instance, instance.ChannelConfigs, "[redacted]");
        return Content(config, "text/plain");
    }

    private Guid GetUserId() =>
        Guid.Parse(User.FindFirst("sub")!.Value);
}
