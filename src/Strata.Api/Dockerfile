# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /repo
COPY global.json Directory.Build.props Directory.Packages.props Strata.slnx .editorconfig ./
COPY src/Strata.Domain/Strata.Domain.csproj src/Strata.Domain/
COPY src/Strata.Infrastructure/Strata.Infrastructure.csproj src/Strata.Infrastructure/
COPY src/Strata.Rendering/Strata.Rendering.csproj src/Strata.Rendering/
COPY src/Strata.Api/Strata.Api.csproj src/Strata.Api/
RUN dotnet restore src/Strata.Api/Strata.Api.csproj
COPY src/ src/
COPY schema/ schema/
COPY packages/ packages/
RUN dotnet publish src/Strata.Api/Strata.Api.csproj -c Release -o /app --no-restore -p:OpenApiGenerateDocuments=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app ./
COPY packages/site-styles/src ./site-assets
ENV SiteAssets__Path=/app/site-assets
# Create the media mount point owned by the app user; a new named volume inherits this ownership.
RUN mkdir -p /data/media && chown $APP_UID:$APP_UID /data/media
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Strata.Api.dll"]
