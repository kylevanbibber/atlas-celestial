// Auto Trial Guidelines Database
// Based on insurance underwriting guidelines for medical conditions

const autoTrialConditions = [
  {
    condition: "ADHD/ADD",
    trialGuideline: "Age 8 or younger, or children diagnosed before age 8 is an automatic trial.",
    severity: "moderate",
    relatedMedications: ["Adderall", "Ritalin", "Vyvanse", "Strattera", "Intuniv", "Concerta"]
  },
  {
    condition: "Addison's Disease",
    trialGuideline: "Hospitalization within the last year is an automatic trial.",
    severity: "high",
    relatedMedications: ["Prednisone", "Hydrocortisone"]
  },
  {
    condition: "Asthma",
    trialGuideline: "Application will be trialed if applicant was hospitalized due to asthma within 2 years of application date.",
    severity: "moderate",
    relatedMedications: ["Advair", "Albuterol", "Singulair", "Flovent", "ProAir", "Ventolin", "Symbicort"]
  },
  {
    condition: "Autism and Asperger's",
    trialGuideline: "All cases will be trialed.",
    severity: "high",
    relatedMedications: ["Risperdal", "Abilify", "Zyprexa"]
  },
  {
    condition: "Cancer",
    trialGuideline: "Application will be trialed if applicant was diagnosed with cancer within 5 years of application date. Breast or colon cancer within 10 years is an automatic trial. Generally 10-20K of insurance is advised. (Does not include basal or squamous skin cancer)",
    severity: "high",
    relatedMedications: ["Tamoxifen", "Arimidex", "Gleevec", "Chemotherapy agents"]
  },
  {
    condition: "Chest Pain/Angina",
    trialGuideline: "If applicant has been to emergency room or hospitalized within 2 years of application date, application will be trialed. Within 5 years applicants must be okay with $5 per thousand rating or application will be trialed. Generally 10-20k of insurance is advised.",
    severity: "high",
    relatedMedications: ["Norvasc", "Cardizem", "Nitroglycerin", "Isosorbide"]
  },
  {
    condition: "Crohn's Disease/Colitis",
    trialGuideline: "If surgery has been required, application should be trialed. Applicants must be okay with $5 per thousand rating, or application will be trialed. Diagnosis within 1 year of application date is a decline. Generally 10-20k of insurance is advised.",
    severity: "high",
    relatedMedications: ["Humira", "Remicade", "Prednisone", "Azathioprine", "Mesalamine"]
  },
  {
    condition: "Depression",
    trialGuideline: "Application will be trialed if applicant was hospitalized, disabled, or missed time from work due to depression. Depression medication taken with pain medication is an auto trial. Depression and currently seeing psychologist/psychiatrist is an auto trial.",
    severity: "moderate",
    relatedMedications: ["Prozac", "Zoloft", "Lexapro", "Wellbutrin", "Cymbalta", "Effexor", "Paxil", "Celexa", "Remeron", "Trazodone"]
  },
  {
    condition: "Anxiety",
    trialGuideline: "Application will be trialed if applicant was hospitalized, disabled, or missed time from work due to anxiety. Anxiety medication taken with pain medication is an auto trial. Anxiety and currently seeing psychologist/psychiatrist is an auto trial.",
    severity: "moderate",
    relatedMedications: ["Xanax", "Ativan", "Klonopin", "Valium", "Buspar", "Lexapro", "Zoloft", "Prozac"]
  },
  {
    condition: "Diabetes Type 1",
    trialGuideline: "Insulin dependent diabetics will be trialed automatically. Applicants must be okay with $5 per thousand rating, or application will be trialed. Generally 10-20k of insurance is advised. HBP with combination of Diabetes is an auto trial.",
    severity: "high",
    relatedMedications: ["Lantus", "Humalog", "Novolog", "Levemir", "Insulin"]
  },
  {
    condition: "Diabetes Type 2",
    trialGuideline: "Application will be trialed if applicant takes 1,000 milligrams or more of any medication. If applicant doesn't see their doctor at least 1 time a year or if their weight is table 3 or higher, submit as trial. Applicants must be okay with $5 per thousand rating. Generally 10-20k of insurance is advised. HBP with combination of Diabetes is an auto trial.",
    severity: "moderate-high",
    relatedMedications: ["Metformin", "Januvia", "Ozempic", "Jardiance", "Farxiga", "Invokana", "Trulicity", "Victoza", "Glucotrol", "Amaryl", "Actos"]
  },
  {
    condition: "Heart Attack",
    trialGuideline: "All applications with a heart attack must be trialed. Between 10-20k of insurance is advised. Do not add ADB to coverage.",
    severity: "high",
    relatedMedications: ["Plavix", "Aspirin", "Metoprolol", "Lisinopril", "Lipitor"]
  },
  {
    condition: "High Blood Pressure (Hypertension)",
    trialGuideline: "Application will be trialed if applicant has been hospitalized in the last 2 years for blood pressure. HBP with combination of Diabetes is an auto trial. Applicants taking 3 or more medications for HBP will be sent as a trial.",
    severity: "moderate",
    relatedMedications: ["Lisinopril", "Norvasc", "Metoprolol", "Hydrochlorothiazide", "Lasix", "Diovan", "Benicar", "Coreg"]
  },
  {
    condition: "Hepatitis",
    trialGuideline: "Current treatment is an auto trial. Hepatitis C is always a trial.",
    severity: "high",
    relatedMedications: ["Interferon", "Ribavirin", "Harvoni"]
  },
  {
    condition: "Seizures/Epilepsy",
    trialGuideline: "Seizures within the last 2 years of application are trialed. Grand Mal in the past 5 years is an auto trial.",
    severity: "high",
    relatedMedications: ["Dilantin", "Keppra", "Lamictal", "Depakote", "Tegretol", "Neurontin", "Topamax"]
  },
  {
    condition: "Stroke or TIA",
    trialGuideline: "Any applicant that has had a stroke within 2 years or 2 or more ever. Generally 10-20k of insurance is advised.",
    severity: "high",
    relatedMedications: ["Plavix", "Coumadin", "Eliquis", "Xarelto", "Aspirin"]
  },
  {
    condition: "Atrial Fibrillation",
    trialGuideline: "Automatic trial condition. Requires careful underwriting review.",
    severity: "high",
    relatedMedications: ["Eliquis", "Xarelto", "Coumadin", "Warfarin", "Metoprolol", "Digoxin"]
  },
  {
    condition: "Blood Clots (DVT/Pulmonary Embolism)",
    trialGuideline: "Automatic trial condition. History of blood clots requires medical review.",
    severity: "high",
    relatedMedications: ["Coumadin", "Warfarin", "Eliquis", "Xarelto", "Lovenox", "Heparin"]
  },
  {
    condition: "COPD (Chronic Obstructive Pulmonary Disease)",
    trialGuideline: "Automatic trial condition. Chronic lung disease requires underwriting review.",
    severity: "high",
    relatedMedications: ["Advair", "Spiriva", "Symbicort", "Albuterol", "Prednisone"]
  },
  {
    condition: "Bipolar Disorder",
    trialGuideline: "Automatic trial condition. All bipolar cases require medical review.",
    severity: "high",
    relatedMedications: ["Lithium", "Lamictal", "Depakote", "Abilify", "Seroquel", "Zyprexa", "Risperdal", "Latuda"]
  },
  {
    condition: "Schizophrenia",
    trialGuideline: "Automatic trial condition. All cases require medical review.",
    severity: "high",
    relatedMedications: ["Haldol", "Risperdal", "Zyprexa", "Seroquel", "Abilify", "Clozapine"]
  },
  {
    condition: "Multiple Sclerosis",
    trialGuideline: "Automatic trial condition. Requires medical review.",
    severity: "high",
    relatedMedications: ["Interferon", "Copaxone", "Tecfidera", "Tysabri"]
  },
  {
    condition: "Parkinson's Disease",
    trialGuideline: "Automatic trial condition. Requires medical review.",
    severity: "high",
    relatedMedications: ["Sinemet", "Requip", "Mirapex", "Azilect"]
  },
  {
    condition: "Lupus",
    trialGuideline: "Automatic trial condition. All autoimmune conditions require medical review.",
    severity: "high",
    relatedMedications: ["Plaquenil", "Prednisone", "Imuran", "CellCept"]
  },
  {
    condition: "Kidney Disease",
    trialGuideline: "Any kidney issues not including kidney stones is an auto trial. Kidney dialysis is an automatic trial.",
    severity: "high",
    relatedMedications: ["Lasix", "Various based on severity"]
  },
  {
    condition: "Chronic Pain",
    trialGuideline: "Automatic trial condition. Chronic pain management requires review, especially with controlled substances.",
    severity: "moderate-high",
    relatedMedications: ["Oxycodone", "Hydrocodone", "Tramadol", "Gabapentin", "Lyrica", "Morphine", "Fentanyl"]
  },
  {
    condition: "Neuropathy",
    trialGuideline: "Automatic trial condition. Requires medical review.",
    severity: "moderate-high",
    relatedMedications: ["Gabapentin", "Lyrica", "Cymbalta", "Neurontin"]
  },
  {
    condition: "Osteoporosis",
    trialGuideline: "Generally not an auto trial unless severe or with multiple fractures. Standard underwriting applies.",
    severity: "low-moderate",
    relatedMedications: ["Fosamax", "Boniva", "Prolia", "Forteo"]
  },
  {
    condition: "High Cholesterol",
    trialGuideline: "Generally not an auto trial if well-controlled. Standard underwriting applies.",
    severity: "low",
    relatedMedications: ["Lipitor", "Crestor", "Zocor", "Zetia"]
  },
  {
    condition: "GERD/Acid Reflux",
    trialGuideline: "Generally not an auto trial. Standard underwriting applies unless complicated.",
    severity: "low",
    relatedMedications: ["Nexium", "Prilosec", "Pepcid", "Protonix"]
  },
  {
    condition: "Hypothyroidism",
    trialGuideline: "Generally not an auto trial if well-controlled. Standard underwriting applies.",
    severity: "low",
    relatedMedications: ["Synthroid", "Levothyroxine", "Armour Thyroid"]
  },
  {
    condition: "Allergies",
    trialGuideline: "Generally not an auto trial. Standard underwriting applies.",
    severity: "low",
    relatedMedications: ["Zyrtec", "Claritin", "Allegra", "Flonase", "Singulair"]
  },
  {
    condition: "Insomnia",
    trialGuideline: "Generally not an auto trial unless associated with mental health conditions requiring psychiatric care. Ambien alone typically standard.",
    severity: "low-moderate",
    relatedMedications: ["Ambien", "Lunesta", "Trazodone", "Melatonin"]
  },
  {
    condition: "Rheumatoid Arthritis",
    trialGuideline: "May be trialed depending on severity and medications. Biologic medications often trigger review.",
    severity: "moderate-high",
    relatedMedications: ["Humira", "Enbrel", "Methotrexate", "Plaquenil", "Prednisone"]
  },
  {
    condition: "Dementia/Alzheimer's",
    trialGuideline: "Automatic trial condition. All cases require medical review.",
    severity: "high",
    relatedMedications: ["Aricept", "Namenda", "Exelon", "Donepezil"]
  }
];

// Medications that automatically trigger trials regardless of condition
const autoTrialMedications = [
  {
    medicationName: "Abilify",
    reason: "Antipsychotic medication - indicates serious mental health condition"
  },
  {
    medicationName: "Coumadin",
    reason: "Blood thinner - indicates clotting disorder or cardiovascular issues"
  },
  {
    medicationName: "Warfarin",
    reason: "Blood thinner - indicates clotting disorder or cardiovascular issues"
  },
  {
    medicationName: "Lovenox",
    reason: "Blood thinner - indicates clotting disorder or cardiovascular issues"
  },
  {
    medicationName: "Seroquel",
    reason: "Antipsychotic medication - indicates serious mental health condition"
  },
  {
    medicationName: "Ambien",
    reason: "Sleep aid - may indicate underlying issues if used long-term"
  },
  {
    medicationName: "Lyrica",
    reason: "Often used for chronic pain or fibromyalgia"
  },
  {
    medicationName: "Tramadol",
    reason: "Opioid pain medication - indicates chronic pain"
  },
  {
    medicationName: "Trazodone",
    reason: "Antidepressant/sleep aid - may indicate mental health concerns"
  },
  {
    medicationName: "Xarelto",
    reason: "Blood thinner - indicates clotting disorder or atrial fibrillation"
  },
  {
    medicationName: "Plavix",
    reason: "Blood thinner - indicates cardiovascular issues"
  },
  {
    medicationName: "Gabapentin",
    reason: "Often used for chronic pain or neuropathy"
  },
  {
    medicationName: "Lithium",
    reason: "Mood stabilizer - indicates bipolar disorder"
  },
  {
    medicationName: "Risperdal",
    reason: "Antipsychotic - indicates serious mental health condition"
  },
  {
    medicationName: "Methadone",
    reason: "Opioid for severe pain or addiction treatment"
  },
  {
    medicationName: "Suboxone",
    reason: "Addiction treatment medication"
  },
  {
    medicationName: "Fentanyl",
    reason: "Strong opioid - indicates severe chronic pain"
  },
  {
    medicationName: "Morphine",
    reason: "Strong opioid - indicates severe pain"
  },
  {
    medicationName: "OxyContin",
    reason: "Strong opioid - indicates chronic severe pain"
  },
  {
    medicationName: "Oxycodone",
    reason: "Opioid pain medication - indicates significant pain issues"
  },
  {
    medicationName: "Percocet",
    reason: "Opioid combination - indicates pain management issues"
  },
  {
    medicationName: "Heparin",
    reason: "Blood thinner - indicates clotting issues"
  },
  {
    medicationName: "Fragmin",
    reason: "Blood thinner - indicates clotting issues"
  },
  {
    medicationName: "Interferon",
    reason: "Treatment for hepatitis or other serious conditions"
  },
  {
    medicationName: "Aricept",
    reason: "Alzheimer's/dementia medication"
  },
  {
    medicationName: "Exelon",
    reason: "Alzheimer's/dementia medication"
  },
  {
    medicationName: "Donepezil",
    reason: "Alzheimer's/dementia medication"
  },
  {
    medicationName: "Truvada",
    reason: "HIV prevention/treatment"
  }
];

// Additional trial guidelines
const generalTrialGuidelines = {
  hospitalizations: "Hospitalization for an illness for 2 days or more within 6 months of app date triggers trial.",
  recentSurgery: "If surgery will be done during underwriting or has been done within 6 months of the app.",
  disabled: "If applicant is currently disabled due to any illness or disease, application will be trialed.",
  previousDeclines: "If applicant has been declined, rated, NTO'd or INC, the new application will be trialed.",
  weight: "Application will be trialed if applicant is above table 4 rating (table 5 and higher), regardless of coverage amount. For coverage over 100k, table 2 or above. For Sr. Graded, trial if over T12.",
  medicationCombination: "Any combo of meds totaling 1000mgs/day or more is an auto trial.",
  nonCompliance: "If someone, without their doctor's knowledge, isn't taking medication that was prescribed for any listed illness, automatic trial.",
  multipleHBPMeds: "Applicants taking 3 or more medications for high blood pressure will be sent as a trial.",
  depressionWithPain: "Depression or anxiety medication taken with pain medication is an auto trial.",
  activeSubstanceUse: "Currently uses marijuana, including medical marijuana with card, is a trial."
};

module.exports = {
  autoTrialConditions,
  autoTrialMedications,
  generalTrialGuidelines
};

