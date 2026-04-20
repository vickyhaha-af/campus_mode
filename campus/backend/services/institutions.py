"""
Indian institution tier knowledge base.

Used to:
  (a) bias the resume-enricher LLM toward recognised institution names
  (b) post-process LLM output by filling in `institution_tier` deterministically
  (c) help the chat agent weight signals correctly (tier_1 CGPA variance
      behaves very differently from tier_3 CGPA variance)

Tiering is a pragmatic mix of perceived placement outcomes + academic rigour +
brand signal in the Indian market — not an endorsement of the institution's
quality as an educational experience. Edit freely if policy calls for it.
"""
from __future__ import annotations

import re
from typing import List, Literal, Optional

Tier = Literal["tier_1", "tier_2", "tier_3"]


# ---------------------------------------------------------------------------
# TIER 1 — IITs, top NITs, top IIMs, BITS, IISc, top IIITs, AIIMS, ISI, ISB,
# elite B-schools (XLRI, FMS, SPJIMR, JBIMS, MDI)
# ---------------------------------------------------------------------------

TIER_1: List[str] = [
    # IITs — all 23
    "IIT Bombay", "IIT Delhi", "IIT Madras", "IIT Kanpur", "IIT Kharagpur",
    "IIT Roorkee", "IIT Guwahati", "IIT Hyderabad", "IIT Indore", "IIT BHU",
    "IIT Varanasi", "IIT Dhanbad", "IIT ISM Dhanbad", "IIT Gandhinagar",
    "IIT Ropar", "IIT Patna", "IIT Bhubaneswar", "IIT Mandi", "IIT Jodhpur",
    "IIT Tirupati", "IIT Palakkad", "IIT Dharwad", "IIT Bhilai", "IIT Goa",
    "IIT Jammu",
    # Top NITs
    "NIT Trichy", "NIT Tiruchirappalli", "NIT Warangal", "NIT Surathkal",
    "NIT Karnataka", "NIT Calicut", "NIT Rourkela", "NIT Allahabad",
    "MNIT Allahabad", "MNNIT Allahabad", "NIT Nagpur", "VNIT Nagpur",
    "NIT Jaipur", "MNIT Jaipur", "NIT Durgapur", "NIT Kurukshetra",
    # Top IIMs (including IIM Ranchi per spec)
    "IIM Ahmedabad", "IIM Bangalore", "IIM Calcutta", "IIM Kolkata",
    "IIM Lucknow", "IIM Indore", "IIM Kozhikode", "IIM Ranchi",
    # BITS Pilani campuses
    "BITS Pilani", "BITS Goa", "BITS Hyderabad", "BITS Pilani Hyderabad",
    "BITS Pilani Goa",
    # Premier research / science institutions
    "IISc", "IISc Bangalore", "Indian Institute of Science",
    # Top IIITs
    "IIIT Hyderabad", "IIIT-H", "IIIT Delhi", "IIIT-D", "IIIT Bangalore",
    "IIIT-B",
    # Medical — AIIMS
    "AIIMS", "AIIMS Delhi", "All India Institute of Medical Sciences",
    # Statistics / research
    "ISI", "Indian Statistical Institute", "ISI Kolkata", "ISI Bangalore",
    # Top business schools
    "ISB", "ISB Hyderabad", "Indian School of Business",
    "XLRI", "XLRI Jamshedpur", "Xavier Labour Relations Institute",
    "FMS Delhi", "Faculty of Management Studies",
    "SPJIMR", "S.P. Jain Institute", "SP Jain",
    "JBIMS", "JBIMS Mumbai", "Jamnalal Bajaj Institute",
    "MDI Gurgaon", "MDI Gurugram", "Management Development Institute",
]


# ---------------------------------------------------------------------------
# TIER 2 — remaining IIMs, remaining NITs, reputed state/private engineering,
# next-tier B-schools
# ---------------------------------------------------------------------------

TIER_2: List[str] = [
    # Remaining IIMs
    "IIM Shillong", "IIM Raipur", "IIM Rohtak", "IIM Trichy",
    "IIM Tiruchirappalli", "IIM Udaipur", "IIM Kashipur", "IIM Nagpur",
    "IIM Visakhapatnam", "IIM Vizag", "IIM Amritsar", "IIM Bodh Gaya",
    "IIM Sambalpur", "IIM Sirmaur", "IIM Jammu", "IIM Mumbai",
    # Remaining NITs
    "NIT Silchar", "NIT Patna", "NIT Raipur", "NIT Jalandhar",
    "NIT Hamirpur", "NIT Srinagar", "NIT Goa", "NIT Puducherry",
    "NIT Manipur", "NIT Meghalaya", "NIT Mizoram", "NIT Nagaland",
    "NIT Sikkim", "NIT Agartala", "NIT Uttarakhand", "NIT Delhi",
    "NIT Andhra Pradesh", "NIT Arunachal Pradesh",
    # Delhi/Maharashtra state engineering flagships
    "DTU", "Delhi Technological University", "DCE",
    "NSUT", "Netaji Subhas University of Technology", "NSIT",
    "VJTI", "VJTI Mumbai", "Veermata Jijabai Technological Institute",
    "COEP", "COEP Pune", "College of Engineering Pune",
    "DAIICT", "Dhirubhai Ambani",
    # Reputed private universities
    "VIT Vellore", "VIT", "Vellore Institute of Technology",
    "Manipal", "Manipal Institute of Technology", "MIT Manipal",
    # Creative / communication B-schools
    "MICA", "MICA Ahmedabad", "Mudra Institute of Communications",
    "Great Lakes", "Great Lakes Chennai", "Great Lakes Gurgaon",
    "SCMHRD", "SCMHRD Pune", "Symbiosis Centre for Management",
    "IIFT", "IIFT Delhi", "Indian Institute of Foreign Trade",
    "IMT", "IMT Ghaziabad", "Institute of Management Technology",
    "IRMA", "IRMA Anand", "Institute of Rural Management",
    "XIMB", "XIM Bhubaneswar", "Xavier Institute of Management",
    "NMIMS", "NMIMS Mumbai", "Narsee Monjee Institute",
]


# ---------------------------------------------------------------------------
# TIER 3 — solid autonomous / state / reputed private universities that see
# consistent campus recruiting, but aren't in tier 1 or tier 2.
# ---------------------------------------------------------------------------

TIER_3: List[str] = [
    "Anna University", "CEG Anna", "MIT Anna",
    "JNTU", "JNTU Hyderabad", "JNTU Kakinada", "JNTU Anantapur",
    "Thapar", "Thapar Institute", "Thapar University",
    "Amity", "Amity University", "Amity Noida",
    "Chitkara", "Chitkara University",
    "LPU", "Lovely Professional University",
    "Symbiosis", "SIU", "Symbiosis Pune", "SIT Pune",
    "RVCE", "RV College of Engineering", "R.V. College",
    "PESIT", "PES University", "PES Bangalore",
    "BMSCE", "BMS College of Engineering",
    "MSRIT", "MS Ramaiah Institute of Technology",
    "SRM", "SRM University", "SRM Chennai", "SRMIST",
    "VIT Bhopal", "VIT AP", "VIT Chennai",
    "KIIT", "KIIT Bhubaneswar",
    "SASTRA", "SASTRA Thanjavur",
    "PSG", "PSG Tech", "PSG College of Technology",
    "SSN", "SSN College of Engineering",
    "Amrita", "Amrita Vishwa Vidyapeetham",
    "Jadavpur", "Jadavpur University",
    "Delhi University", "DU", "University of Delhi",
    "Mumbai University", "University of Mumbai",
    "BIT Mesra", "Birla Institute of Technology Mesra",
    "DIT", "Graphic Era", "UPES",
    "Bennett University", "Shiv Nadar", "Shiv Nadar University", "SNU",
    "Ashoka", "Ashoka University",
    "Christ University", "Christ Bangalore",
    "Loyola", "St. Stephen's", "Hansraj",
    "SRCC", "Shri Ram College of Commerce",
    "LSR", "Lady Shri Ram",
    "Miranda House",
]


# ---------------------------------------------------------------------------
# Classification / lookup
# ---------------------------------------------------------------------------

_PUNCT_RE = re.compile(r"[^a-z0-9]+")


def _normalise(name: str) -> str:
    return _PUNCT_RE.sub(" ", (name or "").lower()).strip()


def _keyword_set(name: str) -> set:
    norm = _normalise(name)
    return {w for w in norm.split() if len(w) >= 2}


# Acronym → expansion aliases used when the query uses the expanded form.
# e.g. "Indian Institute of Management Ranchi" should match "IIM Ranchi".
_ACRONYM_EXPANSIONS = {
    "iit": "indian institute of technology",
    "iim": "indian institute of management",
    "nit": "national institute of technology",
    "iiit": "indian institute of information technology",
    "iisc": "indian institute of science",
    "aiims": "all india institute of medical sciences",
    "isi": "indian statistical institute",
    "isb": "indian school of business",
    "bits": "birla institute of technology and science",
    "xlri": "xavier labour relations institute",
    "spjimr": "s p jain institute of management and research",
    "jbims": "jamnalal bajaj institute of management studies",
    "mdi": "management development institute",
    "vjti": "veermata jijabai technological institute",
    "coep": "college of engineering pune",
    "daiict": "dhirubhai ambani institute of information and communication technology",
    "vit": "vellore institute of technology",
    "mica": "mudra institute of communications ahmedabad",
    "scmhrd": "symbiosis centre for management and human resource development",
    "iift": "indian institute of foreign trade",
    "imt": "institute of management technology",
    "irma": "institute of rural management anand",
    "ximb": "xavier institute of management bhubaneswar",
    "nmims": "narsee monjee institute of management studies",
    "dtu": "delhi technological university",
    "nsut": "netaji subhas university of technology",
    "jntu": "jawaharlal nehru technological university",
    "lpu": "lovely professional university",
    "rvce": "r v college of engineering",
    "pes": "pes university",
    "srm": "sri ramaswamy memorial",
    "kiit": "kalinga institute of industrial technology",
    "sastra": "shanmugha arts science technology and research academy",
    "psg": "psg college of technology",
    "ssn": "sri sivasubramaniya nadar college of engineering",
}


def _expand_acronyms(tokens: set) -> set:
    """Return a superset of tokens that also includes the expansion words of
    any acronym present. So a resume saying 'IIM Ranchi' also matches
    'Indian Institute of Management Ranchi' and vice versa."""
    out = set(tokens)
    for t in list(tokens):
        expansion = _ACRONYM_EXPANSIONS.get(t)
        if expansion:
            out.update(expansion.split())
    # Reverse: if full phrase tokens are all present, add the acronym.
    for acr, phrase in _ACRONYM_EXPANSIONS.items():
        phrase_tokens = set(phrase.split())
        if phrase_tokens.issubset(tokens):
            out.add(acr)
    return out


# Pre-compute keyword sets for fast overlap-check. Known-institution tokens
# are expanded so acronym↔longform matching is symmetric.
_TIER_1_KEYSETS = [(_expand_acronyms(_keyword_set(n)), n) for n in TIER_1]
_TIER_2_KEYSETS = [(_expand_acronyms(_keyword_set(n)), n) for n in TIER_2]
_TIER_3_KEYSETS = [(_expand_acronyms(_keyword_set(n)), n) for n in TIER_3]


def classify(institution_name: str) -> Optional[Tier]:
    """Fuzzy-match an institution name to a tier.

    Strategy: normalise to lowercase + strip punctuation, then look for a known
    entry where every significant token of the known entry appears in the
    query. Tier 1 is checked first so "IIM Ahmedabad" doesn't accidentally
    route to tier 3 via a stray "university" token.

    Returns None if no known entry matches — the LLM's own guess (or null)
    should stand in that case.
    """
    if not institution_name or not institution_name.strip():
        return None

    query_tokens = _expand_acronyms(_keyword_set(institution_name))
    if not query_tokens:
        return None

    def _match(candidates: list) -> Optional[str]:
        best: Optional[str] = None
        best_score = 0
        for key_tokens, orig in candidates:
            # Significant tokens only (drop generic words so "university" alone
            # doesn't match everything).
            sig = key_tokens - _GENERIC_TOKENS
            if not sig:
                continue
            if sig.issubset(query_tokens):
                # Stronger matches (more distinctive tokens) win.
                score = len(sig)
                if score > best_score:
                    best_score = score
                    best = orig
        return best

    if _match(_TIER_1_KEYSETS):
        return "tier_1"
    if _match(_TIER_2_KEYSETS):
        return "tier_2"
    if _match(_TIER_3_KEYSETS):
        return "tier_3"
    return None


# Tokens that are too generic to carry matching weight on their own.
_GENERIC_TOKENS = {
    "of", "the", "and", "institute", "institution", "college", "university",
    "tech", "technology", "engineering", "science", "sciences", "school",
    "studies", "management", "business", "indian", "international", "national",
    "state", "deemed", "central",
}


def all_known_institutions() -> List[str]:
    """Flattened list of all known institution display-names.

    Used to bias the enricher LLM — we include a compacted, deduplicated
    sample in the prompt so the model prefers canonical names over
    abbreviations it invented.
    """
    seen = set()
    out: List[str] = []
    for name in TIER_1 + TIER_2 + TIER_3:
        key = _normalise(name)
        if key in seen:
            continue
        seen.add(key)
        out.append(name)
    return out
