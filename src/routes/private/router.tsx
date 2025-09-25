import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from '../../pages/landing-page/LandingPage';
import Dashboard from '../../pages/dashboard/Dashboard';

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}