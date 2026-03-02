import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { Layout } from './components/Layout'
import { ChatPage } from './pages/ChatPage'
import { CLIPage } from './pages/CLIPage'
import { DashboardPage } from './pages/DashboardPage'
import { PlaywrightPage } from './pages/PlaywrightPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotFoundPage } from './pages/NotFoundPage'

const rootRoute = createRootRoute({
  component: Layout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
})

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  component: ChatPage,
})

const cliRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cli',
  component: CLIPage,
})

const playwrightRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/playwright',
  component: PlaywrightPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: NotFoundPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  chatRoute,
  cliRoute,
  playwrightRoute,
  settingsRoute,
  notFoundRoute,
])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export { router, routeTree }
