import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import TrashPage from './pages/TrashPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import PublicFolderPage from './pages/PublicFolderPage';
import SharePage from './pages/SharePage';
import ShareLinksPage from './pages/ShareLinksPage';


function App(){
  return <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage></LoginPage>}></Route>
              <Route path="/p/:slug" element={<PublicFolderPage />} />
              <Route path="/share/:token" element={<SharePage />} />

              <Route path="/dashboard" element={<ProtectedRoute><Dashboard></Dashboard></ProtectedRoute>}></Route>
              <Route path="/share-links" element={<ProtectedRoute><ShareLinksPage /></ProtectedRoute>} />

              <Route 
                    path="/trash" 
                    element={
                        <ProtectedRoute>
                            <TrashPage />
                        </ProtectedRoute>
                    } 
                />
                 <Route 
                    path="/settings" 
                    element={
                        <ProtectedRoute>
                            <SettingsPage />
                        </ProtectedRoute>
                    } 
                />
                <Route 
    path="/admin" 
    element={
        <ProtectedRoute>
            <AdminPage />
        </ProtectedRoute>
    } 
/>
              <Route path="/" element={<LoginPage></LoginPage>}></Route>

            </Routes>
        </BrowserRouter>
}

export default App

