using Microsoft.AspNetCore.Identity;

namespace Strata.Infrastructure.Identity;

public sealed class StrataUser : IdentityUser<Guid>
{
    public required string DisplayName { get; set; }
}
