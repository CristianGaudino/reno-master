import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { ErrorScreen } from './components/ErrorScreen'
import { EditorPage } from './routes/EditorPage'
import { ProjectsPage } from './routes/ProjectsPage'
import { SettingsPage } from './routes/SettingsPage'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <ErrorScreen />,
    children: [
      { path: '/', element: <Navigate to="/projects" replace /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  // The editor sits outside the shell: it needs the whole viewport, and its own
  // header carries the sync status and view controls.
  {
    path: '/projects/:id',
    element: <EditorPage />,
    errorElement: <ErrorScreen />,
  },
])
