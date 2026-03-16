namespace AmtocBots.Api.Services.Queue;

public sealed record QueuedAgentMessage(
    Guid InstanceId,
    string BaseUrl,
    string BearerToken,
    string Description,
    string? Model,
    int RetryCount = 0);

public interface IMessageQueueService
{
    Task EnqueueAsync(QueuedAgentMessage message, CancellationToken ct = default);
    Task<QueuedAgentMessage?> DequeueAsync(CancellationToken ct = default);
    Task RequeueWithDelayAsync(QueuedAgentMessage message, TimeSpan delay, CancellationToken ct = default);
}
