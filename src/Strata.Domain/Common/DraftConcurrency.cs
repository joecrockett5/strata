namespace Strata.Domain.Common;

/// <summary>Thrown when a draft write is based on a stale revision (surfaces as HTTP 409).</summary>
public sealed class DraftConflictException(long expected, long actual)
    : Exception($"The draft was changed elsewhere (expected revision {expected}, current {actual}).")
{
    public long Expected { get; } = expected;
    public long Actual { get; } = actual;
}

/// <summary>A domain rule rejected an operation (surfaces as HTTP 409 or 422 depending on the endpoint).</summary>
public sealed class DomainRuleException(string message) : Exception(message);
