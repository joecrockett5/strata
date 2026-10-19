using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Strata.Domain.Identity;
using Strata.Infrastructure.Identity;
using Strata.Infrastructure.Persistence;

namespace Strata.Infrastructure.Seeding;

/// <summary>Applies migrations and seeds roles and (when enabled) development accounts.</summary>
public sealed partial class DatabaseInitializer(
    StrataDbContext db,
    RoleManager<IdentityRole<Guid>> roleManager,
    UserManager<StrataUser> userManager,
    IOptions<SeedOptions> seedOptions,
    ILogger<DatabaseInitializer> logger)
{
    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await db.Database.MigrateAsync(cancellationToken);

        foreach (var role in Roles.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                EnsureSucceeded(await roleManager.CreateAsync(new IdentityRole<Guid>(role)), $"create role {role}");
            }
        }

        if (!seedOptions.Value.Enabled)
        {
            return;
        }

        foreach (var seed in seedOptions.Value.Users)
        {
            await EnsureUserAsync(seed);
        }
    }

    private async Task EnsureUserAsync(SeedUser seed)
    {
        if (!Roles.All.Contains(seed.Role))
        {
            throw new InvalidOperationException($"Seed user role '{seed.Role}' is not a known role.");
        }

        var user = await userManager.FindByEmailAsync(seed.Email);
        if (user is null)
        {
            user = new StrataUser
            {
                Id = Guid.CreateVersion7(),
                UserName = seed.Email,
                Email = seed.Email,
                EmailConfirmed = true,
                DisplayName = seed.DisplayName,
            };
            EnsureSucceeded(await userManager.CreateAsync(user, seed.Password), "create seed user");
            LogSeededUser(logger, seed.Role);
        }

        if (!await userManager.IsInRoleAsync(user, seed.Role))
        {
            EnsureSucceeded(await userManager.AddToRoleAsync(user, seed.Role), "assign seed role");
        }
    }

    private static void EnsureSucceeded(IdentityResult result, string action)
    {
        if (!result.Succeeded)
        {
            var errors = string.Join("; ", result.Errors.Select(e => e.Description));
            throw new InvalidOperationException($"Failed to {action}: {errors}");
        }
    }

    // Deliberately logs only the role, never the email or password.
    [LoggerMessage(Level = LogLevel.Information, Message = "Seeded development user with role {Role}")]
    private static partial void LogSeededUser(ILogger logger, string role);
}
