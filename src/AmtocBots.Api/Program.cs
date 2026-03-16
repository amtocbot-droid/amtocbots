using AmtocBots.Api.BackgroundServices;
using AmtocBots.Api.Configuration;
using AmtocBots.Api.Data;
using AmtocBots.Api.Endpoints;
using AmtocBots.Api.Hubs;
using AmtocBots.Api.Services.Docker;
using AmtocBots.Api.Services.Models;
using AmtocBots.Api.Services.Ollama;
using AmtocBots.Api.Services.OpenClaw;
using AmtocBots.Api.Services.Queue;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Pgvector.EntityFrameworkCore;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// ── Options ───────────────────────────────────────────────────────────────────
builder.Services.Configure<DockerOptions>(builder.Configuration.GetSection("Docker"));
builder.Services.Configure<OllamaOptions>(builder.Configuration.GetSection("Ollama"));
builder.Services.Configure<EncryptionOptions>(builder.Configuration.GetSection("Encryption"));

// ── Database ──────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(
        builder.Configuration.GetConnectionString("Default"),
        o => o.UseVector()));

// ── Redis ─────────────────────────────────────────────────────────────────────
var redisConn = builder.Configuration["Redis:ConnectionString"]
    ?? throw new InvalidOperationException("Redis:ConnectionString not configured");
builder.Services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConn));
builder.Services.AddStackExchangeRedisCache(o => o.Configuration = redisConn);

// ── Auth (Keycloak JWT) ───────────────────────────────────────────────────────
var keycloakAuthority = builder.Configuration["Keycloak:Authority"]
    ?? throw new InvalidOperationException("Keycloak:Authority not configured");
var keycloakAudience = builder.Configuration["Keycloak:Audience"] ?? "amtocbots-api";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.Authority = keycloakAuthority;
        opt.Audience = keycloakAudience;
        opt.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            ValidateIssuer = true,
            ValidateAudience = true,
            NameClaimType = "preferred_username",
            RoleClaimType = "realm_access.roles",
        };
        // Allow JWT in SignalR query string
        opt.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            },
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", p => p.RequireRole("admin"))
    .AddPolicy("Operator", p => p.RequireRole("admin", "operator"));

// ── Services ──────────────────────────────────────────────────────────────────
builder.Services.AddSingleton<IDockerService, DockerService>();
builder.Services.AddHttpClient<IOpenClawClient, OpenClawClient>();
builder.Services.AddSingleton<OpenClawConfigBuilder>();
builder.Services.AddScoped<ITokenTracker, TokenTracker>();
builder.Services.AddScoped<IModelSwitchingService, ModelSwitchingService>();
builder.Services.AddSingleton<RedisMessageQueueService>();
builder.Services.AddSingleton<IMessageQueueService>(sp => sp.GetRequiredService<RedisMessageQueueService>());
builder.Services.AddHttpClient<IOllamaService, OllamaService>(c =>
    c.BaseAddress = new Uri(builder.Configuration["Ollama:BaseUrl"] ?? "http://localhost:11434"));

// ── Background Services ───────────────────────────────────────────────────────
builder.Services.AddHostedService<MetricsPollingService>();
builder.Services.AddHostedService<ModelSwitchScheduler>();
builder.Services.AddHostedService<QueueRetryWorker>();

// ── SignalR ───────────────────────────────────────────────────────────────────
builder.Services.AddSignalR();

// ── Controllers + API Explorer ────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// ── CORS ──────────────────────────────────────────────────────────────────────
var corsOrigins = builder.Configuration["Cors:Origins"]?.Split(',') ?? ["http://localhost:4200"];
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();

// ── Migrate on startup ────────────────────────────────────────────────────────
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// ── Routes ────────────────────────────────────────────────────────────────────
app.MapControllers();
app.MapHub<InstanceHub>("/hubs/instances");
app.MapHub<KanbanHub>("/hubs/kanban");
app.MapHub<ChatHub>("/hubs/chat");

app.MapGroup("/api/health").MapHealthEndpoints();
app.MapGroup("/api/channels").MapChannelEndpoints().RequireAuthorization();
app.MapGroup("/api/ollama").MapOllamaEndpoints().RequireAuthorization();

app.Run();
