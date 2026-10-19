using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.Features;
using Strata.Api.Features.Auth;
using Strata.Api.Features.Content;
using Strata.Api.Features.Library;
using Strata.Api.Features.Media;
using Strata.Api.Features.SectionTypes;
using Strata.Api.Features.Sites;
using Strata.Api.Features.Templates;
using Strata.Api.Infrastructure;
using Strata.Infrastructure;
using Strata.Infrastructure.Persistence;
using Strata.Infrastructure.Seeding;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DomainExceptionHandler>();
builder.Services.AddValidation();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<ContentWritePipeline>();
builder.Services.Configure<FormOptions>(options => options.MultipartBodyLengthLimit = 6 * 1024 * 1024);
builder.Services.ConfigureHttpJsonOptions(options =>
{
    // Enums travel as camelCase strings, matching the content schema.
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});
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
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    await next(context);
});
app.UseStatusCodePages();

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<AntiforgeryMiddleware>();

app.MapOpenApi();
app.MapHealthChecks("/health");
app.MapAuthEndpoints();
app.MapSectionTypeEndpoints();
app.MapLibraryEndpoints();
app.MapThemePresetEndpoints();
app.MapTemplateEndpoints();
app.MapSiteEndpoints();
app.MapMediaEndpoints();

await app.RunAsync();

/// <summary>Entry point marker for <c>WebApplicationFactory</c> in integration tests.</summary>
public partial class Program;
