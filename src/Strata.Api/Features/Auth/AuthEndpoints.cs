using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Strata.Api.Infrastructure;
using Strata.Infrastructure.Identity;

namespace Strata.Api.Features.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/auth").WithTags("Auth");

        group.MapGet("/antiforgery", (IAntiforgery antiforgery, HttpContext context) =>
            {
                AntiforgeryCookies.Issue(antiforgery, context);
                return TypedResults.NoContent();
            })
            .WithName("GetAntiforgeryToken")
            .WithSummary("Issues the XSRF-TOKEN cookie that must be echoed in the X-XSRF-TOKEN header.");

        group.MapPost("/login", LoginAsync).WithName("Login");
        group.MapPost("/logout", LogoutAsync).WithName("Logout").RequireAuthorization();
        group.MapGet("/me", GetMeAsync).WithName("GetCurrentUser").RequireAuthorization();

        return routes;
    }

    private static async Task<Results<Ok<CurrentUserResponse>, ProblemHttpResult>> LoginAsync(
        LoginRequest request,
        SignInManager<StrataUser> signInManager,
        UserManager<StrataUser> userManager,
        IAntiforgery antiforgery,
        HttpContext context)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null)
        {
            return InvalidCredentials();
        }

        var result = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status423Locked,
                title: "Account temporarily locked",
                detail: "Too many failed attempts. Try again later.");
        }

        if (!result.Succeeded)
        {
            return InvalidCredentials();
        }

        await signInManager.SignInAsync(user, isPersistent: true);

        // Antiforgery tokens are bound to the user, so issue a fresh pair for the new identity.
        context.User = await signInManager.CreateUserPrincipalAsync(user);
        AntiforgeryCookies.Issue(antiforgery, context);

        return TypedResults.Ok(await CurrentUserResponse.FromAsync(user, userManager));
    }

    private static async Task<NoContent> LogoutAsync(
        SignInManager<StrataUser> signInManager,
        IAntiforgery antiforgery,
        HttpContext context)
    {
        await signInManager.SignOutAsync();
        context.User = new ClaimsPrincipal(new ClaimsIdentity());
        AntiforgeryCookies.Issue(antiforgery, context);
        return TypedResults.NoContent();
    }

    private static async Task<Results<Ok<CurrentUserResponse>, UnauthorizedHttpResult>> GetMeAsync(
        ClaimsPrincipal principal,
        UserManager<StrataUser> userManager)
    {
        var user = await userManager.GetUserAsync(principal);
        return user is null
            ? TypedResults.Unauthorized()
            : TypedResults.Ok(await CurrentUserResponse.FromAsync(user, userManager));
    }

    private static ProblemHttpResult InvalidCredentials() =>
        TypedResults.Problem(
            statusCode: StatusCodes.Status401Unauthorized,
            title: "Invalid email or password");
}

public sealed record LoginRequest(
    [property: Required, EmailAddress] string Email,
    [property: Required] string Password);

public sealed record CurrentUserResponse(Guid Id, string Email, string DisplayName, IReadOnlyList<string> Roles)
{
    public static async Task<CurrentUserResponse> FromAsync(StrataUser user, UserManager<StrataUser> userManager) =>
        new(user.Id, user.Email!, user.DisplayName, [.. await userManager.GetRolesAsync(user)]);
}
