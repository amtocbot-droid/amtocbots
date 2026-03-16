namespace AmtocBots.Api.Services.OpenClaw;

public sealed record AgentRequest(
    string Description,
    string? Model = null,
    string? Channel = null);

public sealed record QrCodeResponse(byte[] ImageBytes, string ContentType);

public interface IOpenClawClient
{
    Task WakeAsync(string baseUrl, string bearerToken, string description, CancellationToken ct = default);
    Task RunAgentAsync(string baseUrl, string bearerToken, AgentRequest request, CancellationToken ct = default);
    Task<QrCodeResponse?> GetWhatsAppQrAsync(string baseUrl, string bearerToken, CancellationToken ct = default);
    Task<bool> IsHealthyAsync(string baseUrl, CancellationToken ct = default);
}
