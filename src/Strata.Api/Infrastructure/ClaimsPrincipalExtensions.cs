using System.Security.Claims;

namespace Strata.Api.Infrastructure;

public static class ClaimsPrincipalExtensions
{
    /// <summary>The authenticated user's id. Only call on endpoints that require authorization.</summary>
    public static Guid GetUserId(this ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new InvalidOperationException("The current principal has no user id claim.");
}
