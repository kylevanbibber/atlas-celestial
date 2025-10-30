# State Licensing Requirements - Quick Reference

## Overview

This document provides a summary of state-specific licensing requirements based on the official state data. These requirements have been translated into the pipeline state requirements system.

## Quick Stats

- **Total States**: 51 (50 states + DC)
- **Background Check Variations**: 47 states with specific requirements
- **Exam Vendors**: 3 main vendors (Pearson VUE, PSI, Prometric) + D&S for Louisiana
- **Pre-Licensing**: Required in most states, recommended in 25 states

## Background Check Requirements by Type

### 🔒 States with Fingerprinting (43 states)
- **Standard Fingerprinting**: AK, AZ, CO, FL, GA, KY, NE, ND, OH, TX
- **IdentGo/IDEMIA**: AZ, CT, FL, NJ, NM, WA
- **Live Scan**: CA (California-specific)
- **Fieldprint**: HI, VA, WI
- **At Test Center**: MD (Prometric), UT (Prometric)
- **State & FBI Background**: CT (via IdentGo)
- **Criminal Records Check**: SC (via Prometric)
- **BCI (Background Check Investigation)**: RI (via Prometric)
- **After Obtaining License**: PA, WV

### ✅ States with NO Background Check Required (4 states)
- Indiana (IN)
- Kansas (KS) - *Effective 06/01/2025, fingerprints will be required*
- Maine (ME)
- Michigan (MI)

### ⚠️ States with Special Requirements
- **Georgia**: Submit criminal background report (IdentGo) before license
- **Pennsylvania**: Fingerprints required after obtaining license
- **West Virginia**: Fingerprints within 15 days of obtaining license (TCN)

## Exam Vendors by State

### Pearson VUE (Default - 32 states)
AL, AK, AR, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, MN, MT, NC, PA, SC, SD, TN, TX, WI, WV, WY

### PSI (14 states)
CA, MA, MI, NE, NH, NJ, NM, NY, ND, OH, OK, OR, WA

**Note**: PSI requires scheduling through their portal at `https://candidate.psiexams.com/` or state-specific links.

### Prometric (5 states)
ME, MD, UT, VT, VA

**Special Features**:
- **Maryland**: Fingerprints collected at Prometric test center during exam
- **Utah**: Pay fingerprint fee at Prometric test center
- **Virginia**: Requires Fieldprint fingerprints (if Prometric used)

### D&S Diversified Services (1 state)
LA (Louisiana) - Uses OD License Exam portal

## Pre-Licensing Requirements

### Required (26 states + DC)
States where pre-licensing course is **mandatory** before taking the exam:
AL, AK, AR, CA, CO, CT, DE, DC, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, MN, MT, NC, PA, TX, WI, WV, WY

### Recommended but Not Required (25 states)
States where pre-licensing is **optional** but recommended:
AZ, MS, MO, NE, NV, NH, NJ, NM, NY, ND, OH, OK, OR, RI, SC, SD, TN, UT, VT, VA, WA, ME, MD, MA, MI

## Timeline Considerations

### Complete All Steps Before Applying for License (NIPR)
Most states require completing **all licensing steps** before submitting NIPR application:
- Pre-licensing course (if required)
- Pass exam
- Background check/fingerprints
- **Then** apply for license

### Apply for License After Fingerprints (3 states)
These states specifically require fingerprints **before** license application:
- **Georgia**: Submit fingerprints (IdentGo) before applying
- **Iowa**: Complete fingerprints before NIPR application
- **Pennsylvania**: Fingerprints required after obtaining license (reversed order)

### Apply for License Before/After Exam
Most states allow license application after passing the exam, but some have specific timing:
- **Standard**: Pass exam → Apply for license → Complete remaining steps
- **After Steps**: Complete all requirements → Then apply

## State-Specific Special Cases

### California (CA)
- ✅ Exam: PSI
- ✅ Background: Live Scan fingerprinting (certified provider only)
- ✅ Pre-Licensing: Required
- 📝 Special: Must use CA-specific Live Scan providers

### Florida (FL)
- ✅ Exam: Pearson VUE
- ✅ Background: Fingerprinting via IdentGo/FDLE
- ✅ Pre-Licensing: Required
- ⏱️ Timeline: 15-20 business days for approval

### Louisiana (LA)
- ✅ Exam: D&S Diversified Services (unique vendor)
- ✅ Background: Fingerprinting (KIOSK, ID card, or paper process)
- ✅ Pre-Licensing: Required
- 📝 Special: Uses different exam vendor than most states

### Maryland (MD)
- ✅ Exam: Prometric
- ✅ Background: Fingerprints collected **at Prometric test center**
- ✅ Pre-Licensing: Recommended
- 📝 Special: Fingerprints done during exam appointment

### New York (NY)
- ✅ Exam: PSI
- ✅ Background: Not listed by KCDL
- ✅ Pre-Licensing: Recommended
- 📝 Special: Additional suitability course may be required (see state requirements)

### Ohio (OH)
- ✅ Exam: PSI
- ✅ Background: Fingerprints required
- ✅ Pre-Licensing: Recommended
- 📝 Special: May require additional ethics course (see state requirements)

### Pennsylvania (PA)
- ✅ Exam: Pearson VUE
- ✅ Background: Fingerprints **after** obtaining license
- ✅ Pre-Licensing: Required
- 📝 Special: Reversed timeline - get license first, then fingerprints

### Texas (TX)
- ✅ Exam: Pearson VUE
- ✅ Background: Fingerprints before license issuance
- ✅ Pre-Licensing: Required
- ⏱️ Timeline: 10-15 business days for approval via TDI

### Utah (UT)
- ✅ Exam: Prometric
- ✅ Background: Fingerprints at Prometric test center (pay fee)
- ✅ Pre-Licensing: Recommended
- 📝 Special: BCI fingerprints with fee at test center

## How This Data is Used

### In the Pipeline System

1. **Background Check Step**: Automatically shows state-specific instructions
   - "California requires Live Scan fingerprinting"
   - "Maryland: Fingerprints collected at Prometric test center"

2. **Schedule Test Step**: Shows correct vendor and link
   - PSI states → PSI portal link
   - Prometric states → Prometric portal link

3. **Pre-Licensing Step**: Marked as required or recommended
   - Required states: Red asterisk (*)
   - Recommended states: No asterisk, marked optional

4. **Visual Indicators**:
   - 🔵 Blue state badges for state-specific items
   - 🟠 Orange "Modified" badges for changed requirements

## Database Integration

All this data has been loaded into `pipeline_state_requirements` table via:
```sql
SOURCE atlas/database/seed_state_requirements_from_data.sql;
```

**View all state requirements**:
```sql
SELECT 
  state,
  stage_name,
  action,
  COALESCE(item_name, target_item_name) as item,
  LEFT(COALESCE(override_description, notes), 60) as description
FROM pipeline_state_requirements
WHERE active = 1
ORDER BY state, stage_name;
```

## Updating State Requirements

If state requirements change:

1. **Modify existing requirement**:
```sql
UPDATE pipeline_state_requirements 
SET override_description = 'New description here',
    updated_at = NOW()
WHERE state = 'CA' AND target_item_name = 'Background Check';
```

2. **Add new state requirement**:
```sql
INSERT INTO pipeline_state_requirements (state, stage_name, action, ...) 
VALUES ('CA', 'Licensing', 'add', ...);
```

3. **Deactivate outdated requirement**:
```sql
UPDATE pipeline_state_requirements 
SET active = 0 
WHERE id = [requirement_id];
```

## Sources

Data compiled from:
- Official state insurance department websites
- Exam vendor portals (Pearson VUE, PSI, Prometric, D&S)
- NIPR (National Insurance Producer Registry)
- State licensing spreadsheet (provided by user)

## Support

For questions about specific state requirements:
1. Check the state's insurance department website
2. Review the exam vendor portal for that state
3. Consult the pipeline checklist for real-time state-specific instructions

---

**Last Updated**: Based on state licensing data spreadsheet
**Total States Covered**: 51 (50 states + DC)
**Total Requirements**: 100+ state-specific modifications

