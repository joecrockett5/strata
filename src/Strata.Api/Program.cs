using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.FileProviders;
using Strata.Api.Features.Auth;
using Strata.Api.Features.Content;
using Strata.Api.Features.Library;
using Strata.Api.Features.Media;
using Strata.Api.Features.PublicSites;
using Strata.Api.Features.SectionTypes;
using Strata.Api.Features.Sites;
using Strata.Api.Features.Templates;
using Strata.Api.Infrastructure;
using Strata.Infrastructure;
using Strata.Infrastructure.Persistence;
using Strata.Infrastructure.Seeding;
using Strata.Rendering;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DomainExceptionHandler>();
builder.Services.AddValidation();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<ContentWritePipeline>();
builder.Services.Configure<FormOptions>(options => options.MultipartBodyLengthLimit = 6 * 1024 * 1024);
builder.Services.ConfigureHttpJsonOptions(options =>
{
    // Enums travel as camelCase strings, matching the content schema; numbers are numbers
    // (the web default also accepts numeric strings, which would leak into the OpenAPI types).
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});
builder.Services.AddOpenApi();
builder.Services.AddStrataInfrastructure(builder.Configuration);
builder.Services.AddStrataAuthentication();
builder.Services.AddHealthChecks().AddDbContextCheck<StrataDbContext>("database");
builder.Services.AddStrataRendering();

// Behind the Compose nginx proxy the client IP (rate limiting) and scheme (canonical URLs) come from
// X-Forwarded-* headers. Only enable this where the API is reachable solely through the proxy.
var trustProxy = builder.Configuration.GetValue("ForwardedHeaders:TrustProxy", false);
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.AddMemoryCache();

// Contact forms: a fixed window per visitor IP and site.
var contactPermits = builder.Configuration.GetValue("PublicSites:ContactPermitLimit", 5);
var contactWindow = TimeSpan.FromSeconds(builder.Configuration.GetValue("PublicSites:ContactWindowSeconds", 600));
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(PublicSiteEndpoints.ContactRateLimitPolicy, context => RateLimitPartition.GetFixedWindowLimiter(
        $"{context.Connection.RemoteIpAddress}|{context.Request.RouteValues["siteSlug"]}",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = contactPermits, Window = contactWindow, QueueLimit = 0 }));
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "text/plain; charset=utf-8";
        await context.HttpContext.Response.WriteAsync("Too many messages were sent from your connection. Please try again later.", cancellationToken);
    };
});

var app = builder.Build();

// Build-time OpenAPI generation runs this entry point too; it must not touch a database.
var isOpenApiGeneration = Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";
if (!isOpenApiGeneration && app.Configuration.GetValue("Database:InitializeOnStartup", defaultValue: false))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync();
}

if (trustProxy)
{
    app.UseForwardedHeaders();
}

app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    await next(context);
});
app.UseStatusCodePages();

// {slug}.localhost is rewritten to /s/{slug}/… before routing picks an endpoint.
app.UseMiddleware<SiteHostRouting>();
app.UseRouting();
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<AntiforgeryMiddleware>();

// The published-site stylesheet and script (packages/site-styles), shared with the editor canvas.
var siteAssetsPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, app.Configuration["SiteAssets:Path"] ?? "../../packages/site-styles/src"));
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(siteAssetsPath),
    RequestPath = "/site-assets",
    OnPrepareResponse = context => context.Context.Response.Headers.CacheControl = "public, max-age=300",
});

app.MapOpenApi();
app.MapHealthChecks("/health");
app.MapAuthEndpoints();
app.MapSectionTypeEndpoints();
app.MapLibraryEndpoints();
app.MapThemePresetEndpoints();
app.MapTemplateEndpoints();
app.MapSiteEndpoints();
app.MapMediaEndpoints();
app.MapSitePublishingEndpoints();
app.MapPublicSiteEndpoints();

await app.RunAsync();

/// <summary>Entry point marker for <c>WebApplicationFactory</c> in integration tests.</summary>
public partial class Program;
