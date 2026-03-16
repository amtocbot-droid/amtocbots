namespace AmtocBots.Api.Configuration;

public sealed class EncryptionOptions
{
    /// <summary>Base64-encoded 32-byte AES-256 key. Generate with: openssl rand -base64 32</summary>
    public string Key { get; set; } = string.Empty;
}
