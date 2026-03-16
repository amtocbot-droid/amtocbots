namespace AmtocBots.Api.Models;

public sealed class AppUser
{
    /// <summary>Matches Keycloak 'sub' claim.</summary>
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "viewer"; // admin | operator | viewer
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastSeen { get; set; }

    public ICollection<BotInstance> CreatedInstances { get; set; } = [];
}
