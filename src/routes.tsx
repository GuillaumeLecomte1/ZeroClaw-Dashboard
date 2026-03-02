import { createRouter, createRootRoute, createRoute, Outlet } from '@tanstack/react-router'

const rootRoute = createRootRoute({
  component: () => (
    <div className="app-container">
      <Outlet />
    </div>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function Index() {
    return (
      <div className="home-page">
        <h1>ZeroClaw Dashboard</h1>
      </div>
    )
  },
})

const routeTree = rootRoute.addChildren([indexRoute])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export { router, routeTree }
