namespace AmtocBots.Api.Services.Models;

public interface IModelSwitchingService
{
    Task EvaluateThresholdRulesAsync(Guid instanceId, CancellationToken ct = default);
    Task SwitchModelAsync(Guid instanceId, string targetModel, CancellationToken ct = default);
}
