using Microsoft.Extensions.DependencyInjection;

namespace Strata.Rendering;

public static class DependencyInjection
{
    public static IServiceCollection AddStrataRendering(this IServiceCollection services) =>
        services.AddSingleton<StrataRenderer>();
}
