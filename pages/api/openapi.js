export default async function handler(req, res) {
  try {
    const response = await fetch(`https://${process.env.DOMAIN_URL}/api/routes`);
    const routes = await response.json();

    const groupedPaths = routes
      .filter(route => route.path.startsWith("/api"))
      .reduce((acc, route) => {
        const tag = route.path.split("/api/")[1]?.split("/")[0] || "general";
        const capitalizedName = route.name.charAt(0).toUpperCase() + route.name.slice(1);

        acc[tag] = acc[tag] || {};
        acc[tag][route.path] = {
          get: {
            summary: `Retrieve ${capitalizedName}`,
            description: `Fetches the ${capitalizedName} route.`,
            tags: [tag],
            parameters: (route.params || []).map(param => ({
              name: param.name,
              in: "query",
              schema: { type: "string" },
              required: param.required,
              description: `The ${param.name} parameter for ${capitalizedName}`
            })),
            responses: {
              200: {
                description: `${capitalizedName} route details`,
                content: {
                  "application/json": {
                    schema: {
                      $ref: `#/components/schemas/${capitalizedName}`
                    }
                  }
                }
              },
              400: {
                description: "Bad request due to invalid parameters",
                content: {
                  "application/json": {
                    schema: {
                      $ref: `#/components/schemas/ErrorResponse`
                    }
                  }
                }
              },
              404: {
                description: "Route not found",
                content: {
                  "application/json": {
                    schema: {
                      $ref: `#/components/schemas/ErrorResponse`
                    }
                  }
                }
              },
              500: {
                description: "Internal server error",
                content: {
                  "application/json": {
                    schema: {
                      $ref: `#/components/schemas/ErrorResponse`
                    }
                  }
                }
              }
            }
          }
        };
        return acc;
      }, {});

    const schemas = routes.reduce(
      (acc, route) => {
        const capitalizedName = route.name.charAt(0).toUpperCase() + route.name.slice(1);
        acc[capitalizedName] = {
          type: "object",
          properties: {
            path: { type: "string", description: "The route path" },
            name: { type: "string", description: "The name of the route" },
            params: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Parameter name" },
                  required: { type: "boolean", description: "Is the parameter required" },
                  in: { type: "string", description: "Location of the parameter" },
                  schema: { type: "object", description: "Schema of the parameter" }
                }
              }
            }
          }
        };

        acc.ErrorResponse = {
          type: "object",
          properties: {
            error: { type: "string", description: "Error message" },
            code: { type: "integer", description: "HTTP status code" }
          }
        };

        return acc;
      },
      { ErrorResponse: {} }
    );

    const paths = Object.values(groupedPaths).reduce((acc, group) => ({ ...acc, ...group }), {});
    const openAPISpec = {
      openapi: "3.0.0",
      info: {
        title: "Dynamic Routes API",
        version: "1.0.0",
        description: "API documentation for routes with dynamic paths, parameters, and tags."
      },
      servers: [
        {
          url: `https://${process.env.DOMAIN_URL}`,
          description: "Base server for the API"
        }
      ],
      tags: Object.keys(groupedPaths).map(tag => ({
        name: tag.toUpperCase(),
        description: `Routes under the "${tag}" tag`
      })),
      paths,
      components: {
        schemas
      }
    };

    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(openAPISpec, null, 2));
  } catch {
    res.status(500).json({
      error: "Failed to generate OpenAPI spec",
      code: 500
    });
  }
}
