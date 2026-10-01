import { Outlet, RouterProvider, createBrowserRouter } from 'react-router';
import {
  AppLayout,
  NotFound,
  PublicOnly,
  RequireAdmin,
  RequireApproved,
  RequireAuth,
  RouteError,
} from './components/Layout.jsx';
import { Register, SignIn } from './pages/Auth.jsx';
import { Home } from './pages/Home.jsx';
import { Mentorship } from './pages/Mentorship.jsx';
import { Profile } from './pages/Profile.jsx';
import { Soon } from './pages/Soon.jsx';

const routes = [
  {
    path: '/sign-in',
    element: (
      <PublicOnly>
        <SignIn />
      </PublicOnly>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicOnly>
        <Register />
      </PublicOnly>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      // Profile stays open while an account waits for approval: it shapes recommendations.
      { path: 'profile', element: <Profile /> },
      {
        element: (
          <RequireApproved>
            <Outlet />
          </RequireApproved>
        ),
        children: [
          { index: true, element: <Home /> },
          { path: 'mentorship', element: <Mentorship /> },
          { path: 'directory', element: <Soon moduleKey="networking" /> },
          { path: 'connections', element: <Soon moduleKey="networking" /> },
          { path: 'members/:id', element: <Soon moduleKey="networking" /> },
          { path: 'knowledge/*', element: <Soon moduleKey="knowledge" /> },
          { path: 'events/*', element: <Soon moduleKey="events" /> },
          { path: 'updates', element: <Soon moduleKey="updates" /> },
          {
            path: 'admin/*',
            element: (
              <RequireAdmin>
                <Soon moduleKey="admin" />
              </RequireAdmin>
            ),
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
