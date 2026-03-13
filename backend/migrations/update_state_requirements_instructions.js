/**
 * Migration: Update pipeline_state_requirements with detailed instructions
 *
 * Populates the `instructions` and `url` fields for all 97 active rows
 * in the pipeline_state_requirements table with state-specific licensing
 * guidance for new recruits.
 *
 * Run: node migrations/update_state_requirements_instructions.js
 */

const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: '107.180.115.113',
  user: 'kvanbibber',
  password: 'Atlas2024!',
  database: 'atlas'
};

// State code -> full name mapping
const STATE_NAMES = {
  AK: 'Alaska', AL: 'Alabama', AR: 'Arkansas', AZ: 'Arizona',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DC: 'District of Columbia',
  DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii',
  IA: 'Iowa', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', MA: 'Massachusetts',
  MD: 'Maryland', ME: 'Maine', MI: 'Michigan', MN: 'Minnesota',
  MO: 'Missouri', MS: 'Mississippi', MT: 'Montana', NC: 'North Carolina',
  ND: 'North Dakota', NE: 'Nebraska', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NV: 'Nevada', NY: 'New York', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VA: 'Virginia', VT: 'Vermont', WA: 'Washington',
  WI: 'Wisconsin', WV: 'West Virginia', WY: 'Wyoming'
};

// State code -> XCEL URL slug
const STATE_SLUGS = {
  AK: 'alaska', AL: 'alabama', AR: 'arkansas', AZ: 'arizona',
  CA: 'california', CO: 'colorado', CT: 'connecticut', DC: 'district-of-columbia',
  DE: 'delaware', FL: 'florida', GA: 'georgia', HI: 'hawaii',
  IA: 'iowa', ID: 'idaho', IL: 'illinois', IN: 'indiana',
  KS: 'kansas', KY: 'kentucky', LA: 'louisiana', MA: 'massachusetts',
  MD: 'maryland', ME: 'maine', MI: 'michigan', MN: 'minnesota',
  MO: 'missouri', MS: 'mississippi', MT: 'montana', NC: 'north-carolina',
  ND: 'north-dakota', NE: 'nebraska', NH: 'new-hampshire', NJ: 'new-jersey',
  NM: 'new-mexico', NV: 'nevada', NY: 'new-york', OH: 'ohio',
  OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhode-island',
  SC: 'south-carolina', SD: 'south-dakota', TN: 'tennessee', TX: 'texas',
  UT: 'utah', VA: 'virginia', VT: 'vermont', WA: 'washington',
  WI: 'wisconsin', WV: 'west-virginia', WY: 'wyoming'
};

// ─── FINGERPRINT / BACKGROUND CHECK DATA ────────────────────────────────────

const FINGERPRINT_DATA = {
  AK: {
    vendor: 'an approved fingerprint vendor',
    url: 'https://dps.alaska.gov/statewide/r-i/background/fingerprinters',
    fee: '$48.25',
    notes: 'All fingerprints must be submitted on a standard FD-258 FBI fingerprint card. You can download the form here:\nhttps://www.fbi.gov/file-repository/standard-fingerprint-form-fd-258-1.pdf\n\nAttach the completed fingerprint card and fee with your license application.'
  },
  AL: {
    vendor: 'Fieldprint',
    url: 'https://www.fieldprint.com/',
    fee: null,
    notes: 'When scheduling, select "Alabama Department of Insurance" as the agency. You will receive a confirmation email with your appointment details.'
  },
  AZ: {
    vendor: 'the Arizona Department of Public Safety (DPS)',
    url: 'https://www.azdps.gov/services/public/fingerprint',
    fee: '$67.00',
    notes: 'Arizona requires a Fingerprint Clearance Card issued by DPS. Apply online or submit a paper application. Processing may take several weeks, so start early.'
  },
  CA: {
    vendor: 'an approved Live Scan provider',
    url: 'https://www.insurance.ca.gov/0200-industry/0030-license/0100-requirements/finger.cfm',
    fee: null,
    notes: 'California uses the Live Scan electronic fingerprinting system. Find a Live Scan location near you on the DOJ website. You will need the ORI code for the California Department of Insurance when submitting your prints.'
  },
  DC: {
    vendor: 'Fieldprint',
    url: 'https://www.fieldprint.com/',
    fee: null,
    notes: 'When scheduling, select "District of Columbia Department of Insurance" as the agency.'
  },
  DE: {
    vendor: 'the Delaware State Police',
    url: 'https://dsp.delaware.gov/state-bureau-of-identification/',
    fee: null,
    notes: 'Contact the Delaware State Bureau of Identification for fingerprinting locations and scheduling. Fingerprints are submitted as part of your license application.'
  },
  FL: {
    vendor: 'an approved electronic fingerprint vendor',
    url: 'https://www.fdle.state.fl.us/Background-Checks/Applicant-Fingerprinting',
    fee: null,
    notes: 'Florida uses electronic (Live Scan) fingerprinting. You can locate an approved vendor through the FDLE website. Select "Department of Financial Services" as the requesting agency when scheduling.'
  },
  GA: {
    vendor: 'IdentoGO',
    url: 'https://www.identogo.com/locations/georgia',
    fee: null,
    notes: 'When scheduling at IdentoGO, select "Georgia Insurance Commissioner" as the agency. You will receive results electronically.'
  },
  HI: {
    vendor: 'Fieldprint Hawaii',
    url: 'https://fieldprinthawaii.com/',
    fee: null,
    notes: 'Visit Fieldprint Hawaii to schedule your appointment. Select "Hawaii Insurance Division" when prompted for the agency.'
  },
  IA: {
    vendor: 'Fieldprint',
    url: 'https://www.fieldprint.com/',
    fee: null,
    notes: 'When scheduling, select "Iowa Insurance Division" as the agency. Fieldprint will electronically submit your results.'
  },
  ID: {
    vendor: 'the Idaho State Police Bureau of Criminal Identification',
    url: 'https://isp.idaho.gov/bci/fingerprinting/',
    fee: null,
    notes: 'Idaho requires fingerprint-based background checks for insurance licensing. Visit the ISP website for approved fingerprinting locations.'
  },
  KS: {
    vendor: 'Fieldprint',
    url: 'https://www.fieldprint.com/',
    fee: null,
    notes: 'When scheduling, select "Kansas Insurance Department" as the agency. Fieldprint will electronically submit your results.'
  },
  LA: {
    vendor: 'IdentoGO',
    url: 'https://www.identogo.com/locations/louisiana',
    fee: null,
    notes: 'When scheduling at IdentoGO, select "Louisiana Department of Insurance" as the agency.'
  },
  MA: {
    vendor: 'Prometric',
    url: 'https://www.prometric.com/massachusetts/insurance',
    fee: null,
    notes: 'In Massachusetts, fingerprinting is handled through Prometric as part of the exam registration process. When you register for your exam, you will also schedule your fingerprinting at the same location.'
  },
  MN: {
    vendor: 'PSI',
    url: 'https://test-takers.psiexams.com/mnins',
    fee: null,
    notes: 'In Minnesota, fingerprinting is handled through PSI as part of the exam process. When you register for your licensing exam, fingerprinting will be included at the testing center.'
  },
  MO: {
    vendor: 'an approved fingerprint vendor',
    url: 'https://insurance.mo.gov/become-an-agent/',
    fee: null,
    notes: 'Missouri requires a fingerprint-based background check. Visit the Missouri Department of Commerce and Insurance website for approved vendors and instructions.'
  },
  MS: {
    vendor: 'an approved fingerprint vendor',
    url: 'https://www.mid.ms.gov/licensing/individual-licensing.aspx',
    fee: null,
    notes: 'Mississippi requires fingerprints as part of the licensing process. Check with the Mississippi Insurance Department for current approved vendors and locations.'
  },
  MT: {
    vendor: 'Fieldprint',
    url: 'https://www.fieldprint.com/',
    fee: null,
    notes: 'When scheduling, select "Montana Commissioner of Securities and Insurance" as the agency.'
  },
  NC: {
    vendor: 'an approved fingerprint vendor',
    url: 'https://www.ncdoi.gov/insurance-industry/licensing-and-education',
    fee: null,
    notes: 'North Carolina requires electronic fingerprinting. Visit the NC Department of Insurance website for approved vendors and submission instructions.'
  },
  ND: {
    vendor: 'an approved fingerprint vendor',
    url: 'https://www.insurance.nd.gov/licensing-education',
    fee: null,
    notes: 'North Dakota requires fingerprints for insurance licensing. Contact the ND Insurance Department for current fingerprinting instructions and approved locations.'
  },
  NE: {
    vendor: 'an approved fingerprint vendor',
    url: 'https://doi.nebraska.gov/licensee/individual-licensing',
    fee: null,
    notes: 'Nebraska requires electronic fingerprinting. Visit the Nebraska Department of Insurance website for approved vendors.'
  },
  NH: {
    vendor: 'an approved fingerprint vendor',
    url: 'https://www.nh.gov/insurance/licensing/',
    fee: null,
    notes: 'New Hampshire requires fingerprints for insurance licensing. Check the NH Insurance Department website for current fingerprinting requirements and approved vendors.'
  },
  NJ: {
    vendor: 'IdentoGO',
    url: 'https://www.identogo.com/locations/new-jersey',
    fee: null,
    notes: 'When scheduling at IdentoGO, select "New Jersey Department of Banking and Insurance" as the agency. Use the service code provided by the NJ DOI.'
  },
  NM: {
    vendor: 'IdentoGO',
    url: 'https://www.identogo.com/locations/new-mexico',
    fee: null,
    notes: 'When scheduling at IdentoGO, select "New Mexico Office of Superintendent of Insurance" as the agency.'
  },
  NV: {
    vendor: 'an approved fingerprint vendor',
    url: 'https://doi.nv.gov/Licensing/Individual/',
    fee: null,
    notes: 'Nevada requires electronic fingerprinting for insurance licensing. Visit the Nevada Division of Insurance website for current approved vendors and instructions.'
  },
  NY: {
    vendor: 'an approved fingerprint vendor',
    url: 'https://www.identogo.com/locations/new-york',
    fee: null,
    notes: 'New York requires fingerprinting through an approved vendor. IdentoGO is a commonly used provider. Select "New York Department of Financial Services" as the agency when scheduling.'
  },
  OH: {
    vendor: 'an approved fingerprint vendor',
    url: 'https://insurance.ohio.gov/licensing-ce',
    fee: null,
    notes: 'Ohio requires fingerprint-based background checks. Visit the Ohio Department of Insurance website for approved vendors and submission instructions.'
  },
  OK: {
    vendor: 'an approved fingerprint vendor',
    url: 'https://www.oid.ok.gov/licensing/',
    fee: null,
    notes: 'Oklahoma requires fingerprints for insurance licensing. Check with the Oklahoma Insurance Department for approved fingerprinting vendors.'
  },
  OR: {
    vendor: 'PSI',
    url: 'https://test-takers.psiexams.com/orins',
    fee: null,
    notes: 'In Oregon, fingerprinting is handled through PSI as part of the exam process. When you register for your licensing exam, fingerprinting will be included.'
  },
  PA: {
    vendor: 'IdentoGO',
    url: 'https://www.identogo.com/locations/pennsylvania',
    fee: null,
    notes: 'When scheduling at IdentoGO, select "Pennsylvania Insurance Department" as the agency. You will receive your results electronically.'
  },
  RI: {
    vendor: 'Fieldprint',
    url: 'https://www.fieldprint.com/',
    fee: null,
    notes: 'When scheduling, select "Rhode Island Department of Business Regulation" as the agency.'
  },
  SC: {
    vendor: 'IdentoGO',
    url: 'https://www.identogo.com/locations/south-carolina',
    fee: null,
    notes: 'When scheduling at IdentoGO, select "South Carolina Department of Insurance" as the agency.'
  },
  SD: {
    vendor: 'an approved fingerprint vendor',
    url: 'https://dlr.sd.gov/insurance/licensing.aspx',
    fee: null,
    notes: 'South Dakota requires fingerprints for insurance licensing. Visit the SD Division of Insurance website for current vendor information.'
  },
  TN: {
    vendor: 'IdentoGO',
    url: 'https://www.identogo.com/locations/tennessee',
    fee: null,
    notes: 'When scheduling at IdentoGO, select "Tennessee Department of Commerce and Insurance" as the agency.'
  },
  TX: {
    vendor: 'IdentoGO',
    url: 'https://www.identogo.com/locations/texas',
    fee: null,
    notes: 'When scheduling at IdentoGO, select "Texas Department of Insurance" as the agency. Use the ORI code provided by TDI.'
  },
  UT: {
    vendor: 'Prometric',
    url: 'https://www.prometric.com/utah/insurance',
    fee: null,
    notes: 'In Utah, fingerprinting is handled through Prometric as part of the exam registration process. When you register for your exam, you will also schedule your fingerprinting.'
  },
  VA: {
    vendor: 'Fieldprint Virginia',
    url: 'https://fieldprintvirginia.com/individuals',
    fee: null,
    notes: 'Visit Fieldprint Virginia to schedule your fingerprinting. Select "Virginia Bureau of Insurance" when prompted for the agency.'
  },
  VT: {
    vendor: 'Prometric',
    url: 'https://www.prometric.com/vermont/insurance',
    fee: null,
    notes: 'In Vermont, fingerprinting is handled through Prometric as part of the exam registration process. When you register for your exam, you will also schedule your fingerprinting.'
  },
  WA: {
    vendor: 'IdentoGO',
    url: 'https://wa.state.identogo.com/',
    fee: null,
    notes: 'When scheduling at IdentoGO, select "Washington Office of the Insurance Commissioner" as the agency.'
  },
  WI: {
    vendor: 'Fieldprint Wisconsin',
    url: 'https://fieldprintwisconsin.com/individuals',
    fee: null,
    notes: 'Visit Fieldprint Wisconsin to schedule your fingerprinting. Select "Wisconsin Office of the Commissioner of Insurance" when prompted.'
  },
  WV: {
    vendor: 'IdentoGO',
    url: 'https://www.identogo.com/locations/west-virginia',
    fee: null,
    notes: 'When scheduling at IdentoGO, select "West Virginia Offices of the Insurance Commissioner" as the agency.'
  },
  WY: {
    vendor: 'an approved fingerprint vendor',
    url: 'https://doi.wyo.gov/licensing/individual-licensing',
    fee: null,
    notes: 'Wyoming requires fingerprints for insurance licensing. Visit the Wyoming Department of Insurance website for approved vendors and instructions.'
  }
};

// ─── EXAM / SCHEDULE LICENSING TEST DATA ─────────────────────────────────────

const EXAM_DATA = {
  // PSI states
  AR: { provider: 'PSI', url: 'https://test-takers.psiexams.com/arins', fee: '$42' },
  LA: { provider: 'PSI', url: 'https://test-takers.psiexams.com/laind', fee: '$42' },
  MI: { provider: 'PSI', url: 'https://test-takers.psiexams.com/midifs', fee: '$42' },
  MN: { provider: 'PSI', url: 'https://test-takers.psiexams.com/mnins', fee: '$42' },
  ND: { provider: 'PSI', url: 'https://test-takers.psiexams.com/ndins', fee: '$42' },
  NE: { provider: 'PSI', url: 'https://test-takers.psiexams.com/neins', fee: '$42' },
  NH: { provider: 'PSI', url: 'https://test-takers.psiexams.com/nhins', fee: '$42' },
  NJ: { provider: 'PSI', url: 'https://test-takers.psiexams.com/njins', fee: '$42' },
  NM: { provider: 'PSI', url: 'https://test-takers.psiexams.com/nmins', fee: '$42' },
  NY: { provider: 'PSI', url: 'https://test-takers.psiexams.com/nyins', fee: '$42' },
  OH: { provider: 'PSI', url: 'https://test-takers.psiexams.com/ohins', fee: '$42' },
  OK: { provider: 'PSI', url: 'https://test-takers.psiexams.com/okins', fee: '$42' },
  OR: { provider: 'PSI', url: 'https://test-takers.psiexams.com/orins', fee: '$42' },
  WA: { provider: 'PSI', url: 'https://test-takers.psiexams.com/waoic', fee: '$42' },
  PA: { provider: 'PSI', url: 'https://test-takers.psiexams.com/pain', fee: '$45' },

  // Prometric states
  MA: { provider: 'Prometric', url: 'https://www.prometric.com/massachusetts/insurance', fee: '$46' },
  MD: { provider: 'Prometric', url: 'https://www.prometric.com/maryland/insurance', fee: '$46' },
  UT: { provider: 'Prometric', url: 'https://www.prometric.com/utah/insurance', fee: '$52' },
  VA: { provider: 'Prometric', url: 'https://www.prometric.com/virginia/insurance', fee: '$46' },
  VT: { provider: 'Prometric', url: 'https://www.prometric.com/vermont/insurance', fee: '$46' },

  // Pearson VUE states
  AZ: { provider: 'Pearson VUE', url: 'https://home.pearsonvue.com/az/insurance', fee: '$55' },
  CA: { provider: 'Prometric', url: 'https://www.prometric.com/california/insurance', fee: '$52' },
  FL: { provider: 'Pearson VUE', url: 'https://home.pearsonvue.com/fl/insurance', fee: '$55' },
  GA: { provider: 'Pearson VUE', url: 'https://home.pearsonvue.com/ga/insurance', fee: '$55' },
  TX: { provider: 'Pearson VUE', url: 'https://home.pearsonvue.com/tx/insurance', fee: '$55' },

  // State-specific
  AL: { provider: 'University of Alabama', url: 'https://www.training.ua.edu/insurance-testing/insurance-testing-registration/', fee: '$50' },
  KY: { provider: 'Kentucky DOI', url: 'https://insurance.ky.gov/doieservices/userrole.aspx', fee: '$40' }
};

// Pre-licensing course hours for states where it's required
const PRELICENSING_REQUIRED = {
  AL: 20,
  AZ: 40
};

// ─── INSTRUCTION BUILDERS ────────────────────────────────────────────────────

function buildBackgroundCheckInstructions(state) {
  const stateName = STATE_NAMES[state];
  const stateSlug = STATE_SLUGS[state];
  const fp = FINGERPRINT_DATA[state];

  if (!fp) {
    return `Fingerprints are required in ${stateName}.\n\nContact your state's Department of Insurance for approved fingerprinting vendors and locations.\n\nFingerprints must be completed before your license can be issued. Bring a valid government-issued photo ID to your appointment.\n\nFor full requirements, visit:\nhttps://www.xcelsolutions.com/${stateSlug}/insurance-license/requirements`;
  }

  let text = `Fingerprints are required in ${stateName}.\n\nVisit ${fp.vendor} to schedule your fingerprinting appointment:\n${fp.url}`;

  if (fp.fee) {
    text += `\n\nFee: ${fp.fee}`;
  }

  if (fp.notes) {
    text += `\n\n${fp.notes}`;
  }

  text += `\n\nFingerprints must be completed before your license can be issued. Bring a valid government-issued photo ID to your appointment.`;
  text += `\n\nFor full requirements, visit:\nhttps://www.xcelsolutions.com/${stateSlug}/insurance-license/requirements`;

  return text;
}

function buildPreLicensingOptionalInstructions(state) {
  const stateName = STATE_NAMES[state];
  const stateSlug = STATE_SLUGS[state];

  return `Pre-licensing education is recommended but not required in ${stateName}.\n\nWhile not mandatory, completing a pre-licensing course will significantly improve your chances of passing the state exam. XCEL Solutions offers state-approved courses:\nhttps://www.xcelsolutions.com/${stateSlug}/insurance-license/requirements\n\nYour manager may also provide training materials and study guides.`;
}

function buildPreLicensingRequiredInstructions(state) {
  const stateName = STATE_NAMES[state];
  const stateSlug = STATE_SLUGS[state];
  const hours = PRELICENSING_REQUIRED[state] || 'the required number of';

  return `Pre-licensing education is required in ${stateName}. You must complete ${hours} hours of approved coursework before taking the state exam.\n\nXCEL Solutions offers approved courses:\nhttps://www.xcelsolutions.com/${stateSlug}/insurance-license/requirements\n\nComplete the course and retain your certificate of completion — you'll need it when applying for your exam.`;
}

function buildScheduleExamInstructions(state) {
  const stateName = STATE_NAMES[state];
  const stateSlug = STATE_SLUGS[state];
  const exam = EXAM_DATA[state];

  if (!exam) {
    return `Schedule your Life insurance licensing exam for ${stateName}.\n\nVisit your state's Department of Insurance website for exam registration information:\nhttps://www.xcelsolutions.com/${stateSlug}/insurance-license/requirements\n\nBring two forms of valid ID to the testing center.\n\nStudy tip: Review your pre-licensing materials thoroughly. The exam typically covers life insurance policy types, regulations, and ethics.`;
  }

  let text = `Schedule your Life insurance licensing exam with ${exam.provider}:\n${exam.url}`;

  if (exam.provider === 'PSI') {
    text += `\n\nCreate an account at PSI, select "${stateName} Insurance", choose the "Life" exam, and pick a testing center and date near you.`;
  } else if (exam.provider === 'Prometric') {
    text += `\n\nVisit Prometric, select "${stateName} Insurance", and schedule your Life exam at a convenient location.`;
  } else if (exam.provider === 'Pearson VUE') {
    text += `\n\nSchedule through Pearson VUE for ${stateName} insurance exams. Select the "Life" exam and choose a testing center near you.`;
  } else if (exam.provider === 'University of Alabama') {
    text += `\n\nRegister through the University of Alabama insurance testing portal. After submitting your registration, you will receive an email within two business days from "Alabama Support" with exam process details.\n\nNote: There is a 7-day waiting period to take the exam. Online proctored exams are available.`;
  } else if (exam.provider === 'Kentucky DOI') {
    text += `\n\nRegister through the Kentucky Department of Insurance e-Services portal. Create an account, select the Life insurance exam, and choose an available testing date.`;
  }

  text += `\n\nExam fee: approximately ${exam.fee}. Bring two forms of valid ID to the testing center.`;
  text += `\n\nStudy tip: Review your pre-licensing materials thoroughly. The exam typically covers life insurance policy types, regulations, and ethics.`;
  text += `\n\nFor full requirements, visit:\nhttps://www.xcelsolutions.com/${stateSlug}/insurance-license/requirements`;

  return text;
}

// ─── MAIN MIGRATION ──────────────────────────────────────────────────────────

async function run() {
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('Connected to database.\n');

  // Fetch all active rows
  const [rows] = await conn.query(
    'SELECT id, state, target_item_name, action, url, instructions FROM pipeline_state_requirements WHERE active = 1 ORDER BY state, target_item_name'
  );
  console.log(`Found ${rows.length} active rows to process.\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let urlUpdatedCount = 0;

  for (const row of rows) {
    const { id, state, target_item_name, action } = row;
    let instructions = null;
    let newUrl = null;

    // ── Background Check Completed ──
    if (target_item_name === 'Background Check Completed') {
      if (action === 'not_required') {
        // not_required states don't need instructions
        console.log(`[SKIP] ID ${id} | ${state} | Background Check | action=not_required (no instructions needed)`);
        skippedCount++;
        continue;
      }
      instructions = buildBackgroundCheckInstructions(state);
      // Set url if currently NULL
      if (!row.url && FINGERPRINT_DATA[state]) {
        newUrl = FINGERPRINT_DATA[state].url;
      }
    }

    // ── Pre-Licensing Course ──
    else if (target_item_name === 'Pre-Licensing Course') {
      if (PRELICENSING_REQUIRED[state]) {
        instructions = buildPreLicensingRequiredInstructions(state);
      } else {
        instructions = buildPreLicensingOptionalInstructions(state);
      }
    }

    // ── Schedule Licensing Test ──
    else if (target_item_name === 'Schedule Licensing Test') {
      instructions = buildScheduleExamInstructions(state);
      // Set url if currently NULL
      if (!row.url && EXAM_DATA[state]) {
        newUrl = EXAM_DATA[state].url;
      }
    }

    // ── Purchase License (special case, only AL id=147) ──
    else if (target_item_name === 'Purchase License') {
      // This row already has instructions, but let's clean it up
      instructions = `Submit your license application online through NIPR:\nhttps://www.nipr.com\n\nApplication fee: $80.00\n\nYou will also need to submit proof of citizenship. In accordance with the Beason-Hammon Taxpayer and Citizen Protection Act, Alabama requires all applicants to verify proof of citizenship:\nhttps://aldoi.gov/LicenseeCZ/Initial.aspx\n\nYou can find a list of valid documents on the Alabama DOI website. Have your exam pass confirmation and any required documents ready before starting your application.`;
    }

    // ── Unknown type ──
    else {
      console.log(`[SKIP] ID ${id} | ${state} | Unknown target_item_name: ${target_item_name}`);
      skippedCount++;
      continue;
    }

    if (!instructions) {
      console.log(`[SKIP] ID ${id} | ${state} | ${target_item_name} | No instructions generated`);
      skippedCount++;
      continue;
    }

    // Build UPDATE query
    if (newUrl) {
      await conn.query(
        'UPDATE pipeline_state_requirements SET instructions = ?, url = ? WHERE id = ?',
        [instructions, newUrl, id]
      );
      urlUpdatedCount++;
      console.log(`[UPDATE] ID ${id} | ${state} | ${target_item_name} | instructions + url updated`);
    } else {
      await conn.query(
        'UPDATE pipeline_state_requirements SET instructions = ? WHERE id = ?',
        [instructions, id]
      );
      console.log(`[UPDATE] ID ${id} | ${state} | ${target_item_name} | instructions updated`);
    }
    updatedCount++;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Migration complete.`);
  console.log(`  Rows updated:      ${updatedCount}`);
  console.log(`  URLs also set:     ${urlUpdatedCount}`);
  console.log(`  Rows skipped:      ${skippedCount}`);
  console.log(`  Total processed:   ${rows.length}`);
  console.log(`${'='.repeat(60)}`);

  await conn.end();
  console.log('Database connection closed.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
