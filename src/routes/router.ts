export type RouteHandler = (
  request: Request, 
  params: Record<string, string>
) => Promise<Response>;

export interface Route {
  path: string;
  handler: RouteHandler;
}

export const createRouter = (routes: Route[]) => {
  return (request: Request, path: string): Promise<Response> => {
    if (path.startsWith("/static/")) {
      const staticRoute = routes.find(route => route.path === "/static/*");
      if (staticRoute) {
        return staticRoute.handler(request, {});
      }
    }
    
    // Match routes with path parameters
    for (const route of routes) {
      const pattern = new URLPattern({ pathname: route.path });
      const match = pattern.exec({ pathname: path });
      
      if (match) {
        return route.handler(request, match.pathname.groups as Record<string, string>);
      }
    }

    return Promise.resolve(new Response("Not found", { status: 404 }));
  };
};