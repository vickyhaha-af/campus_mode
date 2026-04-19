/**
 * Campus API client — wraps /api/campus/* endpoints.
 * Shares auth token convention with parent via localStorage('techvista_token').
 */
import axios from 'axios'

const campus = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '/api') + '/campus',
  timeout: 120000,
})

campus.interceptors.request.use((config) => {
  const token = localStorage.getItem('techvista_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

campus.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'Request failed'
    console.error('[campus api]', msg)
    if (err.response?.status === 401) {
      localStorage.removeItem('techvista_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ---------- colleges ----------
export const createCollege = (payload) => campus.post('/colleges', payload)
export const listColleges = () => campus.get('/colleges')
export const getCollege = (id) => campus.get(`/colleges/${id}`)
export const updateCollege = (id, patch) => campus.patch(`/colleges/${id}`, patch)

// ---------- students ----------
export const listStudents = (filters = {}) => {
  const q = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => v !== undefined && v !== '' && q.append(k, v))
  return campus.get(`/students?${q.toString()}`)
}
export const getStudent = (id) => campus.get(`/students/${id}`)
export const updateStudent = (id, patch) => campus.patch(`/students/${id}`, patch)
export const createStudent = (payload) => campus.post('/students', payload)

// ---------- companies ----------
export const listCompanies = (college_id) =>
  campus.get('/companies' + (college_id ? `?college_id=${college_id}` : ''))
export const createCompany = (payload) => campus.post('/companies', payload)

// ---------- drives ----------
export const listDrives = (filters = {}) => {
  const q = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => v !== undefined && v !== '' && q.append(k, v))
  return campus.get(`/drives?${q.toString()}`)
}
export const getDrive = (id) => campus.get(`/drives/${id}`)
export const createDrive = (payload) => campus.post('/drives', payload)
export const updateDrive = (id, patch) => campus.patch(`/drives/${id}`, patch)

// ---------- ingest ----------
export const startIngest = (college_id, files) => {
  const fd = new FormData()
  fd.append('college_id', college_id)
  files.forEach((f) => fd.append('files', f))
  return campus.post('/ingest', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const pollIngest = (job_id) => campus.get(`/ingest/${job_id}`)

// ---------- demo ----------
export const loadDemo = () => campus.get('/demo')

// ---------- shortlists ----------
export const listShortlists = (drive_id) => campus.get(`/shortlists?drive_id=${drive_id}`)
export const bulkShortlist = (drive_id, student_ids) =>
  campus.post('/shortlists/bulk', { drive_id, student_ids })
export const changeShortlistStage = (shortlist_id, stage) =>
  campus.post(`/shortlists/${shortlist_id}/stage`, { stage })
export const removeShortlist = (shortlist_id) => campus.delete(`/shortlists/${shortlist_id}`)

// ---------- chat ----------
export const createChatSession = (college_id, context_drive_id = null) =>
  campus.post('/chat/session', { college_id, context_drive_id })

export const getChatSession = (session_id) =>
  campus.get(`/chat/session/${session_id}`)

/**
 * Stream chat events via fetch + ReadableStream.
 * Calls onEvent({type, ...}) for each SSE event; onEvent gets "done" at the end.
 * Returns an AbortController so caller can cancel.
 */
export function streamChat({ session_id, message, college_id, drive_context_id }, onEvent) {
  const controller = new AbortController()
  const base = (import.meta.env.VITE_API_URL || '/api') + '/campus'
  const token = localStorage.getItem('techvista_token')
  ;(async () => {
    try {
      const res = await fetch(`${base}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ session_id, message, college_id, drive_context_id }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        onEvent({ type: 'error', message: `HTTP ${res.status}` })
        return
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() || ''
        for (const part of parts) {
          const line = part.split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          try { onEvent(JSON.parse(line.slice(6))) }
          catch (e) { console.warn('SSE parse fail', line, e) }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') onEvent({ type: 'error', message: e.message })
    }
  })()
  return controller
}

export default campus
