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
import { AdminArticles, AdminLayout, AdminMembers, AdminOverview } from './pages/Admin.jsx';
import { AdminEvents, AdminUpdates } from './pages/AdminContent.jsx';
import { Register, SignIn } from './pages/Auth.jsx';
import { EventDetail, EventsList } from './pages/Events.jsx';
import { Home } from './pages/Home.jsx';
import { ArticleEditor, ArticleView, KnowledgeList } from './pages/Knowledge.jsx';
import { Mentorship } from './pages/Mentorship.jsx';
import { Connections, Directory, MemberProfile } from './pages/Networking.jsx';
import { Profile } from './pages/Profile.jsx';
import { Updates } from './pages/Updates.jsx';

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
          { path: 'directory', element: <Directory /> },
          { path: 'connections', element: <Connections /> },
          { path: 'members/:id', element: <MemberProfile /> },
          { path: 'knowledge', element: <KnowledgeList /> },
          { path: 'knowledge/new', element: <ArticleEditor /> },
          { path: 'knowledge/:id', element: <ArticleView /> },
          { path: 'knowledge/:id/edit', element: <ArticleEditor /> },
          { path: 'events', element: <EventsList /> },
          { path: 'events/:id', element: <EventDetail /> },
          { path: 'updates', element: <Updates /> },
          {
            path: 'admin',
            element: (
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            ),
            children: [
              { index: true, element: <AdminOverview /> },
              { path: 'members', element: <AdminMembers /> },
              { path: 'articles', element: <AdminArticles /> },
              { path: 'events', element: <AdminEvents /> },
              { path: 'updates', element: <AdminUpdates /> },
            ],
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
