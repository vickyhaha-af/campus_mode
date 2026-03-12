import axios from 'axios'

const BASE = 'http://localhost:8000'

export const uploadResumes = (formData) =>
  axios.post(`${BASE}/upload/resumes`, formData)

export const uploadJD = (formData) =>
  axios.post(`${BASE}/upload/jd`, formData)

export const runScreening = (payload) =>
  axios.post(`${BASE}/screen`, payload)

export const getSession = (sessionId) =>
  axios.get(`${BASE}/session/${sessionId}`)
