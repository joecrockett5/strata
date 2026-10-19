using Microsoft.AspNetCore.Identity;
using Strata.Domain.Identity;

namespace Strata.Api.Infrastructure;

public static class AuthenticationSetup
{
    public const string DesignerPolicy = "Designer";
    public const string SiteOwnerPolicy = "SiteOwner";

    public static IServiceCollection AddStrataAuthentication(this IServiceCollection services)
    {
        services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();

        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = "strata.auth";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            options.ExpireTimeSpan = TimeSpan.FromDays(7);
            options.SlidingExpiration = true;

            // This is an API: answer with status codes, never redirect to a login page.
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });

        services.AddAuthorizationBuilder()
            .AddPolicy(DesignerPolicy, policy => policy.RequireRole(Roles.Designer))
            .AddPolicy(SiteOwnerPolicy, policy => policy.RequireRole(Roles.SiteOwner));

        services.AddAntiforgery(options =>
        {
            options.HeaderName = AntiforgeryCookies.HeaderName;
            options.Cookie.Name = "strata.af";
            options.Cookie.SameSite = SameSiteMode.Strict;
        });

        return services;
    }
}
