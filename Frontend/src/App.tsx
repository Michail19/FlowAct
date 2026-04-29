import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import NotebookPage from './pages/NotebookPage.tsx';
import AccountPage from './pages/AccountPage';

import './styles/variables.css';
import './styles/global.css';

function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/landing" replace />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/notebook" element={<NotebookPage />} />
          <Route path="/my-account" element={<AccountPage />} />
        </Routes>
      </BrowserRouter>
  );
}
