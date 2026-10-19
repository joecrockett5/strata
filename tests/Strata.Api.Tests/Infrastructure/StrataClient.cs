using System.Net;
using System.Net.Http.Json;

namespace Strata.Api.Tests.Infrastructure;

/// <summary>Thin wrapper over <see cref="HttpClient"/> with Strata-specific helpers.</summary>
public sealed class StrataClient(HttpClient http) : IDisposable
{
    public HttpClient Http { get; } = http;

    public async Task PrimeAntiforgeryAsync()
    {
        using var response = await Http.GetAsync(new Uri("/api/auth/antiforgery", UriKind.Relative));
        response.EnsureSuccessStatusCode();
    }

    public async Task<HttpResponseMessage> LoginAsync(string email, string password)
    {
        await PrimeAntiforgeryAsync();
        return await Http.PostAsJsonAsync(new Uri("/api/auth/login", UriKind.Relative), new { email, password });
    }

    public async Task LoginAsAsync(TestUser user)
    {
        using var response = await LoginAsync(user.Email, user.Password);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
    }

    public void Dispose() => Http.Dispose();
}
