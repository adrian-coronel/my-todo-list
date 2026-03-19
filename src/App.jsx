import React from 'react';
import { AppProvider } from './context/AppContext';
import AppHeader from './components/AppHeader';
import Sidebar from './components/Sidebar';
import WeeklyCalendar from './components/WeeklyCalendar';
import './index.css';

function App() {
  return (
    <AppProvider>
      <div className="app-layout">
        <AppHeader />
        <div className="app-body">
          <Sidebar />
          <main className="main-canvas">
            <WeeklyCalendar />
          </main>
        </div>
      </div>
    </AppProvider>
  );
}

export default App;
