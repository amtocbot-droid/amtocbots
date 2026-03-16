using AmtocBots.Api.Data;
using AmtocBots.Api.Models;
using AmtocBots.Api.Services.Ollama;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pgvector;
using Pgvector.EntityFrameworkCore;

namespace AmtocBots.Api.Controllers;

[ApiController]
[Route("api/learnings")]
[Authorize]
public sealed class LearningsController(AppDbContext db, IOllamaService ollama) : ControllerBase
{
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q, [FromQuery] int limit = 10, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q)) return BadRequest("q is required");

        float[]? embedding;
        try
        {
            embedding = await ollama.GenerateEmbeddingAsync(q, ct);
        }
        catch
        {
            // Fallback to keyword search if embedding unavailable
            var fallback = await db.BotLearnings
                .Where(l => EF.Functions.ILike(l.Content, $"%{q}%"))
                .OrderByDescending(l => l.CreatedAt)
                .Take(limit)
                .Select(l => new LearningDto(l.Id, l.SourceInstanceId, l.Content, l.Tags, l.CreatedAt))
                .ToListAsync(ct);
            return Ok(fallback);
        }

        var vec = new Vector(embedding);
        var results = await db.BotLearnings
            .OrderBy(l => l.Embedding!.CosineDistance(vec))
            .Take(limit)
            .Select(l => new LearningDto(l.Id, l.SourceInstanceId, l.Content, l.Tags, l.CreatedAt))
            .ToListAsync(ct);

        return Ok(results);
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid? instanceId = null, [FromQuery] string? tag = null, CancellationToken ct = default)
    {
        var query = db.BotLearnings.AsQueryable();
        if (instanceId.HasValue) query = query.Where(l => l.SourceInstanceId == instanceId);
        if (!string.IsNullOrWhiteSpace(tag)) query = query.Where(l => l.Tags.Contains(tag));

        var items = await query
            .OrderByDescending(l => l.CreatedAt)
            .Take(100)
            .Select(l => new LearningDto(l.Id, l.SourceInstanceId, l.Content, l.Tags, l.CreatedAt))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLearningRequest req, CancellationToken ct)
    {
        var learning = new BotLearning
        {
            SourceInstanceId = req.SourceInstanceId,
            Content = req.Content,
            Tags = req.Tags ?? [],
        };

        try
        {
            var embedding = await ollama.GenerateEmbeddingAsync(req.Content, ct);
            learning.Embedding = new Vector(embedding);
        }
        catch
        {
            // Store without embedding — search will fall back to keyword
        }

        db.BotLearnings.Add(learning);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(List), new { }, learning.Id);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "admin,operator")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var learning = await db.BotLearnings.FindAsync([id], ct);
        if (learning is null) return NotFound();
        db.BotLearnings.Remove(learning);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public sealed record LearningDto(Guid Id, Guid SourceInstanceId, string Content, string[] Tags, DateTimeOffset CreatedAt);
public sealed record CreateLearningRequest(Guid SourceInstanceId, string Content, string[]? Tags);
