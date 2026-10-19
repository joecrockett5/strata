using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Strata.Api.Features.Content;
using Strata.Api.Infrastructure;
using Strata.Domain.Content;
using Strata.Domain.Templates;
using Strata.Infrastructure.Persistence;

namespace Strata.Api.Features.Templates;

public sealed record ThemePresetDto(Guid Id, string Name, JsonElement Theme)
{
    public static ThemePresetDto From(ThemePreset preset) => new(preset.Id, preset.Name, ContentJson.ToElement(preset.Theme));
}

public sealed record SaveThemePresetRequest([property: Required, StringLength(80, MinimumLength = 1)] string Name, JsonElement Theme);

public static class ThemePresetEndpoints
{
    public static IEndpointRouteBuilder MapThemePresetEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/theme-presets").WithTags("Theme presets");

        group.MapGet("/", ListAsync).WithName("ListThemePresets").RequireAuthorization(AuthenticationSetup.AuthorPolicy);
        group.MapPost("/", CreateAsync).WithName("CreateThemePreset").RequireAuthorization(AuthenticationSetup.DesignerPolicy);
        group.MapPut("/{id:guid}", UpdateAsync).WithName("UpdateThemePreset").RequireAuthorization(AuthenticationSetup.DesignerPolicy);
        group.MapDelete("/{id:guid}", DeleteAsync).WithName("DeleteThemePreset").RequireAuthorization(AuthenticationSetup.DesignerPolicy);

        return routes;
    }

    private static async Task<Ok<List<ThemePresetDto>>> ListAsync(StrataDbContext db, CancellationToken cancellationToken)
    {
        var presets = await db.ThemePresets.OrderBy(p => p.Name).ToListAsync(cancellationToken);
        return TypedResults.Ok(presets.Select(ThemePresetDto.From).ToList());
    }

    private static async Task<Results<Created<ThemePresetDto>, ProblemHttpResult>> CreateAsync(
        SaveThemePresetRequest request, ContentWritePipeline pipeline, StrataDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var theme = pipeline.ParseTheme(request.Theme);
        if (!theme.IsValid)
        {
            return Problems.ContentInvalid(theme.Violations);
        }

        if (await db.ThemePresets.AnyAsync(p => p.Name == request.Name, cancellationToken))
        {
            return Problems.Conflict("A theme preset with that name already exists");
        }

        var preset = ThemePreset.Create(request.Name.Trim(), theme.Value!, clock.GetUtcNow());
        db.ThemePresets.Add(preset);
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Created($"/api/theme-presets/{preset.Id}", ThemePresetDto.From(preset));
    }

    private static async Task<Results<Ok<ThemePresetDto>, ProblemHttpResult>> UpdateAsync(
        Guid id, SaveThemePresetRequest request, ContentWritePipeline pipeline, StrataDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var preset = await db.ThemePresets.FindAsync([id], cancellationToken);
        if (preset is null)
        {
            return Problems.NotFound("Theme preset");
        }

        var theme = pipeline.ParseTheme(request.Theme);
        if (!theme.IsValid)
        {
            return Problems.ContentInvalid(theme.Violations);
        }

        preset.Update(request.Name.Trim(), theme.Value!, clock.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(ThemePresetDto.From(preset));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> DeleteAsync(Guid id, StrataDbContext db, CancellationToken cancellationToken)
    {
        var deleted = await db.ThemePresets.Where(p => p.Id == id).ExecuteDeleteAsync(cancellationToken);
        return deleted == 0 ? Problems.NotFound("Theme preset") : TypedResults.NoContent();
    }
}
