using StackExchange.Redis;
using System.Text.Json;

namespace AmtocBots.Api.Services.Queue;

public sealed class RedisMessageQueueService(IConnectionMultiplexer redis) : IMessageQueueService
{
    private const string QueueKey = "queue:agent-messages";

    public async Task EnqueueAsync(QueuedAgentMessage message, CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        var json = JsonSerializer.Serialize(message);
        await db.ListLeftPushAsync(QueueKey, json);
    }

    public async Task<QueuedAgentMessage?> DequeueAsync(CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        var value = await db.ListRightPopAsync(QueueKey);
        if (value.IsNullOrEmpty) return null;
        return JsonSerializer.Deserialize<QueuedAgentMessage>((string)value!);
    }

    public async Task RequeueWithDelayAsync(QueuedAgentMessage message, TimeSpan delay, CancellationToken ct = default)
    {
        // Use a sorted set as a delay queue (score = scheduled timestamp)
        var db = redis.GetDatabase();
        var json = JsonSerializer.Serialize(message with { RetryCount = message.RetryCount + 1 });
        var score = DateTimeOffset.UtcNow.Add(delay).ToUnixTimeSeconds();
        await db.SortedSetAddAsync("queue:agent-delayed", json, score);
    }

    /// <summary>Move ready delayed messages back to the main queue. Called by QueueRetryWorker.</summary>
    public async Task FlushReadyDelayedAsync(CancellationToken ct = default)
    {
        var db = redis.GetDatabase();
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var ready = await db.SortedSetRangeByScoreAsync("queue:agent-delayed", 0, now);
        foreach (var item in ready)
        {
            await db.SortedSetRemoveAsync("queue:agent-delayed", item);
            await db.ListLeftPushAsync(QueueKey, item);
        }
    }
}
