import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ClientApp from './pages/ClientApp';
import Dashboard from './pages/Dashboard';
import SuperAdmin from './pages/SuperAdmin';
import Register from './pages/Register';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClientApp />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/register" element={<Register />} />
        <Route path="/superadmin" element={<SuperAdmin />} />
      </Routes>
    </BrowserRouter>
  );
}
