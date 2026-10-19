using System.Reflection;
using Strata.Api.Features.Auth;
using Strata.Api.Infrastructure;
using Strata.Infrastructure;
using Strata.Infrastructure.Persistence;
using Strata.Infrastructure.Seeding;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddStrataInfrastructure(builder.Configuration);
builder.Services.AddStrataAuthentication();
builder.Services.AddHealthChecks().AddDbContextCheck<StrataDbContext>("database");

var app = builder.Build();

// Build-time OpenAPI generation runs this entry point too; it must not touch a database.
var isOpenApiGeneration = Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";
if (!isOpenApiGeneration && app.Configuration.GetValue("Database:InitializeOnStartup", defaultValue: false))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync();
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<AntiforgeryMiddleware>();

app.MapOpenApi();
app.MapHealthChecks("/health");
app.MapAuthEndpoints();

await app.RunAsync();

/// <summary>Entry point marker for <c>WebApplicationFactory</c> in integration tests.</summary>
public partial class Program;
