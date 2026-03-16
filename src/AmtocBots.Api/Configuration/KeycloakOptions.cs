namespace AmtocBots.Api.Configuration;

public sealed class KeycloakOptions
{
    public string Authority { get; set; } = string.Empty;
    public string Audience { get; set; } = "amtocbots-api";
}
