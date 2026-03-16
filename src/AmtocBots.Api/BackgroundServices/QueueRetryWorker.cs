using AmtocBots.Api.Services.OpenClaw;
using AmtocBots.Api.Services.Queue;

namespace AmtocBots.Api.BackgroundServices;

public sealed class QueueRetryWorker(
    RedisMessageQueueService queue,
    IOpenClawClient openClaw,
    ILogger<QueueRetryWorker> log) : BackgroundService
{
    private static readonly TimeSpan[] Backoffs = [
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(15),
        TimeSpan.FromSeconds(30),
        TimeSpan.FromMinutes(2),
        TimeSpan.FromMinutes(5),
    ];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        log.LogInformation("Queue retry worker started");

        while (!stoppingToken.IsCancellationRequested)
        {
            // Move any ready delayed messages back to main queue
            await queue.FlushReadyDelayedAsync(stoppingToken);

            var msg = await queue.DequeueAsync(stoppingToken);
            if (msg is null)
            {
                await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
                continue;
            }

            try
            {
                await openClaw.RunAgentAsync(msg.BaseUrl, msg.BearerToken,
                    new AgentRequest(msg.Description, msg.Model), stoppingToken);
                log.LogDebug("Retried queued message for instance {Id}", msg.InstanceId);
            }
            catch (HttpRequestException ex) when ((int?)ex.StatusCode == 429)
            {
                var delay = msg.RetryCount < Backoffs.Length
                    ? Backoffs[msg.RetryCount]
                    : TimeSpan.FromMinutes(10);

                log.LogWarning("Rate limited on instance {Id}, requeuing with {Delay}s delay", msg.InstanceId, delay.TotalSeconds);
                await queue.RequeueWithDelayAsync(msg, delay, stoppingToken);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to send queued message for instance {Id}", msg.InstanceId);
            }
        }
    }
}
