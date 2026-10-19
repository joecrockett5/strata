using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using Strata.Api.Infrastructure;
using Strata.Domain.Media;
using Strata.Infrastructure.Persistence;
using Strata.Infrastructure.Storage;

namespace Strata.Api.Features.Media;

public sealed record MediaDto(Guid Id, string Url, string FileName, string ContentType, long ByteSize, int Width, int Height, DateTimeOffset CreatedAt)
{
    public static MediaDto From(MediaAsset asset) =>
        new(asset.Id, $"/media/{asset.Id}", asset.FileName, asset.ContentType, asset.ByteSize, asset.Width, asset.Height, asset.CreatedAt);
}

public static class MediaEndpoints
{
    public static IEndpointRouteBuilder MapMediaEndpoints(this IEndpointRouteBuilder routes)
    {
        var api = routes.MapGroup("/api/media").WithTags("Media").RequireAuthorization(AuthenticationSetup.AuthorPolicy);
        api.MapGet("/", ListAsync).WithName("ListMedia");
        api.MapPost("/", UploadAsync)
            .WithName("UploadMedia")
            .Accepts<IFormFile>("multipart/form-data")
            // Antiforgery is enforced for every unsafe /api request by AntiforgeryMiddleware.
            .DisableAntiforgery();

        // Public: published sites embed these URLs. Ids are random v7 GUIDs and files are immutable.
        routes.MapGet("/media/{id:guid}", ServeAsync).WithTags("Media").WithName("GetMediaFile").AllowAnonymous();

        return routes;
    }

    private static async Task<Ok<List<MediaDto>>> ListAsync(StrataDbContext db, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        var ownerId = user.GetUserId();
        var assets = await db.MediaAssets.Where(m => m.OwnerId == ownerId).OrderByDescending(m => m.CreatedAt).ToListAsync(cancellationToken);
        return TypedResults.Ok(assets.Select(MediaDto.From).ToList());
    }

    private static async Task<Results<Created<MediaDto>, ProblemHttpResult>> UploadAsync(
        IFormFile file,
        StrataDbContext db,
        IFileStorage storage,
        TimeProvider clock,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (file.Length == 0)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status400BadRequest, title: "The file is empty");
        }

        if (file.Length > MediaAsset.MaxBytes)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status413PayloadTooLarge, title: "Images must be 5 MB or smaller");
        }

        using var buffer = new MemoryStream((int)file.Length);
        await file.CopyToAsync(buffer, cancellationToken);

        // Trust the bytes, not the file name or the client-supplied content type.
        var info = ImageInspector.Inspect(buffer.GetBuffer().AsSpan(0, (int)buffer.Length));
        if (info is null)
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status415UnsupportedMediaType,
                title: "Unsupported image type",
                detail: "Upload a JPEG, PNG or WebP image. SVG and other formats are not accepted.");
        }

        buffer.Position = 0;
        var key = await storage.SaveAsync(buffer, info.Extension, cancellationToken);
        var fileName = Path.GetFileName(file.FileName);
        var asset = MediaAsset.Create(user.GetUserId(), fileName.Length > 255 ? fileName[..255] : fileName, info.ContentType, buffer.Length, info.Width, info.Height, key, clock.GetUtcNow());
        db.MediaAssets.Add(asset);
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Created($"/media/{asset.Id}", MediaDto.From(asset));
    }

    private static async Task<IResult> ServeAsync(Guid id, StrataDbContext db, IFileStorage storage, HttpContext context, CancellationToken cancellationToken)
    {
        var asset = await db.MediaAssets.AsNoTracking().SingleOrDefaultAsync(m => m.Id == id, cancellationToken);
        var stream = asset is null ? null : await storage.OpenReadAsync(asset.StorageKey, cancellationToken);
        if (asset is null || stream is null)
        {
            return Problems.NotFound("Image");
        }

        context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        return TypedResults.Stream(stream, asset.ContentType, entityTag: new EntityTagHeaderValue($"\"{asset.Id:N}\""), enableRangeProcessing: false);
    }
}
