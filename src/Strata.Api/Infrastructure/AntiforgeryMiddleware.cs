using Microsoft.AspNetCore.Antiforgery;

namespace Strata.Api.Infrastructure;

/// <summary>
/// Validates the antiforgery token (header <c>X-XSRF-TOKEN</c>, double-submit cookie) on every
/// unsafe request to <c>/api</c>. Minimal APIs only validate form-bound endpoints by default,
/// so JSON endpoints need this explicit check.
/// </summary>
public sealed class AntiforgeryMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IAntiforgery antiforgery)
    {
        if (RequiresValidation(context.Request))
        {
            if (!await antiforgery.IsRequestValidAsync(context))
            {
                await Results.Problem(
                        statusCode: StatusCodes.Status400BadRequest,
                        title: "Invalid antiforgery token",
                        detail: "Fetch a token from GET /api/auth/antiforgery and send it in the X-XSRF-TOKEN header.",
                        type: "https://strata.dev/problems/antiforgery")
                    .ExecuteAsync(context);
                return;
            }
        }

        await next(context);
    }

    private static bool RequiresValidation(HttpRequest request) =>
        request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase)
        && !HttpMethods.IsGet(request.Method)
        && !HttpMethods.IsHead(request.Method)
        && !HttpMethods.IsOptions(request.Method);
}
