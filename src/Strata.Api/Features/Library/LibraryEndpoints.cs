using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Strata.Api.Features.Content;
using Strata.Api.Infrastructure;
using Strata.Domain.Content.Validation;
using Strata.Infrastructure.Persistence;

namespace Strata.Api.Features.Library;

public static class LibraryEndpoints
{
    public static IEndpointRouteBuilder MapLibraryEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/library", GetLibraryAsync)
            .WithTags("Library")
            .WithName("GetSectionLibrary")
            .WithSummary("The latest published version of every non-archived section type — what the library inserts.")
            .RequireAuthorization(AuthenticationSetup.AuthorPolicy);
        return routes;
    }

    private static async Task<Ok<List<PublishedSectionDto>>> GetLibraryAsync(StrataDbContext db, CancellationToken cancellationToken)
    {
        var latest = await db.SectionTypes
            .Where(t => t.ArchivedAt == null && t.LatestVersion > 0)
            .Join(db.SectionTypeVersions, t => new { t.Id, Version = t.LatestVersion }, v => new { Id = v.SectionTypeId, v.Version }, (t, v) => v)
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(PublishedSectionDto.FromAll(
            latest.Select(v => new PublishedSection(v.Ref, v.Name, v.Category, v.Definition, typeArchived: false))));
    }
}
