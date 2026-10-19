namespace Strata.Api.Tests.Infrastructure;

/// <summary>Base class giving each test class its own API host over the shared Postgres container.</summary>
public abstract class ApiTestBase(PostgresFixture postgres) : IAsyncLifetime
{
    protected StrataApiFactory Factory { get; } = new(postgres);

    protected async Task<StrataClient> ClientForAsync(TestUser user)
    {
        var client = Factory.CreateStrataClient();
        await client.LoginAsAsync(user);
        return client;
    }

    protected StrataClient AnonymousClient() => Factory.CreateStrataClient();

    public virtual ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public virtual async ValueTask DisposeAsync()
    {
        await Factory.DisposeAsync();
        GC.SuppressFinalize(this);
    }
}
