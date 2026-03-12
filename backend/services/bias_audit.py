"""
Bias audit service — statistical testing for scoring fairness.
Uses t-test (institution_tier) and ANOVA (experience_cohort) per spec.
Applies Bonferroni correction when testing multiple categories.
"""
import numpy as np
from scipy import stats
from models.schemas import BiasAuditResult, BiasTestDetail, CandidateScore
from config import BIAS_P_VALUE_THRESHOLD


def _cohens_d(g1, g2):
    n1, n2 = len(g1), len(g2)
    if n1 < 2 or n2 < 2:
        return 0.0
    v1, v2 = np.var(g1, ddof=1), np.var(g2, ddof=1)
    ps = np.sqrt(((n1-1)*v1 + (n2-1)*v2) / (n1+n2-2))
    return 0.0 if ps == 0 else abs(float(np.mean(g1) - np.mean(g2))) / float(ps)


def _test_institution_tier(scores, adjusted_threshold):
    """Binary t-test: tier-1 vs non-tier-1"""
    tier1 = [s.composite_score for s in scores if s.institution_tier == "tier_1"]
    non_tier1 = [s.composite_score for s in scores if s.institution_tier != "tier_1"]

    if len(tier1) < 3 or len(non_tier1) < 3:
        return None

    try:
        stat, p = stats.ttest_ind(tier1, non_tier1, equal_var=False)
    except Exception:
        return None

    d = _cohens_d(tier1, non_tier1)
    return BiasTestDetail(
        test_used="t-test",
        p_value=round(float(p), 4),
        effect_size=round(d, 4),
        bias_detected=p < adjusted_threshold,
        group_averages={
            "Tier 1": round(float(np.mean(tier1)), 1),
            "Non-Tier 1": round(float(np.mean(non_tier1)), 1),
        },
    )


def _test_experience_cohort(scores, adjusted_threshold):
    """Multi-group ANOVA: fresher / mid / senior / lead"""
    groups: dict[str, list[float]] = {}
    for s in scores:
        groups.setdefault(s.experience_cohort, []).append(s.composite_score)

    valid = {k: v for k, v in groups.items() if len(v) >= 3}
    if len(valid) < 2:
        return None

    try:
        stat, p = stats.f_oneway(*valid.values())
    except Exception:
        return None

    # Eta-squared effect size
    n = sum(len(g) for g in valid.values())
    k = len(valid)
    eta2 = max(0.0, (float(stat) - k + 1) / (n - k)) if n > k else 0.0

    return BiasTestDetail(
        test_used="ANOVA",
        p_value=round(float(p), 4),
        effect_size=round(eta2, 4),
        bias_detected=p < adjusted_threshold,
        group_averages={
            k.replace("_", " ").title(): round(float(np.mean(v)), 1)
            for k, v in valid.items()
        },
    )


def normalize_scores_by_category(scores, cat_fn):
    """Z-score normalisation within groups, re-scaled to 0-100."""
    groups: dict[str, list[CandidateScore]] = {}
    for s in scores:
        groups.setdefault(cat_fn(s), []).append(s)

    for _, gs in groups.items():
        vals = [s.composite_score for s in gs]
        if len(vals) < 2:
            for s in gs:
                s.normalized_score = s.composite_score
            continue
        mu, sig = float(np.mean(vals)), float(np.std(vals, ddof=1))
        if sig == 0:
            for s in gs:
                s.normalized_score = s.composite_score
        else:
            for s in gs:
                z = (s.composite_score - mu) / sig
                s.normalized_score = round(max(0, min(100, (z + 3) / 6 * 100)), 2)
                s.adjusted = True
                s.bias_flag = True

    return scores


def run_bias_audit(scores: list[CandidateScore]) -> BiasAuditResult:
    """Run statistical bias tests with Bonferroni correction."""
    details: dict[str, dict] = {}
    flags = 0
    norm = False

    # Number of categories being tested (for Bonferroni correction)
    num_categories = 2
    adjusted_threshold = BIAS_P_VALUE_THRESHOLD / num_categories

    # Test 1: Institution tier (t-test)
    tier_result = _test_institution_tier(scores, adjusted_threshold)
    if tier_result:
        details["institution_tier"] = tier_result.model_dump()
        if tier_result.bias_detected:
            flags += 1
            scores = normalize_scores_by_category(
                scores,
                lambda s: "tier_1" if s.institution_tier == "tier_1" else "non_tier_1"
            )
            details["institution_tier"]["normalization_applied"] = True
            norm = True

    # Test 2: Experience cohort (ANOVA)
    exp_result = _test_experience_cohort(scores, adjusted_threshold)
    if exp_result:
        details["experience_cohort"] = exp_result.model_dump()
        if exp_result.bias_detected and not norm:
            flags += 1
            scores = normalize_scores_by_category(
                scores,
                lambda s: s.experience_cohort
            )
            details["experience_cohort"]["normalization_applied"] = True
            norm = True

    return BiasAuditResult(
        overall_status="Flagged" if flags > 0 else "Pass",
        flags_detected=flags,
        tests_run=len(details),
        details=details,
        normalization_applied=norm,
    )
