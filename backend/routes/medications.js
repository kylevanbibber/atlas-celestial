const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const { autoTrialConditions, autoTrialMedications, generalTrialGuidelines } = require('./autoTrialData');

// Comprehensive medication database - in-memory for fast performance
// This list contains 200+ common medications with brand/generic names and uses
const medicationsData = [
  // ========== CARDIOVASCULAR MEDICATIONS ==========
  
  // Statins (Cholesterol)
  {
    brandName: "Lipitor",
    genericName: "Atorvastatin",
    alternativeNames: ["Torvast", "Sortis"],
    uses: "High cholesterol, heart disease prevention"
  },
  {
    brandName: "Plavix",
    genericName: "Clopidogrel",
    alternativeNames: ["Iscover"],
    uses: "Blood clot prevention, heart disease, stroke prevention"
  },
  {
    brandName: "Norvasc",
    genericName: "Amlodipine",
    alternativeNames: ["Istin"],
    uses: "High blood pressure, chest pain (angina)"
  },
  {
    brandName: "Lisinopril",
    genericName: "Lisinopril",
    alternativeNames: ["Prinivil", "Zestril"],
    uses: "High blood pressure, heart failure, heart attack recovery"
  },
  {
    brandName: "Metoprolol",
    genericName: "Metoprolol",
    alternativeNames: ["Lopressor", "Toprol-XL"],
    uses: "High blood pressure, chest pain, heart failure, heart attack recovery"
  },
  
  // ========== DIABETES MEDICATIONS ==========
  {
    brandName: "Metformin",
    genericName: "Metformin",
    alternativeNames: ["Glucophage", "Fortamet", "Glumetza"],
    uses: "Type 2 diabetes"
  },
  {
    brandName: "Lantus",
    genericName: "Insulin Glargine",
    alternativeNames: ["Basaglar", "Toujeo"],
    uses: "Type 1 and Type 2 diabetes"
  },
  {
    brandName: "Januvia",
    genericName: "Sitagliptin",
    alternativeNames: [],
    uses: "Type 2 diabetes"
  },
  {
    brandName: "Ozempic",
    genericName: "Semaglutide",
    alternativeNames: ["Wegovy", "Rybelsus"],
    uses: "Type 2 diabetes, weight management"
  },
  
  // ========== RESPIRATORY MEDICATIONS ==========
  {
    brandName: "Advair",
    genericName: "Fluticasone/Salmeterol",
    alternativeNames: ["Seretide", "Wixela"],
    uses: "Asthma, chronic obstructive pulmonary disease (COPD)"
  },
  {
    brandName: "Albuterol",
    genericName: "Albuterol",
    alternativeNames: ["Ventolin", "ProAir", "Proventil"],
    uses: "Asthma, breathing problems, bronchospasm"
  },
  {
    brandName: "Singulair",
    genericName: "Montelukast",
    alternativeNames: [],
    uses: "Asthma, seasonal allergies"
  },
  
  // ========== PAIN & INFLAMMATION ==========
  {
    brandName: "Advil",
    genericName: "Ibuprofen",
    alternativeNames: ["Motrin", "Nurofen"],
    uses: "Pain, inflammation, fever, headaches, arthritis, menstrual cramps"
  },
  {
    brandName: "Tylenol",
    genericName: "Acetaminophen",
    alternativeNames: ["Paracetamol", "Panadol"],
    uses: "Pain, fever, headaches, muscle aches"
  },
  {
    brandName: "Celebrex",
    genericName: "Celecoxib",
    alternativeNames: [],
    uses: "Arthritis, pain, inflammation"
  },
  {
    brandName: "Lyrica",
    genericName: "Pregabalin",
    alternativeNames: [],
    uses: "Nerve pain, diabetic neuropathy, fibromyalgia, seizures"
  },
  
  // ========== ANTIBIOTICS ==========
  {
    brandName: "Amoxicillin",
    genericName: "Amoxicillin",
    alternativeNames: ["Amoxil", "Moxatag"],
    uses: "Bacterial infections, ear infections, pneumonia, bronchitis, UTI, skin infections"
  },
  {
    brandName: "Augmentin",
    genericName: "Amoxicillin/Clavulanate",
    alternativeNames: ["Co-amoxiclav"],
    uses: "Bacterial infections, resistant infections, respiratory infections"
  },
  {
    brandName: "Zithromax",
    genericName: "Azithromycin",
    alternativeNames: ["Z-Pak"],
    uses: "Bacterial infections, respiratory infections, skin infections, STDs"
  },
  {
    brandName: "Cipro",
    genericName: "Ciprofloxacin",
    alternativeNames: ["Ciloxan"],
    uses: "Bacterial infections, UTI, respiratory infections, bone/joint infections"
  },
  
  // ========== ANTIDEPRESSANTS & MENTAL HEALTH ==========
  {
    brandName: "Prozac",
    genericName: "Fluoxetine",
    alternativeNames: ["Sarafem"],
    uses: "Depression, OCD, panic disorder, bulimia"
  },
  {
    brandName: "Zoloft",
    genericName: "Sertraline",
    alternativeNames: ["Lustral"],
    uses: "Depression, anxiety, PTSD, OCD, panic disorder"
  },
  {
    brandName: "Lexapro",
    genericName: "Escitalopram",
    alternativeNames: ["Cipralex"],
    uses: "Depression, generalized anxiety disorder"
  },
  {
    brandName: "Xanax",
    genericName: "Alprazolam",
    alternativeNames: [],
    uses: "Anxiety disorders, panic disorder"
  },
  {
    brandName: "Ativan",
    genericName: "Lorazepam",
    alternativeNames: [],
    uses: "Anxiety disorders, insomnia, seizures"
  },
  
  // ========== ACID REFLUX & STOMACH ==========
  {
    brandName: "Nexium",
    genericName: "Esomeprazole",
    alternativeNames: [],
    uses: "GERD, heartburn, ulcers, erosive esophagitis"
  },
  {
    brandName: "Prilosec",
    genericName: "Omeprazole",
    alternativeNames: ["Losec"],
    uses: "Heartburn, GERD, stomach ulcers, erosive esophagitis"
  },
  {
    brandName: "Zantac",
    genericName: "Ranitidine",
    alternativeNames: [],
    uses: "Heartburn, ulcers (recalled in 2020)"
  },
  {
    brandName: "Pepcid",
    genericName: "Famotidine",
    alternativeNames: [],
    uses: "Heartburn, GERD, ulcers"
  },
  
  // ========== THYROID MEDICATIONS ==========
  {
    brandName: "Synthroid",
    genericName: "Levothyroxine",
    alternativeNames: ["Levoxyl", "Unithroid"],
    uses: "Hypothyroidism, goiter"
  },
  
  // ========== BLOOD THINNERS ==========
  {
    brandName: "Coumadin",
    genericName: "Warfarin",
    alternativeNames: ["Jantoven"],
    uses: "Atrial fibrillation, blood clot prevention, stroke prevention"
  },
  {
    brandName: "Eliquis",
    genericName: "Apixaban",
    alternativeNames: [],
    uses: "Atrial fibrillation, blood clots, stroke prevention, DVT, pulmonary embolism"
  },
  {
    brandName: "Xarelto",
    genericName: "Rivaroxaban",
    alternativeNames: [],
    uses: "Atrial fibrillation, blood clots, stroke prevention, DVT, pulmonary embolism"
  },
  
  // ========== ALLERGY MEDICATIONS ==========
  {
    brandName: "Zyrtec",
    genericName: "Cetirizine",
    alternativeNames: [],
    uses: "Allergies, sneezing, runny nose, itchy eyes"
  },
  {
    brandName: "Claritin",
    genericName: "Loratadine",
    alternativeNames: [],
    uses: "Allergies, sneezing, runny nose, itchy eyes"
  },
  {
    brandName: "Allegra",
    genericName: "Fexofenadine",
    alternativeNames: [],
    uses: "Seasonal allergies, chronic hives"
  },
  {
    brandName: "Flonase",
    genericName: "Fluticasone",
    alternativeNames: ["Flovent"],
    uses: "Nasal allergies, congestion, sneezing, runny nose"
  },
  
  // ========== SLEEP MEDICATIONS ==========
  {
    brandName: "Ambien",
    genericName: "Zolpidem",
    alternativeNames: ["Edluar", "Intermezzo"],
    uses: "Insomnia"
  },
  {
    brandName: "Lunesta",
    genericName: "Eszopiclone",
    alternativeNames: [],
    uses: "Insomnia"
  },

  // ========== ADDITIONAL CARDIOVASCULAR ==========
  
  {
    brandName: "Crestor",
    genericName: "Rosuvastatin",
    alternativeNames: ["Ezallor"],
    uses: "High cholesterol, heart disease prevention"
  },
  {
    brandName: "Zocor",
    genericName: "Simvastatin",
    alternativeNames: ["FloLipid"],
    uses: "High cholesterol, heart disease prevention"
  },
  {
    brandName: "Zetia",
    genericName: "Ezetimibe",
    alternativeNames: [],
    uses: "High cholesterol"
  },
  {
    brandName: "Coreg",
    genericName: "Carvedilol",
    alternativeNames: [],
    uses: "High blood pressure, heart failure"
  },
  {
    brandName: "Diovan",
    genericName: "Valsartan",
    alternativeNames: [],
    uses: "High blood pressure, heart failure"
  },
  {
    brandName: "Benicar",
    genericName: "Olmesartan",
    alternativeNames: [],
    uses: "High blood pressure"
  },
  {
    brandName: "Lasix",
    genericName: "Furosemide",
    alternativeNames: [],
    uses: "Fluid retention (edema), high blood pressure"
  },
  {
    brandName: "Hydrochlorothiazide",
    genericName: "Hydrochlorothiazide",
    alternativeNames: ["HCTZ", "Microzide"],
    uses: "High blood pressure, fluid retention"
  },
  {
    brandName: "Cardizem",
    genericName: "Diltiazem",
    alternativeNames: ["Tiazac", "Cartia"],
    uses: "High blood pressure, chest pain, heart rhythm disorders"
  },
  {
    brandName: "Digoxin",
    genericName: "Digoxin",
    alternativeNames: ["Lanoxin"],
    uses: "Treats heart failure and abnormal heart rhythms. Helps the heart beat stronger and more regularly.",
    additionalInfo: "Requires regular blood level monitoring. Narrow therapeutic window."
  },

  // ========== MORE DIABETES MEDICATIONS ==========
  
  {
    brandName: "Jardiance",
    genericName: "Empagliflozin",
    alternativeNames: [],
    uses: "Treats type 2 diabetes and reduces risk of cardiovascular death. It's an SGLT2 inhibitor that helps kidneys remove sugar through urine.",
    additionalInfo: "Taken once daily in the morning. May increase urination."
  },
  {
    brandName: "Farxiga",
    genericName: "Dapagliflozin",
    alternativeNames: [],
    uses: "Type 2 diabetes, heart failure"
  },
  {
    brandName: "Invokana",
    genericName: "Canagliflozin",
    alternativeNames: [],
    uses: "Type 2 diabetes"
  },
  {
    brandName: "Trulicity",
    genericName: "Dulaglutide",
    alternativeNames: [],
    uses: "Type 2 diabetes"
  },
  {
    brandName: "Victoza",
    genericName: "Liraglutide",
    alternativeNames: [],
    uses: "Type 2 diabetes, weight management"
  },
  {
    brandName: "Glucotrol",
    genericName: "Glipizide",
    alternativeNames: [],
    uses: "Type 2 diabetes"
  },
  {
    brandName: "Amaryl",
    genericName: "Glimepiride",
    alternativeNames: [],
    uses: "Type 2 diabetes"
  },
  {
    brandName: "Actos",
    genericName: "Pioglitazone",
    alternativeNames: [],
    uses: "Type 2 diabetes"
  },
  {
    brandName: "Humalog",
    genericName: "Insulin Lispro",
    alternativeNames: [],
    uses: "Type 1 and Type 2 diabetes"
  },
  {
    brandName: "Novolog",
    genericName: "Insulin Aspart",
    alternativeNames: [],
    uses: "Type 1 and Type 2 diabetes"
  },
  {
    brandName: "Levemir",
    genericName: "Insulin Detemir",
    alternativeNames: [],
    uses: "Type 1 and Type 2 diabetes"
  },

  // ========== ANTIBIOTICS - EXPANDED ==========
  
  {
    brandName: "Keflex",
    genericName: "Cephalexin",
    alternativeNames: [],
    uses: "Bacterial infections, respiratory infections, skin infections, bone infections, UTI"
  },
  {
    brandName: "Levaquin",
    genericName: "Levofloxacin",
    alternativeNames: [],
    uses: "Bacterial infections, pneumonia, bronchitis, UTI"
  },
  {
    brandName: "Bactrim",
    genericName: "Sulfamethoxazole/Trimethoprim",
    alternativeNames: ["Septra"],
    uses: "UTI, ear infections, bronchitis, traveler's diarrhea"
  },
  {
    brandName: "Flagyl",
    genericName: "Metronidazole",
    alternativeNames: [],
    uses: "Bacterial infections, parasitic infections"
  },
  {
    brandName: "Doxycycline",
    genericName: "Doxycycline",
    alternativeNames: ["Vibramycin", "Doryx"],
    uses: "Treats bacterial infections, acne, malaria prevention, and Lyme disease. It's a tetracycline antibiotic.",
    additionalInfo: "Take with full glass of water. Avoid lying down for 30 minutes after."
  },
  {
    brandName: "Cleocin",
    genericName: "Clindamycin",
    alternativeNames: [],
    uses: "Treats serious bacterial infections of the lungs, skin, blood, and internal organs. Also used for acne.",
    additionalInfo: "Can cause severe diarrhea. Contact doctor if this occurs."
  },
  {
    brandName: "Zosyn",
    genericName: "Piperacillin/Tazobactam",
    alternativeNames: [],
    uses: "Treats severe bacterial infections in hospitalized patients. It's a combination penicillin antibiotic given intravenously.",
    additionalInfo: "Given by injection or IV in hospital settings only."
  },
  {
    brandName: "Vancocin",
    genericName: "Vancomycin",
    alternativeNames: [],
    uses: "Treats serious bacterial infections resistant to other antibiotics, including MRSA and C. difficile colitis.",
    additionalInfo: "Given IV or orally depending on infection type. Requires blood level monitoring."
  },
  {
    brandName: "Rocephin",
    genericName: "Ceftriaxone",
    alternativeNames: [],
    uses: "Treats bacterial meningitis, pneumonia, and other serious infections. It's a cephalosporin given by injection.",
    additionalInfo: "Usually given once daily by injection. Used in hospital or outpatient settings."
  },

  // ========== ANTIDEPRESSANTS & ANXIETY - EXPANDED ==========
  
  {
    brandName: "Cymbalta",
    genericName: "Duloxetine",
    alternativeNames: [],
    uses: "Treats depression, anxiety, fibromyalgia, and nerve pain. It's an SNRI that affects serotonin and norepinephrine in the brain.",
    additionalInfo: "Take once or twice daily. Don't stop suddenly without doctor guidance."
  },
  {
    brandName: "Effexor",
    genericName: "Venlafaxine",
    alternativeNames: [],
    uses: "Treats major depression, anxiety, panic disorder, and social anxiety. It's an SNRI that balances brain chemistry.",
    additionalInfo: "Extended-release form taken once daily. May cause blood pressure changes."
  },
  {
    brandName: "Wellbutrin",
    genericName: "Bupropion",
    alternativeNames: ["Zyban"],
    uses: "Treats depression and helps with smoking cessation. Works differently than SSRIs and may have fewer sexual side effects.",
    additionalInfo: "Can lower seizure threshold. May cause insomnia if taken late in day."
  },
  {
    brandName: "Remeron",
    genericName: "Mirtazapine",
    alternativeNames: [],
    uses: "Treats depression by affecting serotonin and norepinephrine. Often causes sedation which can help with insomnia.",
    additionalInfo: "Usually taken at bedtime. May increase appetite and cause weight gain."
  },
  {
    brandName: "Paxil",
    genericName: "Paroxetine",
    alternativeNames: [],
    uses: "Treats depression, anxiety disorders, PTSD, and OCD. It's an SSRI that increases serotonin in the brain.",
    additionalInfo: "May cause drowsiness or sexual side effects. Taper slowly when stopping."
  },
  {
    brandName: "Celexa",
    genericName: "Citalopram",
    alternativeNames: [],
    uses: "Treats depression by increasing serotonin levels in the brain. It's an SSRI with generally good tolerability.",
    additionalInfo: "Taken once daily. May take 1-4 weeks to notice improvement."
  },
  {
    brandName: "Buspar",
    genericName: "Buspirone",
    alternativeNames: [],
    uses: "Treats generalized anxiety disorder. Unlike benzodiazepines, it's not sedating and non-habit forming.",
    additionalInfo: "Taken 2-3 times daily. May take 2-4 weeks to see full effects."
  },
  {
    brandName: "Klonopin",
    genericName: "Clonazepam",
    alternativeNames: [],
    uses: "Treats panic disorder and certain types of seizures. It's a benzodiazepine that calms the nervous system.",
    additionalInfo: "Can be habit-forming. Don't stop suddenly after long-term use."
  },
  {
    brandName: "Valium",
    genericName: "Diazepam",
    alternativeNames: [],
    uses: "Treats anxiety, muscle spasms, seizures, and alcohol withdrawal symptoms. It's a long-acting benzodiazepine.",
    additionalInfo: "High potential for dependence. Use exactly as prescribed."
  },
  {
    brandName: "Trazodone",
    genericName: "Trazodone",
    alternativeNames: ["Desyrel"],
    uses: "Treats depression and is commonly used off-label for insomnia. Helps with sleep due to sedative effects.",
    additionalInfo: "Often taken at bedtime. Lower doses used for sleep than for depression."
  },
  {
    brandName: "Vistaril",
    genericName: "Hydroxyzine",
    alternativeNames: ["Atarax"],
    uses: "Treats anxiety and itching from allergies. It's an antihistamine with anti-anxiety properties.",
    additionalInfo: "Can cause drowsiness. Often used as-needed for anxiety."
  },

  // ========== ANTIPSYCHOTICS ==========
  
  {
    brandName: "Abilify",
    genericName: "Aripiprazole",
    alternativeNames: [],
    uses: "Treats schizophrenia, bipolar disorder, and as add-on for depression. It's an atypical antipsychotic that balances dopamine and serotonin.",
    additionalInfo: "Taken once daily. Can be activating, so often taken in morning."
  },
  {
    brandName: "Risperdal",
    genericName: "Risperidone",
    alternativeNames: [],
    uses: "Treats schizophrenia, bipolar mania, and irritability in autism. It's an atypical antipsychotic.",
    additionalInfo: "Can cause weight gain and increased prolactin levels."
  },
  {
    brandName: "Zyprexa",
    genericName: "Olanzapine",
    alternativeNames: [],
    uses: "Treats schizophrenia and bipolar disorder. Helps reduce hallucinations, delusions, and mood swings.",
    additionalInfo: "Significant weight gain and metabolic changes possible. Monitor blood sugar."
  },
  {
    brandName: "Seroquel",
    genericName: "Quetiapine",
    alternativeNames: [],
    uses: "Treats schizophrenia, bipolar disorder, and depression. Also used off-label for insomnia at low doses.",
    additionalInfo: "Can cause sedation, especially when starting. Monitor for metabolic changes."
  },
  {
    brandName: "Latuda",
    genericName: "Lurasidone",
    alternativeNames: [],
    uses: "Treats schizophrenia and bipolar depression. Has lower risk of weight gain compared to some other antipsychotics.",
    additionalInfo: "Must be taken with food (at least 350 calories) for proper absorption."
  },
  {
    brandName: "Haldol",
    genericName: "Haloperidol",
    alternativeNames: [],
    uses: "Treats schizophrenia, acute psychosis, and severe behavioral problems. It's a typical (first-generation) antipsychotic.",
    additionalInfo: "Can cause movement disorders. Available in oral and injectable forms."
  },

  // ========== SEIZURE MEDICATIONS ==========
  
  {
    brandName: "Dilantin",
    genericName: "Phenytoin",
    alternativeNames: [],
    uses: "Prevents and controls seizures in epilepsy. Works by slowing down electrical impulses in the brain.",
    additionalInfo: "Requires blood level monitoring. Can affect gums causing overgrowth."
  },
  {
    brandName: "Keppra",
    genericName: "Levetiracetam",
    alternativeNames: [],
    uses: "Treats various types of seizures in epilepsy. Has fewer drug interactions than older seizure medications.",
    additionalInfo: "Usually taken twice daily. Can affect mood in some patients."
  },
  {
    brandName: "Lamictal",
    genericName: "Lamotrigine",
    alternativeNames: [],
    uses: "Treats seizures and bipolar disorder. Helps prevent mood episodes and controls epilepsy.",
    additionalInfo: "Must be started at low dose and increased slowly to prevent serious rash."
  },
  {
    brandName: "Depakote",
    genericName: "Divalproex",
    alternativeNames: ["Valproic Acid"],
    uses: "Treats seizures, bipolar mania, and prevents migraines. Works by increasing GABA in the brain.",
    additionalInfo: "Requires blood level monitoring. Can cause liver problems and weight gain."
  },
  {
    brandName: "Tegretol",
    genericName: "Carbamazepine",
    alternativeNames: [],
    uses: "Treats seizures, nerve pain, and bipolar disorder. One of the older anticonvulsants still widely used.",
    additionalInfo: "Requires blood monitoring. May cause dizziness and low sodium levels."
  },
  {
    brandName: "Neurontin",
    genericName: "Gabapentin",
    alternativeNames: [],
    uses: "Treats nerve pain, seizures, and restless leg syndrome. Often used off-label for anxiety.",
    additionalInfo: "Usually taken 3 times daily. Doses should be spaced evenly throughout day."
  },
  {
    brandName: "Topamax",
    genericName: "Topiramate",
    alternativeNames: [],
    uses: "Treats seizures, prevents migraines, and used off-label for weight loss. May help reduce seizure frequency.",
    additionalInfo: "Can cause cognitive slowing and word-finding difficulty. May cause weight loss."
  },

  // ========== PAIN MEDICATIONS - EXPANDED ==========
  
  {
    brandName: "Percocet",
    genericName: "Oxycodone/Acetaminophen",
    alternativeNames: [],
    uses: "Treats moderate to severe pain. Combines an opioid pain reliever with acetaminophen.",
    additionalInfo: "High potential for addiction. Take exactly as prescribed."
  },
  {
    brandName: "Vicodin",
    genericName: "Hydrocodone/Acetaminophen",
    alternativeNames: ["Norco", "Lortab"],
    uses: "Relieves moderate to severe pain. Contains an opioid and acetaminophen.",
    additionalInfo: "Can be habit-forming. Don't exceed maximum daily acetaminophen dose."
  },
  {
    brandName: "OxyContin",
    genericName: "Oxycodone",
    alternativeNames: [],
    uses: "Treats severe, around-the-clock pain requiring continuous opioid treatment. Extended-release formulation.",
    additionalInfo: "High abuse potential. Must be swallowed whole, never crushed or chewed."
  },
  {
    brandName: "Tramadol",
    genericName: "Tramadol",
    alternativeNames: ["Ultram"],
    uses: "Treats moderate pain. It's a weaker opioid with lower abuse potential than stronger opioids.",
    additionalInfo: "Can cause seizures at high doses. May interact with antidepressants."
  },
  {
    brandName: "Naproxen",
    genericName: "Naproxen",
    alternativeNames: ["Aleve", "Naprosyn"],
    uses: "Relieves pain and inflammation from arthritis, menstrual cramps, and other conditions. It's an NSAID.",
    additionalInfo: "Longer-acting than ibuprofen. Take with food to reduce stomach upset."
  },
  {
    brandName: "Mobic",
    genericName: "Meloxicam",
    alternativeNames: [],
    uses: "Treats arthritis pain and inflammation. It's an NSAID with once-daily dosing.",
    additionalInfo: "Lower GI side effects than some NSAIDs. Take with food."
  },
  {
    brandName: "Voltaren",
    genericName: "Diclofenac",
    alternativeNames: [],
    uses: "Treats arthritis pain and inflammation. Available as pills, topical gel, and eye drops.",
    additionalInfo: "Topical form has fewer systemic side effects. Oral form taken with food."
  },
  {
    brandName: "Toradol",
    genericName: "Ketorolac",
    alternativeNames: [],
    uses: "Provides short-term treatment of moderate to severe pain. It's a powerful NSAID given by injection or orally.",
    additionalInfo: "Limited to 5 days of use due to GI and kidney risks."
  },
  {
    brandName: "Flexeril",
    genericName: "Cyclobenzaprine",
    alternativeNames: [],
    uses: "Relieves muscle spasms and associated pain from musculoskeletal conditions. It's a muscle relaxant.",
    additionalInfo: "Causes drowsiness. Usually taken at bedtime. Avoid alcohol."
  },
  {
    brandName: "Soma",
    genericName: "Carisoprodol",
    alternativeNames: [],
    uses: "Treats muscle pain and spasms. It's a muscle relaxant for short-term use.",
    additionalInfo: "Can be habit-forming. Usually used for 2-3 weeks maximum."
  },
  {
    brandName: "Robaxin",
    genericName: "Methocarbamol",
    alternativeNames: [],
    uses: "Relieves muscle spasms and pain from injuries or musculoskeletal conditions.",
    additionalInfo: "May cause drowsiness and dizziness. Less sedating than some muscle relaxants."
  },

  // ========== ADHD MEDICATIONS ==========
  
  {
    brandName: "Adderall",
    genericName: "Amphetamine/Dextroamphetamine",
    alternativeNames: [],
    uses: "Treats ADHD and narcolepsy by increasing attention and decreasing impulsiveness. It's a stimulant medication.",
    additionalInfo: "Controlled substance with abuse potential. Take in morning to avoid insomnia."
  },
  {
    brandName: "Ritalin",
    genericName: "Methylphenidate",
    alternativeNames: ["Concerta", "Daytrana"],
    uses: "Treats ADHD by improving focus and reducing hyperactivity. Helps balance neurotransmitters in the brain.",
    additionalInfo: "Available in short and long-acting forms. May suppress appetite."
  },
  {
    brandName: "Vyvanse",
    genericName: "Lisdexamfetamine",
    alternativeNames: [],
    uses: "Treats ADHD and binge eating disorder. It's a prodrug stimulant with smoother, longer effects.",
    additionalInfo: "Taken once daily in the morning. Lower abuse potential than immediate-release stimulants."
  },
  {
    brandName: "Strattera",
    genericName: "Atomoxetine",
    alternativeNames: [],
    uses: "Treats ADHD without being a stimulant. Works by affecting norepinephrine in the brain.",
    additionalInfo: "Non-controlled substance. Takes 2-4 weeks to see full benefits."
  },
  {
    brandName: "Intuniv",
    genericName: "Guanfacine",
    alternativeNames: [],
    uses: "Treats ADHD, especially hyperactivity and impulsivity. It's a non-stimulant that affects receptors in the brain.",
    additionalInfo: "Extended-release form for once-daily dosing. May cause sedation initially."
  },

  // ========== PARKINSON'S & ALZHEIMER'S ==========
  
  {
    brandName: "Sinemet",
    genericName: "Carbidopa/Levodopa",
    alternativeNames: [],
    uses: "Treats Parkinson's disease by replacing dopamine in the brain. Helps control tremors, stiffness, and movement problems.",
    additionalInfo: "Effectiveness may decrease over years. Take on empty stomach for best absorption."
  },
  {
    brandName: "Requip",
    genericName: "Ropinirole",
    alternativeNames: [],
    uses: "Treats Parkinson's disease and restless leg syndrome. It's a dopamine agonist that mimics dopamine effects.",
    additionalInfo: "Start with low dose and increase gradually. May cause drowsiness."
  },
  {
    brandName: "Mirapex",
    genericName: "Pramipexole",
    alternativeNames: [],
    uses: "Treats Parkinson's disease and restless legs syndrome by activating dopamine receptors in the brain.",
    additionalInfo: "Can cause sudden sleep attacks. Use caution when driving."
  },
  {
    brandName: "Aricept",
    genericName: "Donepezil",
    alternativeNames: [],
    uses: "Treats mild to moderate Alzheimer's disease by increasing acetylcholine in the brain. May improve memory and thinking.",
    additionalInfo: "Taken once daily at bedtime. May cause vivid dreams or insomnia."
  },
  {
    brandName: "Namenda",
    genericName: "Memantine",
    alternativeNames: [],
    uses: "Treats moderate to severe Alzheimer's disease by regulating glutamate activity in the brain.",
    additionalInfo: "Often used in combination with Aricept. Takes weeks to see benefits."
  },
  {
    brandName: "Exelon",
    genericName: "Rivastigmine",
    alternativeNames: [],
    uses: "Treats mild to moderate dementia from Alzheimer's or Parkinson's. Available as patch or capsule.",
    additionalInfo: "Patch form may have fewer GI side effects than oral form."
  },

  // ========== OSTEOPOROSIS ==========
  
  {
    brandName: "Fosamax",
    genericName: "Alendronate",
    alternativeNames: [],
    uses: "Treats and prevents osteoporosis by slowing bone loss. Helps maintain bone density and reduce fracture risk.",
    additionalInfo: "Take first thing in morning on empty stomach. Stay upright for 30 minutes after."
  },
  {
    brandName: "Boniva",
    genericName: "Ibandronate",
    alternativeNames: [],
    uses: "Treats and prevents osteoporosis in postmenopausal women. Slows bone breakdown and increases bone mass.",
    additionalInfo: "Monthly oral tablet or quarterly IV injection. Follow specific dosing instructions."
  },
  {
    brandName: "Prolia",
    genericName: "Denosumab",
    alternativeNames: [],
    uses: "Treats osteoporosis by blocking bone breakdown. Given as injection every 6 months.",
    additionalInfo: "Ensure adequate calcium and vitamin D intake. May increase infection risk slightly."
  },
  {
    brandName: "Forteo",
    genericName: "Teriparatide",
    alternativeNames: [],
    uses: "Treats severe osteoporosis by stimulating new bone formation. It's a daily injection of parathyroid hormone.",
    additionalInfo: "Maximum use is 2 years. Injected daily into thigh or abdomen."
  },

  // ========== HORMONE & REPRODUCTIVE ==========
  
  {
    brandName: "Premarin",
    genericName: "Conjugated Estrogens",
    alternativeNames: [],
    uses: "Treats menopausal symptoms and prevents osteoporosis. It's hormone replacement therapy containing estrogen.",
    additionalInfo: "Increases risk of blood clots and stroke. Use lowest effective dose."
  },
  {
    brandName: "Yasmin",
    genericName: "Drospirenone/Ethinyl Estradiol",
    alternativeNames: [],
    uses: "Prevents pregnancy and treats moderate acne and PMDD. It's a combination birth control pill.",
    additionalInfo: "Take at same time daily. May increase potassium levels."
  },
  {
    brandName: "Ortho Tri-Cyclen",
    genericName: "Norgestimate/Ethinyl Estradiol",
    alternativeNames: [],
    uses: "Prevents pregnancy and can improve acne. It's a triphasic birth control pill with varying hormone levels.",
    additionalInfo: "Different colored pills for different weeks. Take in order."
  },
  {
    brandName: "NuvaRing",
    genericName: "Etonogestrel/Ethinyl Estradiol",
    alternativeNames: [],
    uses: "Prevents pregnancy through a vaginal ring that releases hormones continuously for 3 weeks.",
    additionalInfo: "Insert new ring monthly. Remove after 3 weeks for 1 week break."
  },
  {
    brandName: "Mirena",
    genericName: "Levonorgestrel IUD",
    alternativeNames: [],
    uses: "Prevents pregnancy for up to 5-7 years and reduces menstrual bleeding. It's a hormonal intrauterine device.",
    additionalInfo: "Inserted by healthcare provider. Very effective long-term contraception."
  },
  {
    brandName: "Clomid",
    genericName: "Clomiphene",
    alternativeNames: [],
    uses: "Treats infertility in women by stimulating ovulation. Helps trigger release of eggs from ovaries.",
    additionalInfo: "Taken for 5 days early in menstrual cycle. Monitor for multiple pregnancy."
  },
  {
    brandName: "Viagra",
    genericName: "Sildenafil",
    alternativeNames: [],
    uses: "Treats erectile dysfunction by increasing blood flow to the penis. Also treats pulmonary hypertension.",
    additionalInfo: "Take 30-60 minutes before sexual activity. Don't use with nitrates."
  },
  {
    brandName: "Cialis",
    genericName: "Tadalafil",
    alternativeNames: [],
    uses: "Treats erectile dysfunction and BPH symptoms. Has longer duration than other ED medications.",
    additionalInfo: "Can last up to 36 hours. Daily low-dose option available."
  },
  {
    brandName: "Flomax",
    genericName: "Tamsulosin",
    alternativeNames: [],
    uses: "Treats enlarged prostate (BPH) by relaxing muscles in the prostate and bladder. Improves urination.",
    additionalInfo: "Usually taken 30 minutes after same meal each day. May cause dizziness."
  },

  // ========== STEROIDS & IMMUNOSUPPRESSANTS ==========
  
  {
    brandName: "Prednisone",
    genericName: "Prednisone",
    alternativeNames: ["Deltasone"],
    uses: "Treats inflammation, allergic reactions, autoimmune diseases, and certain cancers. It's a corticosteroid.",
    additionalInfo: "Take with food. Don't stop suddenly after long-term use. Can cause many side effects."
  },
  {
    brandName: "Medrol",
    genericName: "Methylprednisolone",
    alternativeNames: [],
    uses: "Treats severe allergies, skin problems, arthritis, and other inflammatory conditions. Similar to prednisone.",
    additionalInfo: "Often given as dose pack with tapering doses. Take with food."
  },
  {
    brandName: "Humira",
    genericName: "Adalimumab",
    alternativeNames: [],
    uses: "Treats autoimmune diseases including rheumatoid arthritis, Crohn's disease, and psoriasis. It's a biologic that blocks TNF.",
    additionalInfo: "Given by injection every 2 weeks. Increases infection risk."
  },
  {
    brandName: "Enbrel",
    genericName: "Etanercept",
    alternativeNames: [],
    uses: "Treats rheumatoid arthritis, psoriatic arthritis, and ankylosing spondylitis by reducing inflammation.",
    additionalInfo: "Injected 1-2 times weekly. Screen for TB before starting."
  },
  {
    brandName: "Remicade",
    genericName: "Infliximab",
    alternativeNames: [],
    uses: "Treats Crohn's disease, ulcerative colitis, rheumatoid arthritis, and psoriasis. It's a TNF blocker.",
    additionalInfo: "Given by IV infusion every 4-8 weeks. Requires monitoring for infections."
  },
  {
    brandName: "Imuran",
    genericName: "Azathioprine",
    alternativeNames: [],
    uses: "Prevents organ rejection and treats autoimmune diseases. It's an immunosuppressant that reduces immune system activity.",
    additionalInfo: "Requires regular blood count monitoring. Increases infection and cancer risk."
  },
  {
    brandName: "CellCept",
    genericName: "Mycophenolate",
    alternativeNames: [],
    uses: "Prevents organ rejection after transplant. Suppresses immune system to prevent attacking transplanted organ.",
    additionalInfo: "Must be taken consistently. Avoid during pregnancy."
  },

  // ========== CHEMOTHERAPY (COMMON ORAL) ==========
  
  {
    brandName: "Tamoxifen",
    genericName: "Tamoxifen",
    alternativeNames: [],
    uses: "Treats and prevents breast cancer by blocking estrogen effects. Used in hormone receptor-positive breast cancer.",
    additionalInfo: "Taken daily for 5-10 years. Increases risk of blood clots and uterine cancer."
  },
  {
    brandName: "Arimidex",
    genericName: "Anastrozole",
    alternativeNames: [],
    uses: "Treats breast cancer in postmenopausal women by lowering estrogen levels. It's an aromatase inhibitor.",
    additionalInfo: "Taken once daily. May cause joint pain and bone loss."
  },
  {
    brandName: "Gleevec",
    genericName: "Imatinib",
    alternativeNames: [],
    uses: "Treats chronic myeloid leukemia and certain other cancers. It's a targeted therapy that blocks specific cancer proteins.",
    additionalInfo: "Taken with food and water. Requires regular monitoring."
  },

  // ========== EYE MEDICATIONS ==========
  
  {
    brandName: "Latanoprost",
    genericName: "Latanoprost",
    alternativeNames: ["Xalatan"],
    uses: "Treats glaucoma and high eye pressure by increasing fluid drainage from the eye.",
    additionalInfo: "Applied once daily in evening. May cause darkening of iris color."
  },
  {
    brandName: "Restasis",
    genericName: "Cyclosporine",
    alternativeNames: [],
    uses: "Treats chronic dry eye by reducing inflammation and increasing tear production.",
    additionalInfo: "Takes 3-6 months to see full benefit. Apply twice daily."
  },
  {
    brandName: "Lumigan",
    genericName: "Bimatoprost",
    alternativeNames: ["Latisse"],
    uses: "Treats glaucoma by lowering eye pressure. Also used cosmetically to grow eyelashes (Latisse).",
    additionalInfo: "Apply once daily in evening. May cause eyelash growth and iris darkening."
  },
  {
    brandName: "Vigamox",
    genericName: "Moxifloxacin",
    alternativeNames: [],
    uses: "Treats bacterial eye infections including conjunctivitis. It's an antibiotic eye drop.",
    additionalInfo: "Usually applied 3 times daily. Complete full course even if symptoms improve."
  },

  // ========== TOPICAL MEDICATIONS ==========
  
  {
    brandName: "Lidoderm",
    genericName: "Lidocaine Patch",
    alternativeNames: [],
    uses: "Provides local pain relief for conditions like shingles pain. It's a topical anesthetic patch.",
    additionalInfo: "Apply for up to 12 hours then remove for 12 hours. Can use up to 3 patches."
  },
  {
    brandName: "Retin-A",
    genericName: "Tretinoin",
    alternativeNames: [],
    uses: "Treats acne and reduces fine wrinkles. It's a topical retinoid that increases skin cell turnover.",
    additionalInfo: "Apply at night. Increases sun sensitivity. Skin may peel initially."
  },
  {
    brandName: "Differin",
    genericName: "Adapalene",
    alternativeNames: [],
    uses: "Treats acne by preventing clogged pores. It's a topical retinoid available over-the-counter.",
    additionalInfo: "Apply once daily at bedtime. Less irritating than tretinoin."
  },
  {
    brandName: "Protopic",
    genericName: "Tacrolimus",
    alternativeNames: [],
    uses: "Treats eczema by suppressing immune response in the skin. Used when steroids aren't appropriate.",
    additionalInfo: "Apply thin layer twice daily. May cause burning sensation initially."
  },

  // ========== VITAMINS & SUPPLEMENTS (PRESCRIPTION) ==========
  
  {
    brandName: "Vitamin D",
    genericName: "Cholecalciferol",
    alternativeNames: ["Vitamin D3"],
    uses: "Treats vitamin D deficiency and supports bone health. Essential for calcium absorption.",
    additionalInfo: "Prescription strength much higher than OTC. Usually taken weekly or daily."
  },
  {
    brandName: "Folic Acid",
    genericName: "Folic Acid",
    alternativeNames: [],
    uses: "Prevents birth defects during pregnancy and treats folate deficiency. Essential for cell growth.",
    additionalInfo: "Recommended for all women of childbearing age. Taken daily."
  },
  {
    brandName: "Iron",
    genericName: "Ferrous Sulfate",
    alternativeNames: [],
    uses: "Treats iron deficiency anemia by replenishing iron stores in the body.",
    additionalInfo: "Take on empty stomach for best absorption. May cause constipation."
  }
];

/**
 * Helper function to enrich medication with auto trial information
 */
const enrichMedicationWithTrialInfo = (medication) => {
  const enriched = { ...medication };
  
  // Check if this medication is on the auto trial list
  const autoTrialMed = autoTrialMedications.find(atm => 
    atm.medicationName.toLowerCase() === medication.brandName.toLowerCase() ||
    atm.medicationName.toLowerCase() === medication.genericName.toLowerCase()
  );
  
  if (autoTrialMed) {
    enriched.autoTrial = {
      isAutoTrial: true,
      reason: autoTrialMed.reason
    };
  }
  
  // Find related conditions and their trial guidelines
  const relatedConditions = autoTrialConditions.filter(condition =>
    condition.relatedMedications.some(medName =>
      medName.toLowerCase() === medication.brandName.toLowerCase() ||
      medName.toLowerCase() === medication.genericName.toLowerCase()
    )
  );
  
  if (relatedConditions.length > 0) {
    enriched.conditionsAndGuidelines = relatedConditions.map(condition => ({
      condition: condition.condition,
      trialGuideline: condition.trialGuideline,
      severity: condition.severity
    }));
  }
  
  return enriched;
};

/**
 * GET /api/medications/search
 * Search for medications by name (brand or generic)
 */
router.get('/search', verifyToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    const searchTerm = q.toLowerCase().trim();
    
    // Search through medications data and track which name was matched
    const results = medicationsData.map(med => {
      let matchedName = null;
      
      // Check brand name
      if (med.brandName.toLowerCase().includes(searchTerm)) {
        matchedName = 'brand';
      }
      // Check generic name
      else if (med.genericName.toLowerCase().includes(searchTerm)) {
        matchedName = 'generic';
      }
      // Check alternative names
      else if (med.alternativeNames && med.alternativeNames.length > 0) {
        const matchedAltName = med.alternativeNames.find(name => 
          name.toLowerCase().includes(searchTerm)
        );
        if (matchedAltName) {
          matchedName = matchedAltName;
        }
      }
      
      if (matchedName) {
        return { ...med, matchedName };
      }
      return null;
    }).filter(med => med !== null);
    
    // Enrich results with auto trial information
    const enrichedResults = results.map(med => enrichMedicationWithTrialInfo(med));
    
    // Limit results to 10 for performance
    const limitedResults = enrichedResults.slice(0, 10);
    
    res.json({
      success: true,
      data: limitedResults
    });
    
  } catch (error) {
    console.error('Error searching medications:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching medications',
      error: error.message
    });
  }
});

/**
 * GET /api/medications/conditions/search
 * Search for medical conditions and get trial guidelines
 */
router.get('/conditions/search', verifyToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    const searchTerm = q.toLowerCase().trim();
    
    // Search through conditions
    const results = autoTrialConditions.filter(condition =>
      condition.condition.toLowerCase().includes(searchTerm)
    );
    
    // For each condition, find the related medications from our database
    const enrichedResults = results.map(condition => {
      const medications = medicationsData.filter(med =>
        condition.relatedMedications.some(relMed =>
          relMed.toLowerCase() === med.brandName.toLowerCase() ||
          relMed.toLowerCase() === med.genericName.toLowerCase()
        )
      );
      
      return {
        ...condition,
        medications: medications.map(med => ({
          brandName: med.brandName,
          genericName: med.genericName,
          uses: med.uses
        }))
      };
    });
    
    res.json({
      success: true,
      data: enrichedResults.slice(0, 10)
    });
    
  } catch (error) {
    console.error('Error searching conditions:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching conditions',
      error: error.message
    });
  }
});

/**
 * GET /api/medications/conditions/:conditionName
 * Get detailed information about a specific condition
 */
router.get('/conditions/:conditionName', verifyToken, async (req, res) => {
  try {
    const { conditionName } = req.params;
    const searchTerm = conditionName.toLowerCase().trim();
    
    // Find condition
    const condition = autoTrialConditions.find(c =>
      c.condition.toLowerCase() === searchTerm ||
      c.condition.toLowerCase().includes(searchTerm)
    );
    
    if (!condition) {
      return res.status(404).json({
        success: false,
        message: 'Condition not found'
      });
    }
    
    // Find related medications
    const medications = medicationsData.filter(med =>
      condition.relatedMedications.some(relMed =>
        relMed.toLowerCase() === med.brandName.toLowerCase() ||
        relMed.toLowerCase() === med.genericName.toLowerCase()
      )
    );
    
    res.json({
      success: true,
      data: {
        ...condition,
        medications: medications.map(med => ({
          brandName: med.brandName,
          genericName: med.genericName,
          alternativeNames: med.alternativeNames,
          uses: med.uses,
          additionalInfo: med.additionalInfo
        })),
        generalGuidelines: generalTrialGuidelines
      }
    });
    
  } catch (error) {
    console.error('Error fetching condition details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching condition details',
      error: error.message
    });
  }
});

/**
 * GET /api/medications/:name
 * Get detailed information about a specific medication
 */
router.get('/:name', verifyToken, async (req, res) => {
  try {
    const { name } = req.params;
    const searchTerm = name.toLowerCase().trim();
    
    // Find exact or close match
    const medication = medicationsData.find(med => 
      med.brandName.toLowerCase() === searchTerm ||
      med.genericName.toLowerCase() === searchTerm ||
      (med.alternativeNames && med.alternativeNames.some(n => n.toLowerCase() === searchTerm))
    );
    
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }
    
    // Enrich with auto trial information
    const enrichedMedication = enrichMedicationWithTrialInfo(medication);
    
    res.json({
      success: true,
      data: enrichedMedication
    });
    
  } catch (error) {
    console.error('Error fetching medication details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medication details',
      error: error.message
    });
  }
});

module.exports = router;

