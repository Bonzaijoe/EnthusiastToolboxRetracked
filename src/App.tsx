import { Navigate, Route, Routes } from 'react-router-dom'
import { Nav } from './components/Nav'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { MyCoasters } from './pages/MyCoasters'
import { MyRankings } from './pages/MyRankings'
import { Friends } from './pages/Friends'
import { FriendProfile } from './pages/FriendProfile'
import { Combined } from './pages/Combined'
import { Account } from './pages/Account'
import { PatchNotes } from './pages/PatchNotes'
import { Database } from './pages/Database'

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/patch-notes" element={<PatchNotes />} />
        <Route
          path="/my-coasters"
          element={
            <ProtectedRoute>
              <MyCoasters />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-rankings"
          element={
            <ProtectedRoute>
              <MyRankings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <Friends />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends/:userId"
          element={
            <ProtectedRoute>
              <FriendProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/combined"
          element={
            <ProtectedRoute>
              <Combined />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />
        <Route
          path="/database"
          element={
            <ProtectedRoute>
              <Database />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/my-coasters" replace />} />
      </Routes>
    </>
  )
}
