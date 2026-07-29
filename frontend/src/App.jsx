import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Notification from './components/Notification';
import FloorPlan from './pages/FloorPlan';
import POSScreen from './pages/POSScreen';
import StockPage from './pages/StockPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import useStore from './store/useStore';

export default function App() {
  const { fetchTables, fetchCatalog, fetchStockAlerts } = useStore();

  useEffect(() => {
    fetchTables();
    fetchCatalog();
    fetchStockAlerts();
    const interval = setInterval(() => {
      fetchTables();
      fetchStockAlerts();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <BrowserRouter>
      <div className="flex flex-col h-full">
        <Header />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/tables" replace />} />
            <Route path="/tables" element={<FloorPlan />} />
            <Route path="/pos/:tableId" element={<POSScreen />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
        <Notification />
      </div>
    </BrowserRouter>
  );
}
