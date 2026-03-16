using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace AmtocBots.Api.Services.OpenClaw;

public sealed class OpenClawClient(HttpClient http, ILogger<OpenClawClient> log) : IOpenClawClient
{
    public async Task WakeAsync(string baseUrl, string bearerToken, string description, CancellationToken ct = default)
    {
        using var req = BuildRequest(HttpMethod.Post, baseUrl, "/hooks/wake", bearerToken);
        req.Content = JsonContent(new { description, trigger = "now" });
        var resp = await http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
    }

    public async Task RunAgentAsync(string baseUrl, string bearerToken, AgentRequest request, CancellationToken ct = default)
    {
        using var req = BuildRequest(HttpMethod.Post, baseUrl, "/hooks/agent", bearerToken);
        req.Content = JsonContent(new
        {
            description = request.Description,
            model = request.Model,
            channel = request.Channel,
        });
        var resp = await http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
    }

    public async Task<QrCodeResponse?> GetWhatsAppQrAsync(string baseUrl, string bearerToken, CancellationToken ct = default)
    {
        try
        {
            using var req = BuildRequest(HttpMethod.Get, baseUrl, "/whatsapp/qr", bearerToken);
            var resp = await http.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode) return null;
            var bytes = await resp.Content.ReadAsByteArrayAsync(ct);
            var ct2 = resp.Content.Headers.ContentType?.MediaType ?? "image/png";
            return new QrCodeResponse(bytes, ct2);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Failed to fetch WhatsApp QR from {Url}", baseUrl);
            return null;
        }
    }

    public async Task<bool> IsHealthyAsync(string baseUrl, CancellationToken ct = default)
    {
        try
        {
            var resp = await http.GetAsync($"{baseUrl.TrimEnd('/')}/health", ct);
            return resp.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private static HttpRequestMessage BuildRequest(HttpMethod method, string baseUrl, string path, string token)
    {
        var req = new HttpRequestMessage(method, $"{baseUrl.TrimEnd('/')}{path}");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return req;
    }

    private static StringContent JsonContent(object payload) =>
        new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
}
