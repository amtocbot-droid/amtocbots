namespace AmtocBots.Api.Endpoints;

public static class HealthEndpoints
{
    public static RouteGroupBuilder MapHealthEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/", () => Results.Ok(new { status = "healthy", utc = DateTimeOffset.UtcNow }));
        return group;
    }
}
