import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  GraduationCap, Mail, Phone, Search, Sparkles, Target,
  Briefcase, MapPin, DollarSign, Calendar, ArrowRight,
  TrendingUp, Award, Heart, Info,
} from 'lucide-react'
import CampusNav from '../components/CampusNav'
import { listStudents, listDrives, listShortlistsByStudent } from '../api'


const STAGE_GROUPS = [
  { key: 'shortlisted', label: 'Shortlisted', stages: ['shortlisted'] },
  { key: 'interviews',  label: 'Interviews',  stages: ['interview_1', 'interview_2', 'interview_3'] },
  { key: 'offered',     label: 'Offered',     stages: ['offered'] },
  { key: 'accepted',    label: 'Accepted',    stages: ['accepted'] },
  { key: 'joined',      label: 'Joined',      stages: ['joined'] },
]


function isEligible(student, drive) {
  const r = drive?.eligibility_rules || {}
  if (r.min_cgpa != null && (student.cgpa ?? 0) < r.min_cgpa) return false
  if (r.max_active_backlogs != null && (student.backlogs_active ?? 0) > r.max_active_backlogs) return false
  if (r.allowed_branches?.length && student.branch && !r.allowed_branches.map(b => b.toLowerCase()).includes(student.branch.toLowerCase())) return false
  if (r.allowed_years?.length && student.year && !r.allowed_years.includes(student.year)) return false
  return true
}


export default function StudentDashboard() {
  const [emailInput, setEmailInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [student, setStudent] = useState(null)
  const [drives, setDrives] = useState([])
  const [shortlists, setShortlists] = useState([])
  const [hasLoaded, setHasLoaded] = useState(false)

  const collegeId = typeof window !== 'undefined'
    ? localStorage.getItem('campus_college_id') : null
  const isDemo = typeof window !== 'undefined'
    && localStorage.getItem('campus_demo_mode') === '1'

  const load = async (e) => {
    e?.preventDefault()
    if (!emailInput.trim()) return
    if (!collegeId) {
      setErr('No college context found. Open from the Campus landing page first.')
      return
    }
    setErr(''); setLoading(true)
    try {
      const { data: students } = await listStudents({ college_id: collegeId })
      const query = emailInput.trim().toLowerCase()
      const found = (students || []).find(s =>
        (s.email || '').toLowerCase() === query
        || (s.email || '').toLowerCase().includes(query)
      )
      if (!found) {
        setStudent(null); setDrives([]); setShortlists([])
        setErr(`No student found matching "${emailInput}". Try a full or partial email.`)
        setHasLoaded(true)
        return
      }
      setStudent(found)
      // Parallel fetch of drives + shortlists
      const [drivesRes, slRes] = await Promise.all([
        listDrives({ college_id: collegeId }),
        listShortlistsByStudent(found.id).catch(() => ({ data: [] })),
      ])
      setDrives(drivesRes.data || [])
      setShortlists(slRes.data || [])
      setHasLoaded(true)
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  const eligibleDrives = useMemo(
    () => student ? drives.filter(d => isEligible(student, d)) : [],
    [student, drives],
  )

  const shortlistsByGroup = useMemo(() => {
    const bucket = Object.fromEntries(STAGE_GROUPS.map(g => [g.key, []]))
    for (const s of shortlists) {
      const g = STAGE_GROUPS.find(gr => gr.stages.includes(s.stage))
      if (g) bucket[g.key].push(s)
    }
    return bucket
  }, [shortlists])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <CampusNav />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 80px' }}>
        {isDemo && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'var(--gradient-sage-card)',
              border: '1px solid rgba(74,124,111,0.2)',
              borderRadius: 10, padding: '10px 14px',
              color: 'var(--sage-dim)', fontSize: 13,
              marginBottom: 18,
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <Info size={14} />
            You&apos;re viewing a demo student dashboard — try: <code style={{ background: 'rgba(255,255,255,0.6)', padding: '1px 6px', borderRadius: 6 }}>aarav.mehta@demo.edu</code>
          </motion.div>
        )}

        {!student && (
          <LookupForm
            emailInput={emailInput}
            setEmailInput={setEmailInput}
            onSubmit={load}
            loading={loading}
            err={err}
            hasLoaded={hasLoaded}
          />
        )}

        {student && (
          <>
            <HeroSection student={student} onReset={() => {
              setStudent(null); setEmailInput(''); setErr(''); setHasLoaded(false)
              setShortlists([]); setDrives([])
            }} />

            <ProfileCard student={student} />

            <DrivesSection drives={eligibleDrives} totalCount={drives.length} />

            <ShortlistsSection grouped={shortlistsByGroup} count={shortlists.length} />
          </>
        )}
      </div>
    </div>
  )
}


function LookupForm({ emailInput, setEmailInput, onSubmit, loading, err, hasLoaded }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 36,
        maxWidth: 520, margin: '48px auto 0',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: 'var(--gradient-sage-card)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
      }}>
        <GraduationCap size={20} color="var(--sage)" />
      </div>
      <h1 className="text-display" style={{ fontSize: 26, marginBottom: 8 }}>
        Find your dashboard
      </h1>
      <p className="text-body" style={{ color: 'var(--slate)', marginBottom: 22, fontSize: 14.5 }}>
        Enter the email you registered with your placement cell. We&apos;ll pull your profile,
        eligible drives, and shortlist status.
      </p>
      <form onSubmit={onSubmit}>
        <label style={{
          display: 'block', fontSize: 12, fontWeight: 600,
          color: 'var(--slate-mid)', marginBottom: 6, letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}>Your email</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--slate-mid)',
            }} />
            <input
              type="text"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@college.edu"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px 10px 36px',
                fontSize: 14.5,
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'var(--cream)',
                color: 'var(--ink)',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !emailInput.trim()}
          >
            {loading ? 'Looking up…' : 'Find me'}
          </button>
        </div>
        {err && hasLoaded && (
          <div style={{
            marginTop: 14, padding: '10px 12px',
            background: 'var(--blush-pale)', color: 'var(--blush)',
            border: '1px solid rgba(196,117,106,0.25)',
            borderRadius: 10, fontSize: 13,
          }}>{err}</div>
        )}
      </form>
      <div style={{ marginTop: 20, fontSize: 12, color: 'var(--slate-mid)' }}>
        Student auth isn&apos;t live yet — your PC admin seeded your profile when they ran ingest.
      </div>
    </motion.div>
  )
}


function HeroSection({ student, onReset }) {
  const prof = student.profile_enriched || {}
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ marginBottom: 24 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button className="btn-ghost btn-sm" onClick={onReset}>
          ← Switch student
        </button>
      </div>
      <h1 className="text-display-lg" style={{ marginBottom: 6 }}>
        {student.name}
      </h1>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8,
        alignItems: 'center', marginBottom: 14,
      }}>
        {student.branch && <span className="chip cool">{student.branch}</span>}
        {student.year && <span className="chip neutral">Year {student.year}</span>}
        {student.cgpa != null && <span className="chip warm">CGPA {student.cgpa}</span>}
        {student.backlogs_active > 0 && (
          <span className="chip" style={{
            background: 'var(--blush-pale)', color: 'var(--blush)',
            border: '1px solid rgba(196,117,106,0.3)',
          }}>{student.backlogs_active} active backlog{student.backlogs_active > 1 ? 's' : ''}</span>
        )}
      </div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16,
        fontSize: 13.5, color: 'var(--slate)', marginBottom: prof.summary ? 18 : 0,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Mail size={13} color="var(--slate-mid)" />{student.email}
        </span>
        {student.phone && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Phone size={13} color="var(--slate-mid)" />{student.phone}
          </span>
        )}
        {student.current_city && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={13} color="var(--slate-mid)" />{student.current_city}
          </span>
        )}
      </div>
      {prof.summary && (
        <p style={{
          fontSize: 14.5, color: 'var(--slate)', lineHeight: 1.6,
          maxWidth: 760, fontStyle: 'italic',
        }}>
          {prof.summary}
        </p>
      )}
    </motion.div>
  )
}


function SectionCard({ icon: Icon, title, subtitle, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.35 }}
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 14, padding: 24,
        marginBottom: 16,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <h3 style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
          color: 'var(--ink)', letterSpacing: '-0.015em',
        }}>
          {Icon && <Icon size={17} color="var(--sage)" />}
          {title}
        </h3>
        {subtitle && <span style={{ fontSize: 12.5, color: 'var(--slate-mid)' }}>{subtitle}</span>}
      </div>
      {children}
    </motion.div>
  )
}


function ProfileCard({ student }) {
  const prof = student.profile_enriched || {}
  const skills = prof.skills || []
  const achievements = (prof.achievements || []).slice(0, 3)
  const passions = prof.passions || []
  const rf = prof.role_fit_signals || {}
  const topFits = Object.entries(rf)
    .filter(([k, v]) => typeof v === 'number')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return (
    <SectionCard icon={Sparkles} title="Your profile">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        <div>
          <Eyebrow>Skills</Eyebrow>
          {skills.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {skills.slice(0, 14).map((s, i) => (
                <span key={i} className="chip neutral" style={{ fontSize: 12 }}>{s}</span>
              ))}
            </div>
          ) : <Empty>Not extracted yet.</Empty>}
        </div>

        <div>
          <Eyebrow><Award size={11} /> Top achievements</Eyebrow>
          {achievements.length ? (
            <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--slate)', fontSize: 13.5, lineHeight: 1.6 }}>
              {achievements.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          ) : <Empty>None listed.</Empty>}
        </div>

        <div>
          <Eyebrow><Heart size={11} /> Passions</Eyebrow>
          {passions.length ? (
            <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--slate)', fontSize: 13.5, lineHeight: 1.6 }}>
              {passions.slice(0, 5).map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          ) : <Empty>None listed.</Empty>}
        </div>
      </div>

      {topFits.length > 0 && (
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <Eyebrow><TrendingUp size={11} /> Top role fits</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topFits.map(([label, score]) => (
              <FitBar key={label} label={label} score={score} />
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  )
}


function FitBar({ label, score }) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100)
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 13, marginBottom: 4,
      }}>
        <span style={{ color: 'var(--ink)', fontWeight: 500, textTransform: 'capitalize' }}>
          {label.replace(/_/g, ' ')}
        </span>
        <span style={{
          color: 'var(--sage-dim)', fontFamily: 'var(--font-mono)',
          fontSize: 12, fontWeight: 600,
        }}>{pct}%</span>
      </div>
      <div style={{
        height: 6, background: 'var(--cream-mid)',
        borderRadius: 3, overflow: 'hidden',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            height: '100%',
            background: 'var(--gradient-accent)',
          }}
        />
      </div>
    </div>
  )
}


function DrivesSection({ drives, totalCount }) {
  return (
    <SectionCard
      icon={Briefcase}
      title="Eligible drives"
      subtitle={`${drives.length} of ${totalCount} match your profile`}
    >
      {drives.length === 0 ? (
        <Empty>
          No drives currently match your eligibility. New drives open often —
          check back soon, or talk to your PC admin about preferences.
        </Empty>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
        }}>
          {drives.map(d => <DriveCard key={d.id} drive={d} />)}
        </div>
      )}
    </SectionCard>
  )
}


function DriveCard({ drive }) {
  const company = drive.company?.name || ''
  return (
    <Link to={`/campus/drives/${drive.id}`} style={{ textDecoration: 'none' }}>
      <motion.div
        whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}
        transition={{ duration: 0.18 }}
        style={{
          padding: 16,
          background: 'var(--cream)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          cursor: 'pointer',
          height: '100%',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}
      >
        <div style={{
          fontSize: 11, color: 'var(--slate-mid)', fontWeight: 600,
          letterSpacing: 0.4, textTransform: 'uppercase',
        }}>{company || 'Company'}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{drive.role}</div>
        <div style={{ fontSize: 12.5, color: 'var(--slate)', display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
          {drive.location && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={11} color="var(--slate-mid)" />{drive.location}
            </span>
          )}
          {drive.ctc_offered && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <DollarSign size={11} color="var(--slate-mid)" />
              {typeof drive.ctc_offered === 'number' ? `₹${(drive.ctc_offered / 100000).toFixed(1)}L` : drive.ctc_offered}
            </span>
          )}
          {drive.scheduled_date && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={11} color="var(--slate-mid)" />{drive.scheduled_date}
            </span>
          )}
        </div>
        <div style={{
          marginTop: 'auto', paddingTop: 8, fontSize: 12,
          color: 'var(--sage-dim)', fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          View drive <ArrowRight size={11} />
        </div>
      </motion.div>
    </Link>
  )
}


function ShortlistsSection({ grouped, count }) {
  return (
    <SectionCard icon={Target} title="Your shortlists" subtitle={`${count} total`}>
      {count === 0 ? (
        <Empty>
          You haven&apos;t been shortlisted yet. Your placement cell reviews profiles
          drive-by-drive — keep your skills + projects current and good things follow.
        </Empty>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 10,
          overflowX: 'auto',
        }}>
          {STAGE_GROUPS.map(g => (
            <StageColumn key={g.key} label={g.label} items={grouped[g.key]} />
          ))}
        </div>
      )}
    </SectionCard>
  )
}


function StageColumn({ label, items }) {
  return (
    <div style={{
      background: 'var(--cream)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: 10, minHeight: 120,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700,
        letterSpacing: 0.6, textTransform: 'uppercase',
        color: 'var(--slate-mid)',
        marginBottom: 8, display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{label}</span>
        <span style={{ color: items.length ? 'var(--sage-dim)' : 'var(--slate-light, var(--slate-mid))' }}>
          {items.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(s => (
          <Link
            key={s.id}
            to={`/campus/drives/${s.drive_id}`}
            style={{
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              color: 'var(--ink)',
              textDecoration: 'none',
              display: 'block',
            }}
          >
            {s.drive_id?.slice(0, 8) || 'drive'}
            {s.fit_score != null && (
              <div style={{
                fontSize: 10.5, color: 'var(--sage-dim)', marginTop: 2,
                fontFamily: 'var(--font-mono)',
              }}>
                fit {Math.round(s.fit_score * (s.fit_score > 1 ? 1 : 100))}
              </div>
            )}
          </Link>
        ))}
        {items.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--slate-mid)', fontStyle: 'italic', padding: '2px 2px' }}>—</div>
        )}
      </div>
    </div>
  )
}


function Eyebrow({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700,
      letterSpacing: 0.6, textTransform: 'uppercase',
      color: 'var(--slate-mid)', marginBottom: 8,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>{children}</div>
  )
}


function Empty({ children }) {
  return (
    <p style={{
      fontSize: 13, color: 'var(--slate-mid)',
      fontStyle: 'italic', lineHeight: 1.55, margin: 0,
    }}>{children}</p>
  )
}
