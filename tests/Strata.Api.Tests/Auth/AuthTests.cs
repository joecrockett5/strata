using System.Net;
using System.Net.Http.Json;
using Strata.Api.Tests.Infrastructure;

namespace Strata.Api.Tests.Auth;

public sealed class AuthTests(PostgresFixture postgres) : ApiTestBase(postgres)
{
    public static TheoryData<string> SeededRoles => ["Designer", "SiteOwner"];

    [Theory]
    [MemberData(nameof(SeededRoles))]
    public async Task Seeded_user_can_log_in_and_read_their_profile(string role)
    {
        var user = role == "Designer" ? StrataApiFactory.Designer : StrataApiFactory.Owner;
        using var client = await ClientForAsync(user);

        var me = await client.Http.GetFromJsonAsync<MeDto>("/api/auth/me", TestContext.Current.CancellationToken);

        me.ShouldNotBeNull();
        me.Email.ShouldBe(user.Email);
        me.Roles.ShouldBe([role]);
    }

    [Fact]
    public async Task Wrong_password_is_rejected_with_problem_details()
    {
        using var client = AnonymousClient();

        using var response = await client.LoginAsync(StrataApiFactory.LoginProbe.Email, "not-the-password");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        response.Content.Headers.ContentType?.MediaType.ShouldBe("application/problem+json");
    }

    [Fact]
    public async Task Login_without_antiforgery_token_is_rejected()
    {
        var handler = new BrowserLikeHandler { SendAntiforgeryHeader = false };
        using var http = Factory.CreateDefaultClient(handler);

        using var response = await http.PostAsJsonAsync(
            "/api/auth/login",
            new { email = StrataApiFactory.Owner.Email, password = StrataApiFactory.Owner.Password },
            TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Me_requires_authentication()
    {
        using var client = AnonymousClient();

        using var response = await client.Http.GetAsync(new Uri("/api/auth/me", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Logout_ends_the_session()
    {
        using var client = await ClientForAsync(StrataApiFactory.Owner);

        using var logout = await client.Http.PostAsync(new Uri("/api/auth/logout", UriKind.Relative), null, TestContext.Current.CancellationToken);
        logout.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var me = await client.Http.GetAsync(new Uri("/api/auth/me", UriKind.Relative), TestContext.Current.CancellationToken);
        me.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Health_check_reports_healthy_database()
    {
        using var client = AnonymousClient();

        var body = await client.Http.GetStringAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        body.ShouldBe("Healthy");
    }

    private sealed record MeDto(Guid Id, string Email, string DisplayName, string[] Roles);
}
