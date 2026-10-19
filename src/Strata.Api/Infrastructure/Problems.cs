using Microsoft.AspNetCore.Http.HttpResults;
using Strata.Domain.Content.Validation;

namespace Strata.Api.Infrastructure;

/// <summary>Factory for the API's ProblemDetails responses. Problem types are stable URNs.</summary>
public static class Problems
{
    public const string ContentInvalidType = "urn:strata:problem:content-invalid";
    public const string ConflictType = "urn:strata:problem:conflict";
    public const string PreconditionRequiredType = "urn:strata:problem:precondition-required";
    public const string NotFoundType = "urn:strata:problem:not-found";

    /// <summary>422 listing every violation (schema, semantic or locking rules).</summary>
    public static ProblemHttpResult ContentInvalid(IReadOnlyList<ContentViolation> violations, string title = "The content is not valid") =>
        TypedResults.Problem(
            statusCode: StatusCodes.Status422UnprocessableEntity,
            title: title,
            detail: $"{violations.Count} problem(s) found.",
            type: ContentInvalidType,
            extensions: new Dictionary<string, object?> { ["errors"] = violations });

    public static ProblemHttpResult NotFound(string what) =>
        TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: $"{what} not found", type: NotFoundType);

    public static ProblemHttpResult Conflict(string title, string? detail = null) =>
        TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: title, detail: detail, type: ConflictType);

    public static ProblemHttpResult PreconditionRequired() =>
        TypedResults.Problem(
            statusCode: StatusCodes.Status428PreconditionRequired,
            title: "If-Match header required",
            detail: "Send the ETag from the last read in an If-Match header to avoid overwriting newer changes.",
            type: PreconditionRequiredType);
}
