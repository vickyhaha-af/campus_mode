import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, TrendingUp, Clock, AlertTriangle, Download, GitCompare } from 'lucide-react'
import SessionSummary from '../components/SessionSummary'
import WeightSliders from '../components/WeightSliders'
import ScoringTable from '../components/ScoringTable'
import BiasAuditPanel from '../components/BiasAuditPanel'
import JDQualityCard from '../components/JDQualityCard'
import SkillGapCard from '../components/SkillGapCard'
import ScoreDistribution from '../components/ScoreDistribution'
import CandidateComparison from '../components/CandidateComparison'
import ExportModal from '../components/ExportModal'
import DemoTour from '../components/DemoTour'
import { recalculateScores } from '../utils/api'
import { initShortcuts } from '../utils/shortcuts'

function DashboardPage({ sessionData, setSessionData }) {
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [comparisonCandidates, setComparisonCandidates] = useState([])
  const [showComparison, setShowComparison] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [activeTab, setActiveTab] = useState('scores')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const scores = sessionData?.scores || []

  const handleWeightChange = async (weights) => {
    try {
      const res = await recalculateScores(sessionData.session_id, weights)
      setSessionData(res.data)
    } catch (err) {
      console.error('Recalculation failed:', err)
    }
  }

  const toggleComparison = (candidate) => {
    setComparisonCandidates(prev => {
      const exists = prev.find(c => c.candidate_name === candidate.candidate_name)
      if (exists) return prev.filter(c => c.candidate_name !== candidate.candidate_name)
      if (prev.length >= 3) return prev
      return [...prev, candidate]
    })
  }

  // Keyboard navigation
  useEffect(() => {
    const cleanup = initShortcuts({
      navigate_up: () => setSelectedIndex(i => Math.max(0, i - 1)),
      navigate_down: () => setSelectedIndex(i => Math.min(scores.length - 1, i + 1)),
      export: () => setShowExport(true),
      compare: () => comparisonCandidates.length >= 2 && setShowComparison(true),
      close: () => { setShowExport(false); setShowComparison(false) },
    })
    return cleanup
  }, [scores.length, comparisonCandidates])

  useEffect(() => {
    if (scores[selectedIndex]) {
      setSelectedCandidate(scores[selectedIndex])
    }
  }, [selectedIndex, scores])

  return (
    <div className="page">
      <div className="container">
        {/* Demo Tour */}
        {sessionData?.is_demo && <DemoTour />}

        {/* Session Summary Stats */}
        <div id="tour-summary">
          <SessionSummary sessionData={sessionData} />
        </div>

        {/* Action Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}
        >
          <div className="tabs" id="tour-tabs">
            {[
              { id: 'scores', label: 'Candidates' },
              { id: 'bias', label: 'Bias Audit' },
              { id: 'distribution', label: 'Distribution' },
              { id: 'jd-quality', label: 'JD Quality' }
            ].map(tab => (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {comparisonCandidates.length >= 2 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowComparison(true)}
              >
                <GitCompare size={14} />
                Compare ({comparisonCandidates.length})
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowExport(true)}
              id="tour-export"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
          {/* Left: Main Panel */}
          <div>
            {activeTab === 'scores' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                id="tour-scores"
              >
                <ScoringTable
                  scores={scores}
                  selectedCandidate={selectedCandidate}
                  selectedIndex={selectedIndex}
                  onSelect={(c, i) => { setSelectedCandidate(c); setSelectedIndex(i) }}
                  comparisonCandidates={comparisonCandidates}
                  onToggleComparison={toggleComparison}
                />
              </motion.div>
            )}
            {activeTab === 'bias' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <BiasAuditPanel biasAudit={sessionData?.bias_audit} scores={scores} />
              </motion.div>
            )}
            {activeTab === 'distribution' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ScoreDistribution scores={scores} onSelectCandidate={(c, i) => { setSelectedCandidate(c); setSelectedIndex(i); setActiveTab('scores') }} />
              </motion.div>
            )}
            {activeTab === 'jd-quality' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <JDQualityCard jdQuality={sessionData?.jd_quality} jd={sessionData?.jd} />
              </motion.div>
            )}
          </div>

          {/* Right: Side Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Weight Sliders */}
            <div id="tour-weights">
              <WeightSliders
                weights={sessionData?.weights}
                onChange={handleWeightChange}
              />
            </div>

            {/* Skill Gap */}
            {selectedCandidate && (
              <motion.div
                key={selectedCandidate.candidate_name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                id="tour-skillgap"
              >
                <SkillGapCard candidate={selectedCandidate} />
              </motion.div>
            )}
          </div>
        </div>

        {/* Modals */}
        {showComparison && (
          <CandidateComparison
            candidates={comparisonCandidates}
            onClose={() => setShowComparison(false)}
          />
        )}
        {showExport && (
          <ExportModal
            sessionId={sessionData?.session_id}
            onClose={() => setShowExport(false)}
          />
        )}
      </div>
    </div>
  )
}

export default DashboardPage
