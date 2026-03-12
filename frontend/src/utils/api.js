import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5 min — long processing
})

api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.detail || error.message || 'An error occurred'
    console.error('API Error:', message)
    return Promise.reject(error)
  }
)

// Demo mode
export const loadDemo = () => api.get('/demo')

// Upload endpoints
export const uploadJD = (formData) =>
  api.post('/upload/jd', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const uploadResumes = (formData) =>
  api.post('/upload/resumes', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

// Full analysis pipeline
export const analyzeResumes = (jdText, resumeTexts, weights) =>
  api.post('/analyze', {
    jd_text: jdText,
    resume_texts: resumeTexts,
    weights,
  })

// Session
export const getSession = (sessionId) => api.get(`/session/${sessionId}`)

// Recalculate with new weights (uses cached embeddings)
export const recalculateScores = (sessionId, weights) =>
  api.post(`/recalculate/${sessionId}`, weights)

// Export
export const exportPDF = (sessionId) =>
  api.get(`/export/pdf/${sessionId}`, { responseType: 'blob' })

export const exportCSV = (sessionId) =>
  api.get(`/export/csv/${sessionId}`, { responseType: 'blob' })

// Health check
export const healthCheck = () => api.get('/health')

export default api
