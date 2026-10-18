import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './auth/AuthContext'
import Layout from './components/Layout'
import { GuestOnly, RequireAdmin, RequireAuth } from './components/guards'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Library from './pages/Library'
import Search from './pages/Search'
import GameDetail from './pages/GameDetail'
import Recommendations from './pages/Recommendations'
import Profile from './pages/Profile'
import AdminPage from './pages/admin/AdminPage'
import NotFound from './pages/NotFound'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="games/:id" element={<GameDetail />} />
            <Route element={<GuestOnly />}>
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route path="library" element={<Library />} />
              <Route path="search" element={<Search />} />
              <Route path="recommendations" element={<Recommendations />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route element={<RequireAdmin />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
