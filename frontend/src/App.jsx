import React, { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import UploadPage from './pages/UploadPage'
import ProcessingPage from './pages/ProcessingPage'
import ResultsPage from './pages/ResultsPage'
import DashboardPage from './pages/DashboardPage'
import ExportPage from './pages/ExportPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import { ToastProvider } from './components/Toast'
import { ModalProvider, SpatialContent } from './components/ModalContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'

// ---- Campus vertical (./campus) ----
import CampusLanding from './campus/pages/CampusLanding'
import CollegeSetupPage from './campus/pages/CollegeSetupPage'
import PCDashboard from './campus/pages/PCDashboard'
import BulkIngestPage from './campus/pages/BulkIngestPage'
import StudentsListPage from './campus/pages/StudentsListPage'
import DrivesListPage from './campus/pages/DrivesListPage'
import DriveDetailPage from './campus/pages/DriveDetailPage'
import CampusChatPage from './campus/pages/ChatPage'
import StudentDashboard from './campus/pages/StudentDashboard'
import RecruiterView from './campus/pages/RecruiterView'
import AuditLogPage from './campus/pages/AuditLogPage'
import CampusLogin from './campus/pages/CampusLogin'
import RequireAuth from './campus/components/RequireAuth'
import { CampusToastProvider } from './campus/components/Toast'
import { applyStoredTheme } from './campus/components/DarkModeToggle'

// Global session context
const SessionContext = createContext(null)

export function useSession() {
  return useContext(SessionContext)
}

function AppContent() {
  const [sessionData, setSessionData] = useState(null)
  const [currentStep, setCurrentStep] = useState(0) // 0 = landing, 1-4 = steps
  const navigate = useNavigate()

  // Apply stored campus theme (dark/light) once on mount.
  useEffect(() => { applyStoredTheme() }, [])

  const startScreening = () => {
    setCurrentStep(1)
    navigate('/upload')
  }

  const goToProcessing = (data) => {
    setSessionData(data)
    setCurrentStep(2)
    navigate('/processing')
  }

  const goToResults = (data) => {
    setSessionData(data)
    setCurrentStep(3)
    navigate('/results')
  }

  const goToExport = () => {
    setCurrentStep(4)
    navigate('/export')
  }

  const goToDashboard = (data) => {
    if (data) setSessionData(data)
    setCurrentStep(3) // Share step 3 with Results
    navigate('/dashboard')
  }

  const startNew = () => {
    setSessionData(null)
    setCurrentStep(1)
    navigate('/upload')
  }

  const goHome = () => {
    setCurrentStep(0)
    navigate('/')
  }

  return (
    <SessionContext.Provider value={{
      sessionData, setSessionData,
      currentStep, setCurrentStep,
      goToProcessing, goToResults, goToDashboard, goToExport, startNew, goHome
    }}>
      <SpatialContent className={currentStep > 0 ? 'main-content' : ''}>
        {currentStep > 0 && <Navbar currentStep={currentStep} />}
        <Routes>
          <Route path="/" element={<LandingPage onStart={startScreening} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/processing" element={<ProcessingPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/dashboard" element={
            sessionData ? <DashboardPage sessionData={sessionData} setSessionData={setSessionData} /> : <Navigate to="/" />
          } />
          <Route path="/export" element={<ExportPage />} />

          {/* ---- Campus vertical (toast provider wraps everything; auth gates writes) ---- */}
          <Route path="/campus" element={<CampusToastProvider><CampusLanding /></CampusToastProvider>} />
          <Route path="/campus/login" element={<CampusToastProvider><CampusLogin /></CampusToastProvider>} />
          <Route path="/campus/student" element={<CampusToastProvider><StudentDashboard /></CampusToastProvider>} />
          <Route path="/campus/recruiter" element={<CampusToastProvider><RecruiterView /></CampusToastProvider>} />
          {/* PC admin routes — RequireAuth bypasses in demo mode */}
          <Route path="/campus/setup" element={<CampusToastProvider><RequireAuth><CollegeSetupPage /></RequireAuth></CampusToastProvider>} />
          <Route path="/campus/pc" element={<CampusToastProvider><RequireAuth><PCDashboard /></RequireAuth></CampusToastProvider>} />
          <Route path="/campus/ingest" element={<CampusToastProvider><RequireAuth><BulkIngestPage /></RequireAuth></CampusToastProvider>} />
          <Route path="/campus/students" element={<CampusToastProvider><RequireAuth><StudentsListPage /></RequireAuth></CampusToastProvider>} />
          <Route path="/campus/drives" element={<CampusToastProvider><RequireAuth><DrivesListPage /></RequireAuth></CampusToastProvider>} />
          <Route path="/campus/drives/:driveId" element={<CampusToastProvider><RequireAuth><DriveDetailPage /></RequireAuth></CampusToastProvider>} />
          <Route path="/campus/chat" element={<CampusToastProvider><RequireAuth><CampusChatPage /></RequireAuth></CampusToastProvider>} />
          <Route path="/campus/audit" element={<CampusToastProvider><RequireAuth><AuditLogPage /></RequireAuth></CampusToastProvider>} />
        </Routes>
      </SpatialContent>
    </SessionContext.Provider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ModalProvider>
            <AppContent />
          </ModalProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
