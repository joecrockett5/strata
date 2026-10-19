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

    protected async Task<DesignerApi> DesignerAsync() => new(await ClientForAsync(StrataApiFactory.Designer));

    protected async Task<OwnerApi> OwnerAsync(TestUser? user = null) => new(await ClientForAsync(user ?? StrataApiFactory.Owner));

    public virtual ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public virtual async ValueTask DisposeAsync()
    {
        await Factory.DisposeAsync();
        GC.SuppressFinalize(this);
    }
}
