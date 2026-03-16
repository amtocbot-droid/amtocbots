using AmtocBots.Api.Services.Ollama;

namespace AmtocBots.Api.Endpoints;

public static class OllamaEndpoints
{
    public static RouteGroupBuilder MapOllamaEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/models", async (IOllamaService ollama, CancellationToken ct) =>
        {
            var models = await ollama.ListModelsAsync(ct);
            return Results.Ok(models);
        });

        group.MapPost("/pull", async (PullModelRequest req, IOllamaService ollama, CancellationToken ct) =>
        {
            await ollama.PullModelAsync(req.Model, ct);
            return Results.Accepted();
        });

        group.MapGet("/status", async (IOllamaService ollama, CancellationToken ct) =>
        {
            var healthy = await ollama.IsHealthyAsync(ct);
            return Results.Ok(new { healthy });
        });

        return group;
    }
}

public sealed record PullModelRequest(string Model);
