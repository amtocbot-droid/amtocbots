namespace AmtocBots.Api.Configuration;

public sealed class DockerOptions
{
    public string SocketPath { get; set; } = "/var/run/docker.sock";
    public string OpenClawNetwork { get; set; } = "amtocbots_openclaw";
    public string OpenClawImage { get; set; } = "ghcr.io/openclaw/openclaw:latest";
    public int PortRangeStart { get; set; } = 18789;
    public int PortRangeEnd { get; set; } = 19789;
}
