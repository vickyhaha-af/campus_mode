import React, { useState, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import UploadPage from './views/UploadPage'
import ProcessingPage from './views/ProcessingPage'
import ResultsPage from './views/ResultsPage'
import ExportPage from './views/ExportPage'
import LandingPage from './views/LandingPage'
import { ToastProvider } from './components/Toast'
import { ModalProvider, SpatialContent } from './components/ModalContext'

// Global session context
const SessionContext = createContext(null)

export function useSession() {
  return useContext(SessionContext)
}

function AppContent() {
  const [sessionData, setSessionData] = useState(null)
  const [currentStep, setCurrentStep] = useState(0) // 0 = landing, 1-4 = steps
  const navigate = useNavigate()

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
      goToProcessing, goToResults, goToExport, startNew, goHome
    }}>
      <SpatialContent>
        {currentStep > 0 && <Navbar currentStep={currentStep} />}
        <div className={currentStep > 0 ? 'main-content' : ''}>
          <Routes>
            <Route path="/" element={<LandingPage onStart={startScreening} />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/processing" element={<ProcessingPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </div>
      </SpatialContent>
    </SessionContext.Provider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ModalProvider>
          <AppContent />
        </ModalProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
