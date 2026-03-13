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
  },

  // ========== MIGRAINE MEDICATIONS ==========

  {
    brandName: "Imitrex",
    genericName: "Sumatriptan",
    alternativeNames: [],
    uses: "Treats migraine headaches with or without aura. Relieves headache, nausea, and sensitivity to light/sound.",
    additionalInfo: "Take at first sign of migraine. Do not use more than 2 doses in 24 hours."
  },
  {
    brandName: "Maxalt",
    genericName: "Rizatriptan",
    alternativeNames: [],
    uses: "Treats acute migraine attacks. Works by narrowing blood vessels in the brain.",
    additionalInfo: "Available as regular tablet and orally disintegrating tablet."
  },
  {
    brandName: "Zomig",
    genericName: "Zolmitriptan",
    alternativeNames: [],
    uses: "Treats migraine headaches. Available as tablet, orally disintegrating tablet, and nasal spray.",
    additionalInfo: "Do not use within 24 hours of ergotamine-type medications."
  },
  {
    brandName: "Relpax",
    genericName: "Eletriptan",
    alternativeNames: [],
    uses: "Treats acute migraine headaches in adults.",
    additionalInfo: "Take with fluids at first sign of migraine."
  },
  {
    brandName: "Aimovig",
    genericName: "Erenumab",
    alternativeNames: [],
    uses: "Prevents migraine headaches in adults. Monthly injection that blocks CGRP receptor.",
    additionalInfo: "Self-injected once monthly. First FDA-approved CGRP inhibitor for migraine prevention."
  },
  {
    brandName: "Ajovy",
    genericName: "Fremanezumab",
    alternativeNames: [],
    uses: "Prevents migraine headaches. Can be given monthly or quarterly.",
    additionalInfo: "Self-injected. Available as monthly or quarterly dosing schedule."
  },
  {
    brandName: "Emgality",
    genericName: "Galcanezumab",
    alternativeNames: [],
    uses: "Prevents migraine headaches and treats episodic cluster headaches.",
    additionalInfo: "Self-injected once monthly after initial loading dose."
  },
  {
    brandName: "Nurtec",
    genericName: "Rimegepant",
    alternativeNames: [],
    uses: "Treats acute migraine and prevents episodic migraine. Oral CGRP antagonist.",
    additionalInfo: "Orally disintegrating tablet. Can be used for both acute treatment and prevention."
  },
  {
    brandName: "Ubrelvy",
    genericName: "Ubrogepant",
    alternativeNames: [],
    uses: "Treats acute migraine with or without aura in adults.",
    additionalInfo: "Oral CGRP antagonist. May take a second dose after 2 hours if needed."
  },
  {
    brandName: "Fioricet",
    genericName: "Butalbital/Acetaminophen/Caffeine",
    alternativeNames: [],
    uses: "Treats tension headaches. Combination of a barbiturate, pain reliever, and caffeine.",
    additionalInfo: "Can be habit-forming. Limit use to avoid rebound headaches."
  },

  // ========== GOUT MEDICATIONS ==========

  {
    brandName: "Allopurinol",
    genericName: "Allopurinol",
    alternativeNames: ["Zyloprim"],
    uses: "Prevents gout attacks by lowering uric acid levels in the blood.",
    additionalInfo: "Take daily even when not having an attack. May initially trigger a flare when starting."
  },
  {
    brandName: "Colchicine",
    genericName: "Colchicine",
    alternativeNames: ["Colcrys", "Mitigare"],
    uses: "Treats and prevents gout flares by reducing inflammation. Also used for familial Mediterranean fever.",
    additionalInfo: "Take at first sign of gout attack. Lower doses are now recommended."
  },
  {
    brandName: "Uloric",
    genericName: "Febuxostat",
    alternativeNames: [],
    uses: "Lowers uric acid levels to prevent gout attacks. Alternative for those who can't take allopurinol.",
    additionalInfo: "Taken once daily. May increase cardiovascular risk compared to allopurinol."
  },
  {
    brandName: "Probenecid",
    genericName: "Probenecid",
    alternativeNames: [],
    uses: "Treats chronic gout by helping kidneys remove uric acid from the body.",
    additionalInfo: "Drink plenty of fluids. Not for use during acute gout attacks."
  },

  // ========== ANTIFUNGAL MEDICATIONS ==========

  {
    brandName: "Diflucan",
    genericName: "Fluconazole",
    alternativeNames: [],
    uses: "Treats fungal infections including yeast infections, thrush, and systemic fungal infections.",
    additionalInfo: "Single dose often effective for vaginal yeast infections."
  },
  {
    brandName: "Lamisil",
    genericName: "Terbinafine",
    alternativeNames: [],
    uses: "Treats fungal infections of fingernails and toenails. Also treats athlete's foot and jock itch.",
    additionalInfo: "Oral treatment for nail fungus takes 6-12 weeks. Monitor liver function."
  },
  {
    brandName: "Nystatin",
    genericName: "Nystatin",
    alternativeNames: ["Mycostatin"],
    uses: "Treats oral thrush and skin/intestinal fungal infections. Available as suspension, tablet, and cream.",
    additionalInfo: "Swish and swallow for oral thrush. Not absorbed systemically."
  },
  {
    brandName: "Nizoral",
    genericName: "Ketoconazole",
    alternativeNames: [],
    uses: "Treats fungal infections of the skin, hair, and nails. Available as cream and shampoo.",
    additionalInfo: "Topical form commonly used for dandruff and seborrheic dermatitis."
  },
  {
    brandName: "Sporanox",
    genericName: "Itraconazole",
    alternativeNames: [],
    uses: "Treats serious fungal infections including aspergillosis, blastomycosis, and nail fungus.",
    additionalInfo: "Take capsules with food. Oral solution on empty stomach."
  },

  // ========== ANTIVIRAL MEDICATIONS ==========

  {
    brandName: "Valtrex",
    genericName: "Valacyclovir",
    alternativeNames: [],
    uses: "Treats herpes simplex (cold sores, genital herpes) and shingles. Reduces outbreak severity and duration.",
    additionalInfo: "Start at first sign of outbreak. Can be taken daily for suppression."
  },
  {
    brandName: "Zovirax",
    genericName: "Acyclovir",
    alternativeNames: [],
    uses: "Treats herpes virus infections including cold sores, genital herpes, shingles, and chickenpox.",
    additionalInfo: "Available as oral, topical, and IV forms. Drink plenty of water."
  },
  {
    brandName: "Tamiflu",
    genericName: "Oseltamivir",
    alternativeNames: [],
    uses: "Treats and prevents influenza (flu). Most effective when started within 48 hours of symptoms.",
    additionalInfo: "Take for 5 days for treatment. Can be used for prevention during outbreaks."
  },
  {
    brandName: "Harvoni",
    genericName: "Ledipasvir/Sofosbuvir",
    alternativeNames: [],
    uses: "Cures hepatitis C infection. Combination antiviral taken for 8-24 weeks.",
    additionalInfo: "Cure rates over 95%. Taken once daily with or without food."
  },
  {
    brandName: "Epivir",
    genericName: "Lamivudine",
    alternativeNames: ["3TC"],
    uses: "Treats HIV and chronic hepatitis B. Used as part of combination antiretroviral therapy.",
    additionalInfo: "Must be taken consistently. Do not stop without medical guidance."
  },
  {
    brandName: "Truvada",
    genericName: "Emtricitabine/Tenofovir",
    alternativeNames: [],
    uses: "Treats HIV and used for pre-exposure prophylaxis (PrEP) to prevent HIV infection.",
    additionalInfo: "For PrEP, take daily. Requires regular kidney function and HIV testing."
  },
  {
    brandName: "Paxlovid",
    genericName: "Nirmatrelvir/Ritonavir",
    alternativeNames: [],
    uses: "Treats mild to moderate COVID-19 in adults at high risk of severe illness.",
    additionalInfo: "Must be started within 5 days of symptoms. Many drug interactions."
  },

  // ========== GI / DIGESTIVE MEDICATIONS ==========

  {
    brandName: "Linzess",
    genericName: "Linaclotide",
    alternativeNames: [],
    uses: "Treats irritable bowel syndrome with constipation (IBS-C) and chronic constipation.",
    additionalInfo: "Take on empty stomach 30 minutes before first meal. May cause diarrhea."
  },
  {
    brandName: "Bentyl",
    genericName: "Dicyclomine",
    alternativeNames: [],
    uses: "Treats irritable bowel syndrome by reducing muscle spasms in the gut.",
    additionalInfo: "Take 30 minutes before meals. May cause dry mouth and drowsiness."
  },
  {
    brandName: "Lomotil",
    genericName: "Diphenoxylate/Atropine",
    alternativeNames: [],
    uses: "Treats diarrhea by slowing bowel movements.",
    additionalInfo: "Controlled substance. Take as directed, do not exceed recommended dose."
  },
  {
    brandName: "Imodium",
    genericName: "Loperamide",
    alternativeNames: [],
    uses: "Treats diarrhea by slowing intestinal movement. Available over-the-counter.",
    additionalInfo: "Do not exceed recommended dose. Seek medical help for bloody diarrhea."
  },
  {
    brandName: "Miralax",
    genericName: "Polyethylene Glycol 3350",
    alternativeNames: [],
    uses: "Treats occasional constipation by drawing water into the colon to soften stool.",
    additionalInfo: "Mix with any beverage. Usually produces bowel movement in 1-3 days."
  },
  {
    brandName: "Dulcolax",
    genericName: "Bisacodyl",
    alternativeNames: [],
    uses: "Treats constipation by stimulating bowel movements.",
    additionalInfo: "Do not crush tablets. Effect usually within 6-12 hours (oral) or 15-60 minutes (rectal)."
  },
  {
    brandName: "Reglan",
    genericName: "Metoclopramide",
    alternativeNames: [],
    uses: "Treats gastroparesis, nausea, vomiting, and acid reflux by speeding stomach emptying.",
    additionalInfo: "Limit use to 12 weeks. May cause involuntary movements with long-term use."
  },
  {
    brandName: "Zofran",
    genericName: "Ondansetron",
    alternativeNames: [],
    uses: "Prevents nausea and vomiting from surgery, chemotherapy, and radiation. Very effective anti-emetic.",
    additionalInfo: "Available as tablet, orally disintegrating tablet, and injection."
  },
  {
    brandName: "Phenergan",
    genericName: "Promethazine",
    alternativeNames: [],
    uses: "Treats nausea, vomiting, motion sickness, and allergic reactions. Also used as sedative before surgery.",
    additionalInfo: "Causes drowsiness. Available as tablet, suppository, and injection."
  },
  {
    brandName: "Carafate",
    genericName: "Sucralfate",
    alternativeNames: [],
    uses: "Treats and prevents stomach and duodenal ulcers by forming a protective coating over the ulcer.",
    additionalInfo: "Take on empty stomach 1 hour before meals. May interfere with other medications."
  },
  {
    brandName: "Protonix",
    genericName: "Pantoprazole",
    alternativeNames: [],
    uses: "Treats GERD, erosive esophagitis, and conditions causing excess stomach acid.",
    additionalInfo: "Proton pump inhibitor. Take before eating. Swallow whole, don't crush."
  },
  {
    brandName: "Prevacid",
    genericName: "Lansoprazole",
    alternativeNames: [],
    uses: "Treats GERD, stomach ulcers, and Zollinger-Ellison syndrome.",
    additionalInfo: "Take before eating. Available as capsule and orally disintegrating tablet."
  },
  {
    brandName: "Dexilant",
    genericName: "Dexlansoprazole",
    alternativeNames: [],
    uses: "Treats GERD and erosive esophagitis. Dual-release proton pump inhibitor.",
    additionalInfo: "Can be taken without regard to food. Capsule can be opened and sprinkled on applesauce."
  },
  {
    brandName: "Xifaxan",
    genericName: "Rifaximin",
    alternativeNames: [],
    uses: "Treats traveler's diarrhea, IBS with diarrhea, and hepatic encephalopathy.",
    additionalInfo: "Works locally in the gut with minimal systemic absorption."
  },

  // ========== URINARY / KIDNEY MEDICATIONS ==========

  {
    brandName: "Macrobid",
    genericName: "Nitrofurantoin",
    alternativeNames: ["Macrodantin"],
    uses: "Treats and prevents urinary tract infections. Only effective for UTIs, not other infections.",
    additionalInfo: "Take with food. Complete full course even if feeling better."
  },
  {
    brandName: "Pyridium",
    genericName: "Phenazopyridine",
    alternativeNames: ["Azo"],
    uses: "Relieves urinary pain, burning, and urgency from UTIs or other urinary tract irritation.",
    additionalInfo: "Turns urine orange/red. Only for symptom relief, does not treat infection."
  },
  {
    brandName: "Detrol",
    genericName: "Tolterodine",
    alternativeNames: [],
    uses: "Treats overactive bladder with symptoms of urinary urgency, frequency, and incontinence.",
    additionalInfo: "May cause dry mouth and constipation. Extended-release form taken once daily."
  },
  {
    brandName: "Vesicare",
    genericName: "Solifenacin",
    alternativeNames: [],
    uses: "Treats overactive bladder by relaxing the bladder muscle.",
    additionalInfo: "Taken once daily. May cause dry mouth, constipation, and blurred vision."
  },
  {
    brandName: "Myrbetriq",
    genericName: "Mirabegron",
    alternativeNames: [],
    uses: "Treats overactive bladder. Works differently than anticholinergics with fewer dry mouth side effects.",
    additionalInfo: "Taken once daily. May increase blood pressure."
  },
  {
    brandName: "Ditropan",
    genericName: "Oxybutynin",
    alternativeNames: [],
    uses: "Treats overactive bladder, urinary incontinence, and frequent urination.",
    additionalInfo: "Available as tablet, syrup, and topical patch/gel. Patch has fewer side effects."
  },

  // ========== RESPIRATORY - EXPANDED ==========

  {
    brandName: "Spiriva",
    genericName: "Tiotropium",
    alternativeNames: [],
    uses: "Treats COPD and asthma by relaxing airways for easier breathing. Long-acting bronchodilator.",
    additionalInfo: "Inhaled once daily. Not for acute breathing problems."
  },
  {
    brandName: "Symbicort",
    genericName: "Budesonide/Formoterol",
    alternativeNames: [],
    uses: "Treats asthma and COPD. Combination of a corticosteroid and long-acting bronchodilator.",
    additionalInfo: "Inhaled twice daily. Rinse mouth after use to prevent thrush."
  },
  {
    brandName: "Breo Ellipta",
    genericName: "Fluticasone/Vilanterol",
    alternativeNames: [],
    uses: "Treats asthma and COPD with once-daily inhaler dosing.",
    additionalInfo: "Once daily inhaler. Do not use for sudden breathing problems."
  },
  {
    brandName: "Dulera",
    genericName: "Mometasone/Formoterol",
    alternativeNames: [],
    uses: "Treats asthma by reducing inflammation and opening airways.",
    additionalInfo: "Inhaled twice daily. Rinse mouth after each use."
  },
  {
    brandName: "Trelegy Ellipta",
    genericName: "Fluticasone/Umeclidinium/Vilanterol",
    alternativeNames: [],
    uses: "Triple therapy inhaler for COPD. Combines three medications in one inhaler.",
    additionalInfo: "Once daily. Do not use for acute bronchospasm."
  },
  {
    brandName: "Combivent",
    genericName: "Ipratropium/Albuterol",
    alternativeNames: [],
    uses: "Treats COPD by combining two types of bronchodilators for better airway opening.",
    additionalInfo: "Used 4 times daily by inhaler. Not intended for asthma."
  },
  {
    brandName: "Atrovent",
    genericName: "Ipratropium",
    alternativeNames: [],
    uses: "Treats COPD symptoms by relaxing airway muscles. Available as inhaler and nasal spray.",
    additionalInfo: "Nasal spray also used for runny nose from colds and allergies."
  },
  {
    brandName: "Qvar",
    genericName: "Beclomethasone",
    alternativeNames: [],
    uses: "Prevents asthma attacks by reducing airway inflammation. Inhaled corticosteroid.",
    additionalInfo: "Not for acute attacks. Use daily for best results."
  },
  {
    brandName: "Pulmicort",
    genericName: "Budesonide",
    alternativeNames: [],
    uses: "Prevents asthma attacks. Available as inhaler and nebulizer solution for children.",
    additionalInfo: "Rinse mouth after use. Nebulizer form commonly used in young children."
  },
  {
    brandName: "Tessalon",
    genericName: "Benzonatate",
    alternativeNames: [],
    uses: "Relieves cough by numbing the throat and lungs. Non-narcotic cough suppressant.",
    additionalInfo: "Swallow capsules whole, do not chew or dissolve. Can cause numbness if broken."
  },
  {
    brandName: "Mucinex",
    genericName: "Guaifenesin",
    alternativeNames: [],
    uses: "Thins and loosens mucus in the airways to relieve chest congestion.",
    additionalInfo: "Drink extra fluids while taking. Available over-the-counter."
  },
  {
    brandName: "Robitussin DM",
    genericName: "Dextromethorphan/Guaifenesin",
    alternativeNames: [],
    uses: "Treats cough and chest congestion. Combines a cough suppressant with an expectorant.",
    additionalInfo: "Available over-the-counter. Do not use with MAO inhibitors."
  },

  // ========== WEIGHT LOSS MEDICATIONS ==========

  {
    brandName: "Wegovy",
    genericName: "Semaglutide",
    alternativeNames: [],
    uses: "Treats obesity and overweight with weight-related conditions. Weekly injection that reduces appetite.",
    additionalInfo: "Injected once weekly. Dose gradually increased over 16-20 weeks."
  },
  {
    brandName: "Mounjaro",
    genericName: "Tirzepatide",
    alternativeNames: ["Zepbound"],
    uses: "Treats type 2 diabetes and obesity. Dual GIP/GLP-1 receptor agonist for significant weight loss.",
    additionalInfo: "Injected once weekly. May cause nausea, especially when starting."
  },
  {
    brandName: "Saxenda",
    genericName: "Liraglutide",
    alternativeNames: [],
    uses: "Treats obesity by reducing appetite. Daily injection version of GLP-1 agonist for weight management.",
    additionalInfo: "Injected daily. Gradually increase dose over 5 weeks."
  },
  {
    brandName: "Contrave",
    genericName: "Naltrexone/Bupropion",
    alternativeNames: [],
    uses: "Treats obesity by reducing appetite and cravings. Combination of two medications.",
    additionalInfo: "Oral tablet taken twice daily. Gradually increase dose over 4 weeks."
  },
  {
    brandName: "Qsymia",
    genericName: "Phentermine/Topiramate",
    alternativeNames: [],
    uses: "Treats obesity by suppressing appetite. Combination of a stimulant and anticonvulsant.",
    additionalInfo: "Take in morning to avoid insomnia. Requires REMS program enrollment."
  },
  {
    brandName: "Xenical",
    genericName: "Orlistat",
    alternativeNames: ["Alli"],
    uses: "Treats obesity by blocking fat absorption in the gut. Available OTC as Alli at lower dose.",
    additionalInfo: "Take with meals containing fat. May cause oily stools and GI side effects."
  },

  // ========== SMOKING CESSATION ==========

  {
    brandName: "Chantix",
    genericName: "Varenicline",
    alternativeNames: [],
    uses: "Helps adults quit smoking by reducing cravings and withdrawal symptoms.",
    additionalInfo: "Start 1 week before quit date. Typical course is 12 weeks."
  },
  {
    brandName: "Nicotine Patch",
    genericName: "Nicotine Transdermal",
    alternativeNames: ["NicoDerm CQ", "Habitrol"],
    uses: "Helps quit smoking by providing controlled nicotine to reduce withdrawal symptoms.",
    additionalInfo: "Apply to clean, dry skin daily. Step-down dosing over 8-12 weeks."
  },

  // ========== BIPOLAR & MOOD STABILIZERS ==========

  {
    brandName: "Lithium",
    genericName: "Lithium Carbonate",
    alternativeNames: ["Lithobid", "Eskalith"],
    uses: "Treats bipolar disorder by stabilizing mood swings. Prevents both manic and depressive episodes.",
    additionalInfo: "Requires regular blood level monitoring. Stay hydrated and maintain salt intake."
  },
  {
    brandName: "Geodon",
    genericName: "Ziprasidone",
    alternativeNames: [],
    uses: "Treats schizophrenia and acute bipolar mania. Atypical antipsychotic with lower weight gain risk.",
    additionalInfo: "Must be taken with food (500+ calories) for absorption. Monitor heart rhythm."
  },
  {
    brandName: "Vraylar",
    genericName: "Cariprazine",
    alternativeNames: [],
    uses: "Treats schizophrenia and bipolar disorder including bipolar depression.",
    additionalInfo: "Long-acting in the body. Effects may persist for weeks after stopping."
  },

  // ========== MULTIPLE SCLEROSIS ==========

  {
    brandName: "Copaxone",
    genericName: "Glatiramer",
    alternativeNames: [],
    uses: "Treats relapsing forms of multiple sclerosis by modifying the immune response.",
    additionalInfo: "Given by injection. May cause injection site reactions."
  },
  {
    brandName: "Tecfidera",
    genericName: "Dimethyl Fumarate",
    alternativeNames: [],
    uses: "Treats relapsing forms of multiple sclerosis. Oral medication that reduces inflammation.",
    additionalInfo: "Take with food to reduce GI side effects. Requires blood monitoring."
  },
  {
    brandName: "Ocrevus",
    genericName: "Ocrelizumab",
    alternativeNames: [],
    uses: "Treats relapsing and primary progressive multiple sclerosis. Given as IV infusion.",
    additionalInfo: "Infused every 6 months. Pre-medicate to prevent infusion reactions."
  },
  {
    brandName: "Tysabri",
    genericName: "Natalizumab",
    alternativeNames: [],
    uses: "Treats relapsing multiple sclerosis and Crohn's disease. Very effective but carries serious risks.",
    additionalInfo: "Given by IV infusion every 4 weeks. Risk of rare brain infection (PML)."
  },
  {
    brandName: "Aubagio",
    genericName: "Teriflunomide",
    alternativeNames: [],
    uses: "Treats relapsing forms of multiple sclerosis. Oral tablet taken once daily.",
    additionalInfo: "Can cause liver problems. Requires liver function monitoring."
  },

  // ========== SKIN CONDITIONS ==========

  {
    brandName: "Otezla",
    genericName: "Apremilast",
    alternativeNames: [],
    uses: "Treats psoriasis and psoriatic arthritis by reducing inflammation.",
    additionalInfo: "Oral tablet. Gradually increase dose over first 5 days."
  },
  {
    brandName: "Dupixent",
    genericName: "Dupilumab",
    alternativeNames: [],
    uses: "Treats moderate to severe eczema, asthma, and nasal polyps. Biologic that blocks certain immune signals.",
    additionalInfo: "Self-injected every 2 weeks. May cause eye inflammation."
  },
  {
    brandName: "Skyrizi",
    genericName: "Risankizumab",
    alternativeNames: [],
    uses: "Treats moderate to severe plaque psoriasis and psoriatic arthritis.",
    additionalInfo: "Injected every 12 weeks after initial doses. IL-23 inhibitor."
  },
  {
    brandName: "Cosentyx",
    genericName: "Secukinumab",
    alternativeNames: [],
    uses: "Treats psoriasis, psoriatic arthritis, and ankylosing spondylitis.",
    additionalInfo: "Self-injected. Monthly dosing after initial loading phase."
  },
  {
    brandName: "Eucrisa",
    genericName: "Crisaborole",
    alternativeNames: [],
    uses: "Treats mild to moderate eczema. Non-steroidal topical anti-inflammatory.",
    additionalInfo: "Apply thin layer twice daily. May cause stinging at application site."
  },
  {
    brandName: "Stelara",
    genericName: "Ustekinumab",
    alternativeNames: [],
    uses: "Treats psoriasis, psoriatic arthritis, and Crohn's disease. Biologic targeting IL-12 and IL-23.",
    additionalInfo: "Injected every 12 weeks after initial doses. Screen for TB before starting."
  },

  // ========== ADDITIONAL BLOOD PRESSURE ==========

  {
    brandName: "Losartan",
    genericName: "Losartan",
    alternativeNames: ["Cozaar"],
    uses: "Treats high blood pressure, diabetic kidney disease, and reduces stroke risk.",
    additionalInfo: "ARB class medication. May be combined with hydrochlorothiazide."
  },
  {
    brandName: "Ramipril",
    genericName: "Ramipril",
    alternativeNames: ["Altace"],
    uses: "Treats high blood pressure and heart failure. Reduces risk of heart attack and stroke.",
    additionalInfo: "ACE inhibitor. May cause dry cough. Monitor kidney function and potassium."
  },
  {
    brandName: "Enalapril",
    genericName: "Enalapril",
    alternativeNames: ["Vasotec"],
    uses: "Treats high blood pressure and heart failure.",
    additionalInfo: "ACE inhibitor. Monitor kidney function and electrolytes."
  },
  {
    brandName: "Atenolol",
    genericName: "Atenolol",
    alternativeNames: ["Tenormin"],
    uses: "Treats high blood pressure, angina, and used after heart attacks.",
    additionalInfo: "Beta-blocker. Do not stop suddenly. May mask low blood sugar symptoms."
  },
  {
    brandName: "Propranolol",
    genericName: "Propranolol",
    alternativeNames: ["Inderal"],
    uses: "Treats high blood pressure, tremors, anxiety symptoms, and prevents migraines.",
    additionalInfo: "Non-selective beta-blocker. Also used for performance anxiety and hemangiomas."
  },
  {
    brandName: "Clonidine",
    genericName: "Clonidine",
    alternativeNames: ["Catapres", "Kapvay"],
    uses: "Treats high blood pressure, ADHD, and opioid withdrawal symptoms.",
    additionalInfo: "Available as tablet and transdermal patch. Do not stop suddenly."
  },
  {
    brandName: "Spironolactone",
    genericName: "Spironolactone",
    alternativeNames: ["Aldactone"],
    uses: "Treats heart failure, high blood pressure, fluid retention, and hormonal acne in women.",
    additionalInfo: "Potassium-sparing diuretic. Monitor potassium levels. Avoid potassium supplements."
  },
  {
    brandName: "Entresto",
    genericName: "Sacubitril/Valsartan",
    alternativeNames: [],
    uses: "Treats chronic heart failure with reduced ejection fraction. Reduces hospitalizations and death.",
    additionalInfo: "Do not use with ACE inhibitors. Allow 36-hour washout period from ACE inhibitor."
  },

  // ========== ADDITIONAL CHOLESTEROL ==========

  {
    brandName: "Pravachol",
    genericName: "Pravastatin",
    alternativeNames: [],
    uses: "Lowers cholesterol and reduces risk of heart attack and stroke.",
    additionalInfo: "Can be taken any time of day. Fewer drug interactions than some statins."
  },
  {
    brandName: "Livalo",
    genericName: "Pitavastatin",
    alternativeNames: [],
    uses: "Lowers cholesterol. May be better tolerated in some patients than other statins.",
    additionalInfo: "Fewer drug interactions. Can be taken any time of day."
  },
  {
    brandName: "Repatha",
    genericName: "Evolocumab",
    alternativeNames: [],
    uses: "Lowers LDL cholesterol significantly. PCSK9 inhibitor for patients who need more than statins.",
    additionalInfo: "Self-injected every 2 weeks or monthly. Very expensive without insurance."
  },
  {
    brandName: "Praluent",
    genericName: "Alirocumab",
    alternativeNames: [],
    uses: "Lowers LDL cholesterol. PCSK9 inhibitor used when statins alone are not enough.",
    additionalInfo: "Self-injected every 2 weeks. Requires prior authorization from most insurers."
  },
  {
    brandName: "Tricor",
    genericName: "Fenofibrate",
    alternativeNames: ["Trilipix"],
    uses: "Lowers triglycerides and raises HDL cholesterol. Often used with a statin.",
    additionalInfo: "Take with food. Monitor liver function tests."
  },
  {
    brandName: "Niaspan",
    genericName: "Niacin",
    alternativeNames: ["Vitamin B3"],
    uses: "Lowers cholesterol and triglycerides. Raises HDL (good cholesterol).",
    additionalInfo: "Flushing is common. Take aspirin 30 minutes before to reduce flushing."
  },
  {
    brandName: "Vascepa",
    genericName: "Icosapent Ethyl",
    alternativeNames: [],
    uses: "Lowers triglycerides and reduces cardiovascular risk. Purified EPA omega-3 fatty acid.",
    additionalInfo: "Take with food. Does not raise LDL cholesterol like fish oil supplements."
  },

  // ========== ADDITIONAL THYROID ==========

  {
    brandName: "Armour Thyroid",
    genericName: "Thyroid Desiccated",
    alternativeNames: ["NP Thyroid", "Nature-Throid"],
    uses: "Treats hypothyroidism using natural thyroid hormone from pork thyroid glands.",
    additionalInfo: "Contains both T4 and T3. Some patients prefer this over synthetic options."
  },
  {
    brandName: "Cytomel",
    genericName: "Liothyronine",
    alternativeNames: [],
    uses: "Treats hypothyroidism by providing T3 thyroid hormone. Sometimes added to levothyroxine.",
    additionalInfo: "Faster acting than levothyroxine. Usually taken once or twice daily."
  },
  {
    brandName: "Methimazole",
    genericName: "Methimazole",
    alternativeNames: ["Tapazole"],
    uses: "Treats hyperthyroidism by reducing thyroid hormone production.",
    additionalInfo: "Taken 1-3 times daily. Requires regular blood monitoring."
  },
  {
    brandName: "PTU",
    genericName: "Propylthiouracil",
    alternativeNames: [],
    uses: "Treats hyperthyroidism. Preferred over methimazole during first trimester of pregnancy.",
    additionalInfo: "Risk of liver damage. Monitor liver function."
  },

  // ========== NAUSEA / MOTION SICKNESS ==========

  {
    brandName: "Dramamine",
    genericName: "Dimenhydrinate",
    alternativeNames: [],
    uses: "Prevents and treats motion sickness, nausea, and dizziness.",
    additionalInfo: "Take 30-60 minutes before travel. May cause drowsiness."
  },
  {
    brandName: "Antivert",
    genericName: "Meclizine",
    alternativeNames: ["Bonine"],
    uses: "Treats motion sickness and vertigo. Less sedating than dimenhydrinate.",
    additionalInfo: "Take 1 hour before travel. Also prescribed for inner ear conditions."
  },
  {
    brandName: "Compazine",
    genericName: "Prochlorperazine",
    alternativeNames: [],
    uses: "Treats severe nausea, vomiting, and migraine headaches.",
    additionalInfo: "Available as tablet, suppository, and injection. May cause drowsiness."
  },
  {
    brandName: "Scopolamine Patch",
    genericName: "Scopolamine",
    alternativeNames: ["Transderm Scop"],
    uses: "Prevents motion sickness and postoperative nausea. Patch worn behind the ear.",
    additionalInfo: "Apply 4 hours before travel. Each patch lasts 3 days."
  },

  // ========== ERECTILE DYSFUNCTION / PROSTATE (EXPANDED) ==========

  {
    brandName: "Levitra",
    genericName: "Vardenafil",
    alternativeNames: ["Staxyn"],
    uses: "Treats erectile dysfunction by increasing blood flow.",
    additionalInfo: "Take 60 minutes before activity. Do not use with nitrates."
  },
  {
    brandName: "Avodart",
    genericName: "Dutasteride",
    alternativeNames: [],
    uses: "Treats enlarged prostate (BPH) by reducing prostate size. Also treats male pattern hair loss.",
    additionalInfo: "May take 3-6 months for full effect. Women should not handle broken capsules."
  },
  {
    brandName: "Proscar",
    genericName: "Finasteride",
    alternativeNames: ["Propecia"],
    uses: "Treats enlarged prostate and male pattern baldness. Reduces prostate size and promotes hair growth.",
    additionalInfo: "Lower dose (Propecia) for hair loss. Women of childbearing age should not handle crushed tablets."
  },

  // ========== ADDITIONAL COMMON MEDICATIONS ==========

  {
    brandName: "Aspirin",
    genericName: "Acetylsalicylic Acid",
    alternativeNames: ["Bayer", "Ecotrin"],
    uses: "Prevents heart attack and stroke, relieves pain, reduces fever and inflammation.",
    additionalInfo: "Low-dose (81mg) for heart protection. Take with food to reduce stomach upset."
  },
  {
    brandName: "Benadryl",
    genericName: "Diphenhydramine",
    alternativeNames: [],
    uses: "Treats allergies, itching, hives, and used as a sleep aid. First-generation antihistamine.",
    additionalInfo: "Causes significant drowsiness. Avoid in elderly due to confusion risk."
  },
  {
    brandName: "Sudafed",
    genericName: "Pseudoephedrine",
    alternativeNames: [],
    uses: "Relieves nasal and sinus congestion from colds, flu, and allergies.",
    additionalInfo: "Available behind pharmacy counter. May raise blood pressure. Avoid at bedtime."
  },
  {
    brandName: "Nasonex",
    genericName: "Mometasone Nasal",
    alternativeNames: [],
    uses: "Treats nasal allergies, congestion, and nasal polyps. Inhaled corticosteroid nasal spray.",
    additionalInfo: "Use daily for best results. May take a few days to reach full effect."
  },
  {
    brandName: "Patanol",
    genericName: "Olopatadine",
    alternativeNames: ["Pataday"],
    uses: "Treats itchy eyes from allergies. Antihistamine eye drops.",
    additionalInfo: "Apply 1-2 times daily depending on formulation. Remove contacts before use."
  },
  {
    brandName: "Silvadene",
    genericName: "Silver Sulfadiazine",
    alternativeNames: [],
    uses: "Prevents and treats infections in second and third degree burns.",
    additionalInfo: "Applied 1-2 times daily to burn wounds. Keep treated area covered."
  },
  {
    brandName: "Bacitracin",
    genericName: "Bacitracin",
    alternativeNames: ["Neosporin"],
    uses: "Prevents skin infections in minor cuts, scrapes, and burns. Topical antibiotic.",
    additionalInfo: "Apply thin layer 1-3 times daily. For external use only."
  },
  {
    brandName: "Monistat",
    genericName: "Miconazole",
    alternativeNames: [],
    uses: "Treats vaginal yeast infections and fungal skin infections. Available over-the-counter.",
    additionalInfo: "Available as 1, 3, or 7 day treatment. Cream and suppository forms."
  },
  {
    brandName: "Lotrimin",
    genericName: "Clotrimazole",
    alternativeNames: [],
    uses: "Treats athlete's foot, jock itch, ringworm, and yeast infections. Topical antifungal.",
    additionalInfo: "Apply twice daily. Continue for 2 weeks after symptoms clear."
  },
  {
    brandName: "Abreva",
    genericName: "Docosanol",
    alternativeNames: [],
    uses: "Treats cold sores (oral herpes) by shortening healing time.",
    additionalInfo: "Apply 5 times daily at first tingle. Over-the-counter."
  },
  {
    brandName: "Pepto-Bismol",
    genericName: "Bismuth Subsalicylate",
    alternativeNames: [],
    uses: "Treats nausea, heartburn, indigestion, upset stomach, and diarrhea.",
    additionalInfo: "May cause black stool and tongue. Do not give to children with flu or chickenpox."
  },
  {
    brandName: "Tums",
    genericName: "Calcium Carbonate",
    alternativeNames: [],
    uses: "Treats heartburn, acid indigestion, and sour stomach. Also provides calcium supplementation.",
    additionalInfo: "Chew thoroughly before swallowing. Do not exceed recommended daily dose."
  },

  // ========== ADDITIONAL DIABETES ==========

  {
    brandName: "Tresiba",
    genericName: "Insulin Degludec",
    alternativeNames: [],
    uses: "Long-acting insulin for type 1 and type 2 diabetes. Ultra-long duration of action.",
    additionalInfo: "Injected once daily at any time. Lasts over 42 hours."
  },
  {
    brandName: "Byetta",
    genericName: "Exenatide",
    alternativeNames: ["Bydureon"],
    uses: "Treats type 2 diabetes. GLP-1 agonist that helps control blood sugar after meals.",
    additionalInfo: "Byetta injected twice daily. Bydureon injected once weekly."
  },
  {
    brandName: "Tradjenta",
    genericName: "Linagliptin",
    alternativeNames: [],
    uses: "Treats type 2 diabetes by increasing insulin release after meals.",
    additionalInfo: "DPP-4 inhibitor taken once daily. No dose adjustment needed for kidney disease."
  },
  {
    brandName: "Onglyza",
    genericName: "Saxagliptin",
    alternativeNames: [],
    uses: "Treats type 2 diabetes by helping the body produce more insulin after meals.",
    additionalInfo: "DPP-4 inhibitor taken once daily with or without food."
  },
  {
    brandName: "Acarbose",
    genericName: "Acarbose",
    alternativeNames: ["Precose"],
    uses: "Treats type 2 diabetes by slowing carbohydrate digestion and sugar absorption.",
    additionalInfo: "Take with first bite of each meal. May cause gas and bloating."
  },

  // ========== ANTI-REJECTION / TRANSPLANT ==========

  {
    brandName: "Prograf",
    genericName: "Tacrolimus",
    alternativeNames: [],
    uses: "Prevents organ rejection after transplant. Powerful immunosuppressant.",
    additionalInfo: "Requires blood level monitoring. Many drug and food interactions (avoid grapefruit)."
  },
  {
    brandName: "Sandimmune",
    genericName: "Cyclosporine",
    alternativeNames: ["Neoral", "Gengraf"],
    uses: "Prevents organ rejection after transplant. Also treats severe psoriasis and rheumatoid arthritis.",
    additionalInfo: "Requires blood level monitoring. Can affect kidney function."
  },

  // ========== BLOOD DISORDERS ==========

  {
    brandName: "Lovenox",
    genericName: "Enoxaparin",
    alternativeNames: [],
    uses: "Prevents and treats blood clots including DVT and pulmonary embolism. Low-molecular-weight heparin.",
    additionalInfo: "Given by injection under the skin. Often used as bridge therapy."
  },
  {
    brandName: "Pradaxa",
    genericName: "Dabigatran",
    alternativeNames: [],
    uses: "Prevents stroke in atrial fibrillation and treats/prevents blood clots.",
    additionalInfo: "Direct thrombin inhibitor. Must be stored in original bottle. Has a reversal agent."
  },
  {
    brandName: "Savaysa",
    genericName: "Edoxaban",
    alternativeNames: [],
    uses: "Prevents stroke in atrial fibrillation and treats DVT and pulmonary embolism.",
    additionalInfo: "Taken once daily. Less effective in patients with high creatinine clearance."
  },
  {
    brandName: "Epogen",
    genericName: "Epoetin Alfa",
    alternativeNames: ["Procrit"],
    uses: "Treats anemia from chronic kidney disease, chemotherapy, or HIV treatment.",
    additionalInfo: "Given by injection. Target hemoglobin levels carefully to avoid clots."
  },
  {
    brandName: "Neupogen",
    genericName: "Filgrastim",
    alternativeNames: [],
    uses: "Stimulates white blood cell production after chemotherapy or bone marrow transplant.",
    additionalInfo: "Given by injection. May cause bone pain."
  },

  // ========== ADDITIONAL CANCER MEDICATIONS ==========

  {
    brandName: "Ibrance",
    genericName: "Palbociclib",
    alternativeNames: [],
    uses: "Treats hormone receptor-positive breast cancer. CDK4/6 inhibitor used with hormone therapy.",
    additionalInfo: "Take with food. Monitor blood counts regularly."
  },
  {
    brandName: "Revlimid",
    genericName: "Lenalidomide",
    alternativeNames: [],
    uses: "Treats multiple myeloma and certain lymphomas. Also treats myelodysplastic syndromes.",
    additionalInfo: "REMS program required. Causes severe birth defects. Regular blood monitoring."
  },
  {
    brandName: "Keytruda",
    genericName: "Pembrolizumab",
    alternativeNames: [],
    uses: "Immunotherapy for various cancers including melanoma, lung, and bladder cancer.",
    additionalInfo: "Given by IV infusion every 3-6 weeks. Can cause immune-related side effects."
  },
  {
    brandName: "Opdivo",
    genericName: "Nivolumab",
    alternativeNames: [],
    uses: "Immunotherapy for various cancers. Helps immune system recognize and fight cancer cells.",
    additionalInfo: "Given by IV infusion. Monitor for immune-related adverse effects."
  },
  {
    brandName: "Xeloda",
    genericName: "Capecitabine",
    alternativeNames: [],
    uses: "Treats breast, colon, and rectal cancer. Oral chemotherapy that converts to 5-FU in the body.",
    additionalInfo: "Take within 30 minutes after meals. May cause hand-foot syndrome."
  },
  {
    brandName: "Femara",
    genericName: "Letrozole",
    alternativeNames: [],
    uses: "Treats hormone receptor-positive breast cancer in postmenopausal women. Aromatase inhibitor.",
    additionalInfo: "Taken once daily. May cause joint pain and bone loss."
  },

  // ========== FIBROMYALGIA / CHRONIC PAIN ==========

  {
    brandName: "Savella",
    genericName: "Milnacipran",
    alternativeNames: [],
    uses: "Treats fibromyalgia by affecting serotonin and norepinephrine levels.",
    additionalInfo: "Take with food. Gradually increase dose. May raise blood pressure."
  },
  {
    brandName: "Zanaflex",
    genericName: "Tizanidine",
    alternativeNames: [],
    uses: "Treats muscle spasticity from multiple sclerosis or spinal cord injury.",
    additionalInfo: "Short-acting muscle relaxant. May cause low blood pressure and drowsiness."
  },
  {
    brandName: "Baclofen",
    genericName: "Baclofen",
    alternativeNames: ["Lioresal"],
    uses: "Treats muscle spasticity from MS, spinal cord injuries, and other conditions.",
    additionalInfo: "Can be given orally or by intrathecal pump. Do not stop suddenly."
  },

  // ========== ADDITIONAL COMMON OTC / PRESCRIPTION ==========

  {
    brandName: "Prevnar",
    genericName: "Pneumococcal Vaccine",
    alternativeNames: ["Prevnar 20"],
    uses: "Prevents pneumococcal disease including pneumonia, meningitis, and bloodstream infections.",
    additionalInfo: "Recommended for children, adults 65+, and those with certain health conditions."
  },
  {
    brandName: "Shingrix",
    genericName: "Zoster Vaccine Recombinant",
    alternativeNames: [],
    uses: "Prevents shingles and postherpetic neuralgia in adults 50 and older.",
    additionalInfo: "Two-dose series given 2-6 months apart. Over 90% effective."
  },
  {
    brandName: "Melatonin",
    genericName: "Melatonin",
    alternativeNames: [],
    uses: "Helps with insomnia and jet lag by regulating sleep-wake cycles. Natural hormone supplement.",
    additionalInfo: "Take 30-60 minutes before bedtime. Start with low dose (0.5-3mg)."
  },
  {
    brandName: "Metamucil",
    genericName: "Psyllium",
    alternativeNames: [],
    uses: "Treats constipation and helps lower cholesterol. Bulk-forming fiber supplement.",
    additionalInfo: "Mix with full glass of water. Drink immediately before it thickens."
  },
  {
    brandName: "Colace",
    genericName: "Docusate Sodium",
    alternativeNames: [],
    uses: "Prevents and treats constipation by softening stool.",
    additionalInfo: "Stool softener, not a stimulant laxative. Works within 1-3 days."
  },
  {
    brandName: "Senna",
    genericName: "Sennosides",
    alternativeNames: ["Senokot"],
    uses: "Treats constipation by stimulating bowel movements.",
    additionalInfo: "Usually works within 6-12 hours. Take at bedtime for morning effect."
  },
  {
    brandName: "Milk of Magnesia",
    genericName: "Magnesium Hydroxide",
    alternativeNames: ["Phillips"],
    uses: "Treats constipation and acid indigestion. Works as both laxative and antacid.",
    additionalInfo: "Produces bowel movement in 30 minutes to 6 hours."
  },

  // ========== IRON / ANEMIA EXPANDED ==========

  {
    brandName: "B12",
    genericName: "Cyanocobalamin",
    alternativeNames: ["Vitamin B12"],
    uses: "Treats vitamin B12 deficiency and pernicious anemia. Essential for nerve function and red blood cells.",
    additionalInfo: "Available oral and injection. Injections needed if absorption is impaired."
  },
  {
    brandName: "Aranesp",
    genericName: "Darbepoetin Alfa",
    alternativeNames: [],
    uses: "Treats anemia from chronic kidney disease or chemotherapy.",
    additionalInfo: "Given by injection less frequently than epoetin. Monitor hemoglobin levels."
  },

  // ========== ADDITIONAL RESPIRATORY / ALLERGY ==========

  {
    brandName: "Xolair",
    genericName: "Omalizumab",
    alternativeNames: [],
    uses: "Treats moderate to severe allergic asthma and chronic hives unresponsive to antihistamines.",
    additionalInfo: "Given by injection every 2-4 weeks. Risk of anaphylaxis; observe after injection."
  },
  {
    brandName: "Nucala",
    genericName: "Mepolizumab",
    alternativeNames: [],
    uses: "Treats severe eosinophilic asthma by reducing eosinophil levels.",
    additionalInfo: "Injected every 4 weeks. For patients with severe asthma not controlled by inhalers."
  },
  {
    brandName: "Fasenra",
    genericName: "Benralizumab",
    alternativeNames: [],
    uses: "Treats severe eosinophilic asthma. Targets and depletes eosinophils.",
    additionalInfo: "Injected every 4 weeks for 3 doses, then every 8 weeks."
  },

  // ========== HEPATITIS ==========

  {
    brandName: "Mavyret",
    genericName: "Glecaprevir/Pibrentasvir",
    alternativeNames: [],
    uses: "Cures all major types of hepatitis C. Pan-genotypic treatment.",
    additionalInfo: "Taken for 8-16 weeks. Take with food. Cure rates over 95%."
  },
  {
    brandName: "Epclusa",
    genericName: "Sofosbuvir/Velpatasvir",
    alternativeNames: [],
    uses: "Cures all genotypes of hepatitis C including those with cirrhosis.",
    additionalInfo: "Taken once daily for 12 weeks. Very high cure rates."
  },
  {
    brandName: "Baraclude",
    genericName: "Entecavir",
    alternativeNames: [],
    uses: "Treats chronic hepatitis B by suppressing viral replication.",
    additionalInfo: "Take on empty stomach. Long-term treatment usually required."
  },
  {
    brandName: "Vemlidy",
    genericName: "Tenofovir Alafenamide",
    alternativeNames: [],
    uses: "Treats chronic hepatitis B with improved kidney and bone safety profile.",
    additionalInfo: "Take with food. Newer formulation of tenofovir with fewer side effects."
  },

  // ========== CYSTIC FIBROSIS ==========

  {
    brandName: "Trikafta",
    genericName: "Elexacaftor/Tezacaftor/Ivacaftor",
    alternativeNames: [],
    uses: "Treats cystic fibrosis in patients with at least one F508del mutation. Breakthrough triple combination therapy.",
    additionalInfo: "Taken with fat-containing food. Has dramatically improved CF outcomes."
  },

  // ========== RARE / SPECIALTY ==========

  {
    brandName: "Plaquenil",
    genericName: "Hydroxychloroquine",
    alternativeNames: [],
    uses: "Treats lupus, rheumatoid arthritis, and malaria. Modifies immune system activity.",
    additionalInfo: "Requires regular eye exams to monitor for retinal toxicity."
  },
  {
    brandName: "Dapsone",
    genericName: "Dapsone",
    alternativeNames: [],
    uses: "Treats leprosy, dermatitis herpetiformis, and certain other skin conditions.",
    additionalInfo: "Monitor blood counts. Can cause hemolytic anemia."
  },
  {
    brandName: "Trental",
    genericName: "Pentoxifylline",
    alternativeNames: [],
    uses: "Treats peripheral artery disease by improving blood flow to the legs.",
    additionalInfo: "Take with meals. May take 2-4 weeks to see benefit in walking distance."
  },
  {
    brandName: "Potassium Chloride",
    genericName: "Potassium Chloride",
    alternativeNames: ["K-Dur", "Klor-Con"],
    uses: "Treats low potassium levels often caused by diuretics. Essential electrolyte supplement.",
    additionalInfo: "Take with food and full glass of water. Do not crush extended-release tablets."
  },
  {
    brandName: "Nitroglycerin",
    genericName: "Nitroglycerin",
    alternativeNames: ["Nitrostat", "Nitro-Dur"],
    uses: "Treats and prevents angina (chest pain) by relaxing blood vessels and improving blood flow to the heart.",
    additionalInfo: "Sublingual tablet dissolves under tongue. Call 911 if chest pain persists after 3 doses."
  },
  {
    brandName: "Isosorbide Mononitrate",
    genericName: "Isosorbide Mononitrate",
    alternativeNames: ["Imdur"],
    uses: "Prevents angina attacks by relaxing blood vessels. Long-acting nitrate.",
    additionalInfo: "Take in morning. Allow 12-hour nitrate-free interval to prevent tolerance."
  },
  {
    brandName: "Amiodarone",
    genericName: "Amiodarone",
    alternativeNames: ["Cordarone", "Pacerone"],
    uses: "Treats serious heart rhythm disorders including atrial fibrillation and ventricular arrhythmias.",
    additionalInfo: "Many serious side effects. Requires monitoring of thyroid, liver, lungs, and eyes."
  },
  {
    brandName: "Sotalol",
    genericName: "Sotalol",
    alternativeNames: ["Betapace"],
    uses: "Treats serious heart rhythm disorders. Combines beta-blocker and antiarrhythmic properties.",
    additionalInfo: "Must be started in hospital with heart monitoring. Take on empty stomach."
  },
  {
    brandName: "Flecainide",
    genericName: "Flecainide",
    alternativeNames: ["Tambocor"],
    uses: "Treats and prevents certain types of abnormal heart rhythms including atrial fibrillation.",
    additionalInfo: "Requires ECG monitoring. Only for patients without structural heart disease."
  },

  // ========== EMERGENCY MEDICATIONS ==========

  {
    brandName: "EpiPen",
    genericName: "Epinephrine Auto-Injector",
    alternativeNames: ["Auvi-Q", "Adrenaclick"],
    uses: "Emergency treatment of severe allergic reactions (anaphylaxis) from insect stings, foods, drugs, or other allergens.",
    additionalInfo: "Inject into outer thigh. Call 911 immediately after use. Carry two at all times."
  },
  {
    brandName: "Narcan",
    genericName: "Naloxone",
    alternativeNames: [],
    uses: "Reverses opioid overdose by blocking opioid effects. Available as nasal spray and injection.",
    additionalInfo: "May need repeat doses. Effects wear off before opioid, so monitor closely."
  },
  {
    brandName: "Glucagon",
    genericName: "Glucagon",
    alternativeNames: ["Baqsimi", "GlucaGen"],
    uses: "Emergency treatment of severe low blood sugar (hypoglycemia) when person cannot eat or drink.",
    additionalInfo: "Baqsimi is nasal spray form. Injectable form needs to be mixed before use."
  },
  {
    brandName: "Activated Charcoal",
    genericName: "Activated Charcoal",
    alternativeNames: ["Actidose"],
    uses: "Emergency treatment for certain poisonings and drug overdoses by absorbing toxins in the stomach.",
    additionalInfo: "Must be given soon after ingestion. Not effective for all types of poisoning."
  },

  // ========== HORMONE THERAPY (EXPANDED) ==========

  {
    brandName: "AndroGel",
    genericName: "Testosterone Gel",
    alternativeNames: ["Testim", "Fortesta"],
    uses: "Treats low testosterone (hypogonadism) in men. Applied to skin for daily absorption.",
    additionalInfo: "Apply to shoulders/upper arms. Avoid skin contact with women and children."
  },
  {
    brandName: "Depo-Testosterone",
    genericName: "Testosterone Cypionate",
    alternativeNames: [],
    uses: "Treats low testosterone in men. Injectable form providing longer-lasting hormone replacement.",
    additionalInfo: "Injected every 1-2 weeks. Monitor blood counts and PSA levels."
  },
  {
    brandName: "Estrace",
    genericName: "Estradiol",
    alternativeNames: ["Vivelle-Dot", "Climara"],
    uses: "Treats menopausal symptoms and prevents osteoporosis. Available as pill, patch, cream, and ring.",
    additionalInfo: "Patch changed 1-2 times weekly. Use lowest effective dose for shortest time."
  },
  {
    brandName: "Prometrium",
    genericName: "Progesterone",
    alternativeNames: [],
    uses: "Treats menstrual irregularities and used with estrogen in hormone replacement therapy.",
    additionalInfo: "Take at bedtime due to drowsiness. Used in fertility treatments and menopause."
  },
  {
    brandName: "Provera",
    genericName: "Medroxyprogesterone",
    alternativeNames: ["Depo-Provera"],
    uses: "Treats abnormal uterine bleeding and amenorrhea. Injectable form prevents pregnancy for 3 months.",
    additionalInfo: "Depo-Provera injection given every 12 weeks. May cause bone density loss with long-term use."
  },
  {
    brandName: "Lupron",
    genericName: "Leuprolide",
    alternativeNames: [],
    uses: "Treats endometriosis, uterine fibroids, prostate cancer, and precocious puberty.",
    additionalInfo: "Given by injection monthly or every 3-6 months. Causes initial hormone surge."
  },
  {
    brandName: "Synthroid",
    genericName: "Levothyroxine",
    alternativeNames: ["Levoxyl", "Unithroid", "Tirosint"],
    uses: "Treats hypothyroidism and thyroid cancer. Most prescribed medication in the US.",
    additionalInfo: "Take on empty stomach 30-60 minutes before breakfast. Consistent dosing is critical."
  },
  {
    brandName: "Desmopressin",
    genericName: "Desmopressin",
    alternativeNames: ["DDAVP"],
    uses: "Treats diabetes insipidus, bedwetting, and certain bleeding disorders.",
    additionalInfo: "Available as tablet, nasal spray, and injection. Limit fluid intake to prevent water intoxication."
  },

  // ========== ANTI-PARASITIC MEDICATIONS ==========

  {
    brandName: "Ivermectin",
    genericName: "Ivermectin",
    alternativeNames: ["Stromectol"],
    uses: "Treats parasitic infections including roundworm, threadworm, and scabies. Also used for rosacea (topical).",
    additionalInfo: "Take on empty stomach with water. Single dose often sufficient for some infections."
  },
  {
    brandName: "Albendazole",
    genericName: "Albendazole",
    alternativeNames: ["Albenza"],
    uses: "Treats tapeworm, roundworm, and other parasitic infections. Broad-spectrum antiparasitic.",
    additionalInfo: "Take with food for better absorption. May require multiple treatment cycles."
  },
  {
    brandName: "Mebendazole",
    genericName: "Mebendazole",
    alternativeNames: ["Vermox", "Emverm"],
    uses: "Treats pinworm, roundworm, hookworm, and whipworm infections.",
    additionalInfo: "Chewable tablet. For pinworm, treat all household members simultaneously."
  },
  {
    brandName: "Permethrin",
    genericName: "Permethrin",
    alternativeNames: ["Nix", "Elimite"],
    uses: "Treats scabies and head lice. Topical insecticide applied to skin or hair.",
    additionalInfo: "Leave on for 8-14 hours for scabies, 10 minutes for lice. Treat all close contacts."
  },
  {
    brandName: "Flagyl",
    genericName: "Metronidazole",
    alternativeNames: ["MetroGel"],
    uses: "Treats bacterial and parasitic infections including C. difficile, trichomoniasis, giardia, and bacterial vaginosis.",
    additionalInfo: "Absolutely no alcohol during treatment and 3 days after. Can cause metallic taste."
  },

  // ========== TUBERCULOSIS MEDICATIONS ==========

  {
    brandName: "Isoniazid",
    genericName: "Isoniazid",
    alternativeNames: ["INH"],
    uses: "Treats and prevents tuberculosis. Key component of TB treatment regimens.",
    additionalInfo: "Take with vitamin B6 to prevent nerve damage. Monitor liver function."
  },
  {
    brandName: "Rifampin",
    genericName: "Rifampin",
    alternativeNames: ["Rifadin"],
    uses: "Treats tuberculosis and certain other bacterial infections. Also prevents meningococcal disease.",
    additionalInfo: "Turns urine, tears, and sweat orange-red. Many drug interactions including birth control."
  },
  {
    brandName: "Pyrazinamide",
    genericName: "Pyrazinamide",
    alternativeNames: [],
    uses: "Treats tuberculosis as part of multi-drug combination therapy.",
    additionalInfo: "Used during first 2 months of TB treatment. Monitor liver function and uric acid."
  },
  {
    brandName: "Ethambutol",
    genericName: "Ethambutol",
    alternativeNames: ["Myambutol"],
    uses: "Treats tuberculosis as part of combination therapy. Helps prevent drug resistance.",
    additionalInfo: "Monitor vision regularly. Can cause optic neuritis affecting color vision."
  },

  // ========== HIV MEDICATIONS (EXPANDED) ==========

  {
    brandName: "Biktarvy",
    genericName: "Bictegravir/Emtricitabine/Tenofovir Alafenamide",
    alternativeNames: [],
    uses: "Treats HIV-1 infection. Complete single-tablet regimen taken once daily.",
    additionalInfo: "One of the most prescribed HIV medications. Take with or without food."
  },
  {
    brandName: "Triumeq",
    genericName: "Dolutegravir/Abacavir/Lamivudine",
    alternativeNames: [],
    uses: "Treats HIV-1 infection. Complete single-tablet regimen.",
    additionalInfo: "Requires HLA-B*5701 testing before starting (abacavir hypersensitivity risk)."
  },
  {
    brandName: "Dovato",
    genericName: "Dolutegravir/Lamivudine",
    alternativeNames: [],
    uses: "Treats HIV-1 infection. Two-drug regimen in a single tablet for reduced pill burden.",
    additionalInfo: "Taken once daily. Not for patients with known resistance to either component."
  },
  {
    brandName: "Descovy",
    genericName: "Emtricitabine/Tenofovir Alafenamide",
    alternativeNames: [],
    uses: "Used for HIV treatment (with other drugs) and PrEP for HIV prevention.",
    additionalInfo: "Improved kidney and bone profile compared to Truvada. Take once daily."
  },
  {
    brandName: "Tivicay",
    genericName: "Dolutegravir",
    alternativeNames: [],
    uses: "Treats HIV-1 infection. Integrase inhibitor used as part of combination therapy.",
    additionalInfo: "Well tolerated with high barrier to resistance. Taken once or twice daily."
  },
  {
    brandName: "Isentress",
    genericName: "Raltegravir",
    alternativeNames: [],
    uses: "Treats HIV-1 infection. First approved integrase inhibitor.",
    additionalInfo: "Taken twice daily (or once daily with HD formulation). Generally well tolerated."
  },

  // ========== SUPPLEMENTS PEOPLE COMMONLY REPORT ==========

  {
    brandName: "Fish Oil",
    genericName: "Omega-3 Fatty Acids",
    alternativeNames: ["Lovaza", "Omacor", "EPA/DHA"],
    uses: "Lowers triglycerides, supports heart and brain health. Anti-inflammatory properties.",
    additionalInfo: "Prescription strength (Lovaza) for very high triglycerides. OTC for general health."
  },
  {
    brandName: "Glucosamine",
    genericName: "Glucosamine Sulfate",
    alternativeNames: ["Glucosamine/Chondroitin"],
    uses: "Supports joint health and may relieve osteoarthritis symptoms.",
    additionalInfo: "Takes 4-8 weeks to see benefit. Often combined with chondroitin."
  },
  {
    brandName: "CoQ10",
    genericName: "Coenzyme Q10",
    alternativeNames: ["Ubiquinone", "Ubiquinol"],
    uses: "Supports heart health and energy production. Often taken with statins to reduce muscle side effects.",
    additionalInfo: "Fat-soluble, take with food. Ubiquinol form may be better absorbed."
  },
  {
    brandName: "Magnesium",
    genericName: "Magnesium Oxide",
    alternativeNames: ["Magnesium Citrate", "Magnesium Glycinate"],
    uses: "Treats magnesium deficiency, constipation, muscle cramps, and supports bone health.",
    additionalInfo: "Different forms have different absorption and uses. Citrate better absorbed than oxide."
  },
  {
    brandName: "Calcium",
    genericName: "Calcium Carbonate/Calcium Citrate",
    alternativeNames: ["Caltrate", "Citracal", "Os-Cal"],
    uses: "Prevents and treats calcium deficiency. Supports bone health and prevents osteoporosis.",
    additionalInfo: "Take carbonate with food, citrate any time. Don't exceed 500mg per dose for best absorption."
  },
  {
    brandName: "Zinc",
    genericName: "Zinc Sulfate",
    alternativeNames: ["Zinc Gluconate", "Zinc Picolinate"],
    uses: "Supports immune function, wound healing, and treats zinc deficiency.",
    additionalInfo: "Take with food to reduce nausea. Can interfere with copper and antibiotic absorption."
  },
  {
    brandName: "Probiotics",
    genericName: "Lactobacillus/Bifidobacterium",
    alternativeNames: ["Culturelle", "Align", "Florastor"],
    uses: "Supports digestive health, restores gut bacteria after antibiotics, may help with IBS.",
    additionalInfo: "Many different strains for different purposes. Refrigeration may be required."
  },
  {
    brandName: "Turmeric",
    genericName: "Curcumin",
    alternativeNames: [],
    uses: "Natural anti-inflammatory supplement. May help with joint pain and digestive issues.",
    additionalInfo: "Take with black pepper (piperine) for better absorption. May interact with blood thinners."
  },
  {
    brandName: "Biotin",
    genericName: "Biotin",
    alternativeNames: ["Vitamin B7", "Vitamin H"],
    uses: "Supports hair, skin, and nail health. Treats biotin deficiency.",
    additionalInfo: "Can interfere with lab test results (troponin, thyroid). Inform lab before blood work."
  },
  {
    brandName: "Cranberry",
    genericName: "Cranberry Extract",
    alternativeNames: ["Azo Cranberry"],
    uses: "Supports urinary tract health and may help prevent UTIs.",
    additionalInfo: "Supplement form preferred over juice (less sugar). May interact with warfarin."
  },
  {
    brandName: "Saw Palmetto",
    genericName: "Saw Palmetto Extract",
    alternativeNames: [],
    uses: "Used for enlarged prostate (BPH) symptoms including frequent urination.",
    additionalInfo: "May take 4-6 weeks to see benefit. Can affect PSA test results."
  },
  {
    brandName: "Prenatal Vitamins",
    genericName: "Prenatal Multivitamin",
    alternativeNames: ["PNV", "One A Day Prenatal"],
    uses: "Provides essential vitamins and minerals during pregnancy including folic acid, iron, and DHA.",
    additionalInfo: "Start before conception. Iron may cause constipation; take with food."
  },
  {
    brandName: "Multivitamin",
    genericName: "Multivitamin/Multimineral",
    alternativeNames: ["Centrum", "One A Day"],
    uses: "Provides daily vitamins and minerals to supplement diet. Helps prevent nutritional deficiencies.",
    additionalInfo: "Take with food for best absorption. Iron-containing formulas may cause stomach upset."
  },

  // ========== ADDITIONAL SLEEP MEDICATIONS ==========

  {
    brandName: "Silenor",
    genericName: "Doxepin (low dose)",
    alternativeNames: [],
    uses: "Treats insomnia characterized by difficulty staying asleep. Low-dose tricyclic antidepressant.",
    additionalInfo: "Take within 30 minutes of bedtime. Do not take within 3 hours of a meal."
  },
  {
    brandName: "Belsomra",
    genericName: "Suvorexant",
    alternativeNames: [],
    uses: "Treats insomnia by blocking orexin, a chemical that promotes wakefulness.",
    additionalInfo: "Take within 30 minutes of bedtime. Allow 7+ hours for sleep. New drug class."
  },
  {
    brandName: "Dayvigo",
    genericName: "Lemborexant",
    alternativeNames: [],
    uses: "Treats insomnia including difficulty falling asleep and staying asleep. Orexin receptor antagonist.",
    additionalInfo: "Take immediately before bed. Do not take if unable to stay in bed 7+ hours."
  },
  {
    brandName: "Rozerem",
    genericName: "Ramelteon",
    alternativeNames: [],
    uses: "Treats insomnia by targeting melatonin receptors. Non-controlled sleep medication.",
    additionalInfo: "Not habit-forming. Take 30 minutes before bedtime. Do not take with high-fat meal."
  },
  {
    brandName: "Sonata",
    genericName: "Zaleplon",
    alternativeNames: [],
    uses: "Treats insomnia, especially difficulty falling asleep. Very short-acting sleep medication.",
    additionalInfo: "Can be taken at bedtime or after failing to fall asleep. Only need 4 hours in bed."
  },
  {
    brandName: "Restoril",
    genericName: "Temazepam",
    alternativeNames: [],
    uses: "Treats insomnia. Benzodiazepine sleep aid for short-term use.",
    additionalInfo: "Controlled substance. Usually limited to 7-10 days of use. Can be habit-forming."
  },

  // ========== ADDITIONAL TOPICAL STEROIDS ==========

  {
    brandName: "Hydrocortisone",
    genericName: "Hydrocortisone",
    alternativeNames: ["Cortaid", "Cortizone-10"],
    uses: "Treats skin inflammation, itching, eczema, insect bites, and rashes. Mild topical steroid.",
    additionalInfo: "OTC in low strengths. Apply thin layer 1-4 times daily. Avoid face for extended use."
  },
  {
    brandName: "Triamcinolone",
    genericName: "Triamcinolone Acetonide",
    alternativeNames: ["Kenalog"],
    uses: "Treats eczema, dermatitis, psoriasis, and other inflammatory skin conditions. Medium-strength steroid.",
    additionalInfo: "Apply thin layer 2-4 times daily. Do not use on face or groin long-term."
  },
  {
    brandName: "Clobetasol",
    genericName: "Clobetasol Propionate",
    alternativeNames: ["Temovate", "Clobex"],
    uses: "Treats severe eczema, psoriasis, and dermatitis unresponsive to milder steroids. Super-potent topical steroid.",
    additionalInfo: "Limit to 2 weeks of use. Do not use on face, groin, or armpits."
  },
  {
    brandName: "Betamethasone",
    genericName: "Betamethasone Dipropionate",
    alternativeNames: ["Diprolene", "Luxiq"],
    uses: "Treats inflammatory and itchy skin conditions including eczema, dermatitis, and psoriasis.",
    additionalInfo: "High-potency steroid. Apply sparingly. Not for use on face or broken skin."
  },
  {
    brandName: "Desonide",
    genericName: "Desonide",
    alternativeNames: ["Desonate", "LoKara"],
    uses: "Treats mild skin inflammation and eczema. Low-potency steroid safe for sensitive areas.",
    additionalInfo: "Can be used on face and skin folds. Apply 2-3 times daily."
  },
  {
    brandName: "Fluocinonide",
    genericName: "Fluocinonide",
    alternativeNames: ["Vanos", "Lidex"],
    uses: "Treats severe inflammatory skin conditions, eczema, and psoriasis. High-potency topical steroid.",
    additionalInfo: "Apply thin layer 2-4 times daily. Limit duration of use."
  },
  {
    brandName: "Mometasone Cream",
    genericName: "Mometasone Furoate",
    alternativeNames: ["Elocon"],
    uses: "Treats inflammatory skin conditions including eczema and psoriasis. Medium-potency steroid.",
    additionalInfo: "Apply once daily. Relatively lower risk of skin thinning."
  },

  // ========== ADDITIONAL ACNE MEDICATIONS ==========

  {
    brandName: "Accutane",
    genericName: "Isotretinoin",
    alternativeNames: ["Absorica", "Claravis", "Amnesteem"],
    uses: "Treats severe cystic acne unresponsive to other treatments. Very effective but has significant side effects.",
    additionalInfo: "Causes severe birth defects. iPLEDGE program required. Dries skin and lips significantly."
  },
  {
    brandName: "Dapsone Gel",
    genericName: "Dapsone Topical",
    alternativeNames: ["Aczone"],
    uses: "Treats acne vulgaris. Topical anti-inflammatory and antimicrobial.",
    additionalInfo: "Apply thin layer twice daily. May cause dryness and peeling."
  },
  {
    brandName: "Epiduo",
    genericName: "Adapalene/Benzoyl Peroxide",
    alternativeNames: [],
    uses: "Treats acne by combining a retinoid with benzoyl peroxide. Targets multiple acne mechanisms.",
    additionalInfo: "Apply once daily at bedtime. Skin irritation common when starting."
  },
  {
    brandName: "Benzaclin",
    genericName: "Clindamycin/Benzoyl Peroxide",
    alternativeNames: ["Duac", "Onexton"],
    uses: "Treats acne with combination antibiotic and benzoyl peroxide. Reduces bacteria and inflammation.",
    additionalInfo: "Apply once or twice daily. Refrigerate some formulations."
  },
  {
    brandName: "Spironolactone (for acne)",
    genericName: "Spironolactone",
    alternativeNames: [],
    uses: "Treats hormonal acne in women by reducing androgen effects on skin. Off-label but very effective.",
    additionalInfo: "Not for use in men or during pregnancy. Monitor potassium levels."
  },

  // ========== ADDITIONAL EYE MEDICATIONS ==========

  {
    brandName: "Timolol Eye Drops",
    genericName: "Timolol",
    alternativeNames: ["Timoptic"],
    uses: "Treats glaucoma and high eye pressure by reducing fluid production in the eye.",
    additionalInfo: "Apply 1-2 times daily. Beta-blocker eye drop; can have systemic effects."
  },
  {
    brandName: "Alphagan",
    genericName: "Brimonidine",
    alternativeNames: [],
    uses: "Treats glaucoma by reducing eye pressure. Also used topically for facial redness (Mirvaso).",
    additionalInfo: "Apply 2-3 times daily. May cause drowsiness and dry mouth."
  },
  {
    brandName: "Trusopt",
    genericName: "Dorzolamide",
    alternativeNames: [],
    uses: "Treats glaucoma by reducing fluid production in the eye. Carbonic anhydrase inhibitor eye drop.",
    additionalInfo: "Apply 3 times daily. Sulfa allergy patients should use with caution."
  },
  {
    brandName: "Combigan",
    genericName: "Brimonidine/Timolol",
    alternativeNames: [],
    uses: "Treats glaucoma with two medications combined in one eye drop for better pressure control.",
    additionalInfo: "Apply twice daily. Reduces need for multiple separate eye drops."
  },
  {
    brandName: "Travatan",
    genericName: "Travoprost",
    alternativeNames: [],
    uses: "Treats glaucoma by increasing fluid drainage from the eye. Prostaglandin analog.",
    additionalInfo: "Apply once daily in evening. May permanently darken iris color."
  },
  {
    brandName: "Pred Forte",
    genericName: "Prednisolone Acetate",
    alternativeNames: [],
    uses: "Treats eye inflammation after surgery or from allergies and other conditions. Steroid eye drop.",
    additionalInfo: "Shake well before use. Taper gradually, don't stop suddenly. Monitor eye pressure."
  },
  {
    brandName: "Lotemax",
    genericName: "Loteprednol",
    alternativeNames: [],
    uses: "Treats eye inflammation and allergy symptoms. Steroid eye drop with lower pressure risk.",
    additionalInfo: "Softer steroid with less risk of pressure elevation. Shake well before use."
  },
  {
    brandName: "Xiidra",
    genericName: "Lifitegrast",
    alternativeNames: [],
    uses: "Treats dry eye disease by reducing inflammation on the eye surface.",
    additionalInfo: "Apply twice daily. May cause taste changes and eye irritation."
  },

  // ========== EAR MEDICATIONS ==========

  {
    brandName: "Ciprodex",
    genericName: "Ciprofloxacin/Dexamethasone",
    alternativeNames: [],
    uses: "Treats ear infections (otitis media and otitis externa). Combination antibiotic and steroid ear drops.",
    additionalInfo: "Warm drops in hand before instilling. Tilt head and keep drops in ear 60 seconds."
  },
  {
    brandName: "Ofloxacin Ear Drops",
    genericName: "Ofloxacin Otic",
    alternativeNames: [],
    uses: "Treats ear infections including swimmer's ear and middle ear infections with tubes.",
    additionalInfo: "Apply twice daily. Do not use if allergic to fluoroquinolone antibiotics."
  },
  {
    brandName: "Cortisporin",
    genericName: "Neomycin/Polymyxin B/Hydrocortisone",
    alternativeNames: [],
    uses: "Treats outer ear infections with combination antibiotic and anti-inflammatory drops.",
    additionalInfo: "Apply 3-4 times daily. May cause skin sensitization with prolonged use."
  },
  {
    brandName: "Debrox",
    genericName: "Carbamide Peroxide",
    alternativeNames: [],
    uses: "Removes earwax buildup by softening and loosening earwax.",
    additionalInfo: "Tilt head and apply 5-10 drops. Keep in ear for several minutes. OTC product."
  },

  // ========== DENTAL / ORAL MEDICATIONS ==========

  {
    brandName: "Chlorhexidine Rinse",
    genericName: "Chlorhexidine Gluconate",
    alternativeNames: ["Peridex", "PerioGard"],
    uses: "Treats gingivitis and gum disease. Antimicrobial mouth rinse prescribed by dentists.",
    additionalInfo: "Rinse for 30 seconds twice daily. May stain teeth brown with long-term use."
  },
  {
    brandName: "Magic Mouthwash",
    genericName: "Diphenhydramine/Lidocaine/Antacid",
    alternativeNames: [],
    uses: "Treats mouth sores, oral mucositis from chemotherapy, and canker sores.",
    additionalInfo: "Swish and spit (or swallow if directed). Compounded by pharmacy."
  },
  {
    brandName: "Orajel",
    genericName: "Benzocaine",
    alternativeNames: [],
    uses: "Provides temporary relief of toothache, canker sores, and oral pain.",
    additionalInfo: "Apply directly to painful area. Do not use in infants under 2 years."
  },

  // ========== ADDITIONAL ANTIHYPERTENSIVES ==========

  {
    brandName: "Tekturna",
    genericName: "Aliskiren",
    alternativeNames: [],
    uses: "Treats high blood pressure. Direct renin inhibitor, a newer class of blood pressure medication.",
    additionalInfo: "Take consistently with or without food. Do not use with ACE inhibitors or ARBs in diabetics."
  },
  {
    brandName: "Catapres Patch",
    genericName: "Clonidine Transdermal",
    alternativeNames: [],
    uses: "Treats high blood pressure via weekly patch. Provides steady medication levels.",
    additionalInfo: "Apply weekly to hairless area. Rotate sites. Remove old patch before applying new one."
  },
  {
    brandName: "Minipress",
    genericName: "Prazosin",
    alternativeNames: [],
    uses: "Treats high blood pressure and PTSD-related nightmares. Alpha-blocker.",
    additionalInfo: "Start at bedtime due to first-dose fainting risk. Commonly used for PTSD nightmares."
  },
  {
    brandName: "Hydralazine",
    genericName: "Hydralazine",
    alternativeNames: [],
    uses: "Treats high blood pressure and heart failure. Vasodilator that relaxes blood vessels.",
    additionalInfo: "Often combined with isosorbide dinitrate for heart failure. Take with food."
  },
  {
    brandName: "Micardis",
    genericName: "Telmisartan",
    alternativeNames: [],
    uses: "Treats high blood pressure and reduces cardiovascular risk. Long-acting ARB.",
    additionalInfo: "Taken once daily. Longest-acting ARB with 24-hour coverage."
  },
  {
    brandName: "Avapro",
    genericName: "Irbesartan",
    alternativeNames: [],
    uses: "Treats high blood pressure and diabetic kidney disease.",
    additionalInfo: "ARB taken once daily. Particularly beneficial for diabetic nephropathy."
  },
  {
    brandName: "Atacand",
    genericName: "Candesartan",
    alternativeNames: [],
    uses: "Treats high blood pressure and heart failure.",
    additionalInfo: "ARB taken once or twice daily. Can be used in children 1 year and older."
  },
  {
    brandName: "Mavik",
    genericName: "Trandolapril",
    alternativeNames: [],
    uses: "Treats high blood pressure and heart failure after heart attack.",
    additionalInfo: "ACE inhibitor taken once daily. Monitor kidney function and potassium."
  },
  {
    brandName: "Accupril",
    genericName: "Quinapril",
    alternativeNames: [],
    uses: "Treats high blood pressure and heart failure.",
    additionalInfo: "ACE inhibitor taken once or twice daily. May cause dry cough."
  },
  {
    brandName: "Bumex",
    genericName: "Bumetanide",
    alternativeNames: [],
    uses: "Treats fluid retention from heart failure, liver disease, and kidney disease. Loop diuretic.",
    additionalInfo: "More potent than furosemide. Monitor potassium and kidney function."
  },
  {
    brandName: "Zaroxolyn",
    genericName: "Metolazone",
    alternativeNames: [],
    uses: "Treats fluid retention and high blood pressure. Often added to loop diuretics for resistant edema.",
    additionalInfo: "Very potent when combined with loop diuretics. Monitor electrolytes closely."
  },
  {
    brandName: "Inspra",
    genericName: "Eplerenone",
    alternativeNames: [],
    uses: "Treats heart failure and high blood pressure. Selective aldosterone blocker.",
    additionalInfo: "Fewer hormonal side effects than spironolactone. Monitor potassium levels."
  },

  // ========== ADDITIONAL PAIN / NERVE MEDICATIONS ==========

  {
    brandName: "Morphine",
    genericName: "Morphine Sulfate",
    alternativeNames: ["MS Contin", "Kadian"],
    uses: "Treats severe pain. Available in immediate and extended-release forms.",
    additionalInfo: "High potential for addiction. Extended-release must be swallowed whole."
  },
  {
    brandName: "Fentanyl Patch",
    genericName: "Fentanyl Transdermal",
    alternativeNames: ["Duragesic"],
    uses: "Treats severe chronic pain requiring around-the-clock opioid treatment.",
    additionalInfo: "Extremely potent. Only for opioid-tolerant patients. Change patch every 72 hours."
  },
  {
    brandName: "Dilaudid",
    genericName: "Hydromorphone",
    alternativeNames: [],
    uses: "Treats moderate to severe pain. More potent than morphine.",
    additionalInfo: "High potential for addiction. Available as tablet, liquid, and injection."
  },
  {
    brandName: "Suboxone",
    genericName: "Buprenorphine/Naloxone",
    alternativeNames: ["Sublocade", "Zubsolv"],
    uses: "Treats opioid use disorder (addiction). Reduces cravings and withdrawal symptoms.",
    additionalInfo: "Dissolve under tongue. Sublocade is monthly injection form. Requires special prescriber."
  },
  {
    brandName: "Methadone",
    genericName: "Methadone",
    alternativeNames: ["Dolophine"],
    uses: "Treats opioid addiction and severe chronic pain. Long-acting opioid.",
    additionalInfo: "For addiction, dispensed at special clinics. Can affect heart rhythm. Very long half-life."
  },
  {
    brandName: "Vivitrol",
    genericName: "Naltrexone",
    alternativeNames: ["ReVia"],
    uses: "Treats alcohol and opioid dependence by blocking opioid receptors. Reduces cravings.",
    additionalInfo: "Monthly injection (Vivitrol) or daily tablet (ReVia). Must be opioid-free before starting."
  },
  {
    brandName: "Campral",
    genericName: "Acamprosate",
    alternativeNames: [],
    uses: "Helps maintain alcohol abstinence by reducing alcohol cravings and withdrawal symptoms.",
    additionalInfo: "Taken three times daily. Works best when combined with counseling."
  },
  {
    brandName: "Antabuse",
    genericName: "Disulfiram",
    alternativeNames: [],
    uses: "Treats alcohol dependence by causing unpleasant effects when alcohol is consumed.",
    additionalInfo: "Even small amounts of alcohol cause severe nausea and flushing. Must avoid all alcohol products."
  },
  {
    brandName: "Lidocaine Cream",
    genericName: "Lidocaine Topical",
    alternativeNames: ["EMLA", "LMX"],
    uses: "Numbs skin before procedures, treats nerve pain, and relieves minor burns and itching.",
    additionalInfo: "Apply and cover with wrap for procedures. Do not apply to large areas or broken skin."
  },
  {
    brandName: "Capsaicin",
    genericName: "Capsaicin",
    alternativeNames: ["Zostrix", "Qutenza"],
    uses: "Treats nerve pain, arthritis, and muscle pain. Derived from hot peppers.",
    additionalInfo: "Burns when first applied; this decreases with continued use. Wash hands thoroughly after applying."
  },

  // ========== ADDITIONAL PSYCHIATRIC MEDICATIONS ==========

  {
    brandName: "Trintellix",
    genericName: "Vortioxetine",
    alternativeNames: [],
    uses: "Treats major depression. May also improve cognitive function impaired by depression.",
    additionalInfo: "Multimodal antidepressant. Takes 2-4 weeks for full effect. May cause nausea initially."
  },
  {
    brandName: "Spravato",
    genericName: "Esketamine",
    alternativeNames: [],
    uses: "Treats treatment-resistant depression and major depression with suicidal thoughts. Nasal spray.",
    additionalInfo: "Must be administered in certified healthcare setting. Patient monitored for 2 hours after."
  },
  {
    brandName: "Rexulti",
    genericName: "Brexpiprazole",
    alternativeNames: [],
    uses: "Treats schizophrenia and as add-on for major depression. Atypical antipsychotic.",
    additionalInfo: "Lower side effect profile than some antipsychotics. Taken once daily."
  },
  {
    brandName: "Fanapt",
    genericName: "Iloperidone",
    alternativeNames: [],
    uses: "Treats schizophrenia. Atypical antipsychotic with gradual dose titration.",
    additionalInfo: "Must be titrated slowly over first week. Take twice daily with food."
  },
  {
    brandName: "Invega",
    genericName: "Paliperidone",
    alternativeNames: [],
    uses: "Treats schizophrenia and schizoaffective disorder. Available as oral and long-acting injection.",
    additionalInfo: "Extended-release tablet taken once daily. Injection given monthly or every 3 months."
  },
  {
    brandName: "Clozaril",
    genericName: "Clozapine",
    alternativeNames: [],
    uses: "Treats treatment-resistant schizophrenia and reduces suicidality. Most effective antipsychotic.",
    additionalInfo: "Requires weekly/biweekly blood monitoring for serious blood disorder risk. REMS program."
  },
  {
    brandName: "Anafranil",
    genericName: "Clomipramine",
    alternativeNames: [],
    uses: "Treats OCD (obsessive-compulsive disorder). Tricyclic antidepressant most effective for OCD.",
    additionalInfo: "Taken at bedtime. Side effects include drowsiness, dry mouth, weight gain."
  },
  {
    brandName: "Elavil",
    genericName: "Amitriptyline",
    alternativeNames: [],
    uses: "Treats depression, nerve pain, migraine prevention, and insomnia. Tricyclic antidepressant.",
    additionalInfo: "Usually taken at bedtime due to sedation. Low doses used for pain and sleep."
  },
  {
    brandName: "Nortriptyline",
    genericName: "Nortriptyline",
    alternativeNames: ["Pamelor"],
    uses: "Treats depression, nerve pain, and migraine prevention. Tricyclic antidepressant.",
    additionalInfo: "Less sedating than amitriptyline. Often used at low doses for pain."
  },
  {
    brandName: "Provigil",
    genericName: "Modafinil",
    alternativeNames: [],
    uses: "Treats excessive sleepiness from narcolepsy, shift work disorder, and sleep apnea.",
    additionalInfo: "Take in morning. Not a stimulant but promotes wakefulness. May reduce birth control effectiveness."
  },
  {
    brandName: "Nuvigil",
    genericName: "Armodafinil",
    alternativeNames: [],
    uses: "Treats excessive sleepiness from narcolepsy, shift work disorder, and obstructive sleep apnea.",
    additionalInfo: "Longer-acting version of modafinil. Take in morning. Controlled substance."
  },

  // ========== ADDITIONAL RESPIRATORY ==========

  {
    brandName: "Singulair",
    genericName: "Montelukast",
    alternativeNames: [],
    uses: "Prevents asthma attacks and treats seasonal allergies. Leukotriene receptor antagonist.",
    additionalInfo: "Take once daily in evening. FDA warning about neuropsychiatric effects."
  },
  {
    brandName: "Incruse Ellipta",
    genericName: "Umeclidinium",
    alternativeNames: [],
    uses: "Treats COPD by relaxing airway muscles. Long-acting muscarinic antagonist (LAMA).",
    additionalInfo: "Inhaled once daily. Do not use for acute breathing problems."
  },
  {
    brandName: "Stiolto Respimat",
    genericName: "Tiotropium/Olodaterol",
    alternativeNames: [],
    uses: "Treats COPD with combination of two long-acting bronchodilators in one inhaler.",
    additionalInfo: "Two puffs once daily. Not for asthma."
  },
  {
    brandName: "Anoro Ellipta",
    genericName: "Umeclidinium/Vilanterol",
    alternativeNames: [],
    uses: "Treats COPD with dual bronchodilator combination. Long-acting for maintenance therapy.",
    additionalInfo: "Inhaled once daily. Not for acute rescue use."
  },
  {
    brandName: "Tudorza",
    genericName: "Aclidinium",
    alternativeNames: [],
    uses: "Treats COPD by relaxing airway muscles. Long-acting muscarinic antagonist.",
    additionalInfo: "Inhaled twice daily. Breath-activated inhaler."
  },
  {
    brandName: "Arnuity Ellipta",
    genericName: "Fluticasone Furoate",
    alternativeNames: [],
    uses: "Prevents asthma attacks. Once-daily inhaled corticosteroid.",
    additionalInfo: "Use daily for prevention; not for acute attacks. Rinse mouth after use."
  },
  {
    brandName: "Alvesco",
    genericName: "Ciclesonide",
    alternativeNames: [],
    uses: "Prevents asthma attacks. Inhaled corticosteroid with fewer local side effects.",
    additionalInfo: "Activated in the lungs, so less oral thrush and hoarseness. Once or twice daily."
  },

  // ========== ADDITIONAL GASTROINTESTINAL ==========

  {
    brandName: "Trulance",
    genericName: "Plecanatide",
    alternativeNames: [],
    uses: "Treats chronic idiopathic constipation and IBS with constipation.",
    additionalInfo: "Take once daily with or without food. Works by increasing intestinal fluid."
  },
  {
    brandName: "Amitiza",
    genericName: "Lubiprostone",
    alternativeNames: [],
    uses: "Treats chronic constipation and IBS with constipation in women.",
    additionalInfo: "Take with food and water. May cause nausea."
  },
  {
    brandName: "Motegrity",
    genericName: "Prucalopride",
    alternativeNames: [],
    uses: "Treats chronic idiopathic constipation by stimulating gut motility.",
    additionalInfo: "Taken once daily. Works by activating serotonin receptors in the gut."
  },
  {
    brandName: "Viberzi",
    genericName: "Eluxadoline",
    alternativeNames: [],
    uses: "Treats IBS with diarrhea by reducing bowel contractions.",
    additionalInfo: "Take with food. Controlled substance. Not for patients without a gallbladder."
  },
  {
    brandName: "Lotronex",
    genericName: "Alosetron",
    alternativeNames: [],
    uses: "Treats severe IBS with diarrhea in women who haven't responded to other treatments.",
    additionalInfo: "Restricted prescribing program due to rare but serious GI side effects."
  },
  {
    brandName: "Lactulose",
    genericName: "Lactulose",
    alternativeNames: ["Enulose", "Kristalose"],
    uses: "Treats constipation and reduces ammonia levels in hepatic encephalopathy.",
    additionalInfo: "Works in 24-48 hours for constipation. May cause bloating and gas."
  },
  {
    brandName: "Diclegis",
    genericName: "Doxylamine/Pyridoxine",
    alternativeNames: ["Bonjesta"],
    uses: "Treats nausea and vomiting of pregnancy (morning sickness).",
    additionalInfo: "Only FDA-approved medication for morning sickness. Take at bedtime."
  },
  {
    brandName: "Pancreaze",
    genericName: "Pancrelipase",
    alternativeNames: ["Creon", "Zenpep"],
    uses: "Replaces digestive enzymes for pancreatic insufficiency from cystic fibrosis, pancreatitis, or surgery.",
    additionalInfo: "Take with every meal and snack. Swallow whole, do not crush."
  },
  {
    brandName: "Ursodiol",
    genericName: "Ursodeoxycholic Acid",
    alternativeNames: ["Actigall", "Urso"],
    uses: "Dissolves gallstones and treats primary biliary cholangitis (liver disease).",
    additionalInfo: "Take with food. May take months to dissolve gallstones."
  },

  // ========== ADDITIONAL RHEUMATOLOGY ==========

  {
    brandName: "Methotrexate",
    genericName: "Methotrexate",
    alternativeNames: ["Trexall", "Otrexup", "Rasuvo"],
    uses: "Treats rheumatoid arthritis, psoriasis, and certain cancers. Disease-modifying antirheumatic drug (DMARD).",
    additionalInfo: "Taken once weekly (not daily). Take folic acid to reduce side effects. Monitor liver and blood."
  },
  {
    brandName: "Arava",
    genericName: "Leflunomide",
    alternativeNames: [],
    uses: "Treats rheumatoid arthritis by suppressing immune system. DMARD.",
    additionalInfo: "Takes 4-6 weeks for full effect. Monitor liver function. Avoid in pregnancy."
  },
  {
    brandName: "Sulfasalazine",
    genericName: "Sulfasalazine",
    alternativeNames: ["Azulfidine"],
    uses: "Treats rheumatoid arthritis, ulcerative colitis, and Crohn's disease.",
    additionalInfo: "May turn urine and skin orange-yellow. Take with food and plenty of water."
  },
  {
    brandName: "Xeljanz",
    genericName: "Tofacitinib",
    alternativeNames: [],
    uses: "Treats rheumatoid arthritis, psoriatic arthritis, and ulcerative colitis. JAK inhibitor.",
    additionalInfo: "Oral medication. Monitor for infections, blood clots, and malignancies."
  },
  {
    brandName: "Rinvoq",
    genericName: "Upadacitinib",
    alternativeNames: [],
    uses: "Treats rheumatoid arthritis, psoriatic arthritis, eczema, and ulcerative colitis. JAK inhibitor.",
    additionalInfo: "Taken once daily. Monitor for serious infections and blood counts."
  },
  {
    brandName: "Olumiant",
    genericName: "Baricitinib",
    alternativeNames: [],
    uses: "Treats rheumatoid arthritis and severe alopecia areata. JAK inhibitor.",
    additionalInfo: "Taken once daily. First FDA-approved treatment for severe alopecia areata."
  },
  {
    brandName: "Orencia",
    genericName: "Abatacept",
    alternativeNames: [],
    uses: "Treats rheumatoid arthritis and juvenile idiopathic arthritis. T-cell co-stimulation modulator.",
    additionalInfo: "Given by IV infusion monthly or weekly subcutaneous injection."
  },
  {
    brandName: "Actemra",
    genericName: "Tocilizumab",
    alternativeNames: [],
    uses: "Treats rheumatoid arthritis, giant cell arteritis, and cytokine release syndrome.",
    additionalInfo: "Given by IV infusion or subcutaneous injection. Monitor liver and blood counts."
  },
  {
    brandName: "Kevzara",
    genericName: "Sarilumab",
    alternativeNames: [],
    uses: "Treats rheumatoid arthritis not responding to methotrexate. IL-6 receptor antagonist.",
    additionalInfo: "Injected every 2 weeks. Monitor liver function, blood counts, and lipids."
  },
  {
    brandName: "Benlysta",
    genericName: "Belimumab",
    alternativeNames: [],
    uses: "Treats lupus (SLE) and lupus nephritis. First drug specifically approved for lupus.",
    additionalInfo: "Given by IV infusion monthly or weekly subcutaneous injection."
  },

  // ========== ADDITIONAL KIDNEY MEDICATIONS ==========

  {
    brandName: "Sevelamer",
    genericName: "Sevelamer Carbonate",
    alternativeNames: ["Renvela", "Renagel"],
    uses: "Controls high phosphorus levels in chronic kidney disease patients on dialysis.",
    additionalInfo: "Take with meals. Chew or swallow whole, depending on formulation."
  },
  {
    brandName: "Calcitriol",
    genericName: "Calcitriol",
    alternativeNames: ["Rocaltrol"],
    uses: "Active form of vitamin D for chronic kidney disease, hypoparathyroidism, and osteoporosis.",
    additionalInfo: "Monitor calcium levels closely. More potent than regular vitamin D."
  },
  {
    brandName: "Sensipar",
    genericName: "Cinacalcet",
    alternativeNames: [],
    uses: "Treats hyperparathyroidism in dialysis patients and parathyroid cancer.",
    additionalInfo: "Take with food. Monitor calcium levels; can cause dangerously low calcium."
  },
  {
    brandName: "Kayexalate",
    genericName: "Sodium Polystyrene Sulfonate",
    alternativeNames: [],
    uses: "Treats high potassium levels by binding potassium in the gut for elimination.",
    additionalInfo: "Take with meals. Can cause constipation and sodium retention."
  },
  {
    brandName: "Veltassa",
    genericName: "Patiromer",
    alternativeNames: [],
    uses: "Treats high potassium levels in chronic kidney disease. Newer potassium binder.",
    additionalInfo: "Take with food. Separate from other medications by 3 hours."
  },
  {
    brandName: "Lokelma",
    genericName: "Sodium Zirconium Cyclosilicate",
    alternativeNames: [],
    uses: "Treats high potassium levels. Fast-acting potassium binder.",
    additionalInfo: "Mix with water. Works within hours. Can be used for acute and chronic treatment."
  },
  {
    brandName: "Jynarque",
    genericName: "Tolvaptan",
    alternativeNames: [],
    uses: "Slows kidney function decline in autosomal dominant polycystic kidney disease (ADPKD).",
    additionalInfo: "Requires liver function monitoring. Causes significant thirst and frequent urination."
  },
  {
    brandName: "Farxiga (for CKD)",
    genericName: "Dapagliflozin",
    alternativeNames: [],
    uses: "Slows progression of chronic kidney disease with or without diabetes. SGLT2 inhibitor.",
    additionalInfo: "Also treats heart failure. Originally a diabetes medication with expanded indications."
  },

  // ========== MISCELLANEOUS COMMONLY ENCOUNTERED ==========

  {
    brandName: "Eliquis",
    genericName: "Apixaban",
    alternativeNames: [],
    uses: "Prevents stroke in atrial fibrillation, treats and prevents blood clots (DVT/PE).",
    additionalInfo: "Take twice daily with or without food. No routine blood monitoring needed."
  },
  {
    brandName: "Gabapentin (for nerve pain)",
    genericName: "Gabapentin",
    alternativeNames: ["Gralise", "Horizant"],
    uses: "Treats nerve pain from shingles, diabetic neuropathy, and fibromyalgia. Also for restless legs.",
    additionalInfo: "Gralise is once-daily extended release. Horizant specifically for restless legs."
  },
  {
    brandName: "Requip XL",
    genericName: "Ropinirole Extended-Release",
    alternativeNames: [],
    uses: "Treats Parkinson's disease with once-daily dosing. Extended-release dopamine agonist.",
    additionalInfo: "Swallow whole. Do not crush, chew, or divide tablets."
  },
  {
    brandName: "Auvelity",
    genericName: "Dextromethorphan/Bupropion",
    alternativeNames: [],
    uses: "Treats major depressive disorder. Novel combination that works faster than traditional antidepressants.",
    additionalInfo: "May show improvement within 1 week. Taken twice daily."
  },
  {
    brandName: "Caplyta",
    genericName: "Lumateperone",
    alternativeNames: [],
    uses: "Treats schizophrenia and bipolar depression. Novel atypical antipsychotic.",
    additionalInfo: "Take once daily at bedtime. Lower metabolic side effects than many antipsychotics."
  },
  {
    brandName: "Verzenio",
    genericName: "Abemaciclib",
    alternativeNames: [],
    uses: "Treats hormone receptor-positive breast cancer. CDK4/6 inhibitor.",
    additionalInfo: "Can be used as monotherapy unlike other CDK4/6 inhibitors. Causes diarrhea."
  },
  {
    brandName: "Tagrisso",
    genericName: "Osimertinib",
    alternativeNames: [],
    uses: "Treats non-small cell lung cancer with EGFR mutations. Targeted therapy.",
    additionalInfo: "Taken once daily. Third-generation EGFR inhibitor crosses blood-brain barrier."
  },
  {
    brandName: "Lynparza",
    genericName: "Olaparib",
    alternativeNames: [],
    uses: "Treats BRCA-mutated breast, ovarian, prostate, and pancreatic cancers. PARP inhibitor.",
    additionalInfo: "Taken twice daily. Monitor blood counts regularly."
  },
  {
    brandName: "Imbruvica",
    genericName: "Ibrutinib",
    alternativeNames: [],
    uses: "Treats certain blood cancers including CLL, mantle cell lymphoma, and Waldenstrom's.",
    additionalInfo: "Taken once daily. May cause bleeding; hold before procedures."
  },
  {
    brandName: "Jakafi",
    genericName: "Ruxolitinib",
    alternativeNames: [],
    uses: "Treats myelofibrosis and polycythemia vera. JAK inhibitor for blood disorders.",
    additionalInfo: "Taken twice daily. Monitor blood counts. Do not stop abruptly."
  },
  {
    brandName: "Pomalyst",
    genericName: "Pomalidomide",
    alternativeNames: [],
    uses: "Treats multiple myeloma after other treatments have failed.",
    additionalInfo: "REMS program required due to birth defect risk. Take on empty stomach."
  },
  {
    brandName: "Tarceva",
    genericName: "Erlotinib",
    alternativeNames: [],
    uses: "Treats non-small cell lung cancer and pancreatic cancer. EGFR inhibitor.",
    additionalInfo: "Take on empty stomach. Rash is common and may indicate effectiveness."
  },
  {
    brandName: "Sprycel",
    genericName: "Dasatinib",
    alternativeNames: [],
    uses: "Treats chronic myeloid leukemia and Philadelphia chromosome-positive ALL.",
    additionalInfo: "Taken once daily. Can cause fluid retention around lungs."
  },
  {
    brandName: "Tasigna",
    genericName: "Nilotinib",
    alternativeNames: [],
    uses: "Treats chronic myeloid leukemia. Second-generation BCR-ABL tyrosine kinase inhibitor.",
    additionalInfo: "Take on empty stomach. Must fast 2 hours before and 1 hour after. Monitor QT interval."
  },

  // ========== BLOOD CLOTTING / PLATELET MEDICATIONS ==========

  {
    brandName: "Aggrenox",
    genericName: "Aspirin/Dipyridamole",
    alternativeNames: [],
    uses: "Prevents stroke after transient ischemic attack (TIA) or prior stroke.",
    additionalInfo: "Take twice daily. Headache common when starting; usually improves."
  },
  {
    brandName: "Brilinta",
    genericName: "Ticagrelor",
    alternativeNames: [],
    uses: "Prevents blood clots after heart attack or stent placement. Antiplatelet medication.",
    additionalInfo: "Take twice daily. Must use low-dose aspirin only (81mg). Do not crush."
  },
  {
    brandName: "Effient",
    genericName: "Prasugrel",
    alternativeNames: [],
    uses: "Prevents blood clots after heart attack treated with stent. Antiplatelet medication.",
    additionalInfo: "More potent than clopidogrel. Higher bleeding risk. Avoid in patients 75+ or with prior stroke."
  },
  {
    brandName: "Plavix",
    genericName: "Clopidogrel",
    alternativeNames: [],
    uses: "Prevents blood clots after heart attack, stroke, or stent placement. Most widely used antiplatelet.",
    additionalInfo: "Some patients are poor metabolizers (genetic test available). Avoid omeprazole interaction."
  },

  // ========== IRON INFUSIONS / SPECIALTY ANEMIA ==========

  {
    brandName: "Injectafer",
    genericName: "Ferric Carboxymaltose",
    alternativeNames: [],
    uses: "Treats iron deficiency anemia when oral iron is ineffective or not tolerated. IV iron infusion.",
    additionalInfo: "Given as 1-2 IV infusions. Can cause temporary low phosphorus levels."
  },
  {
    brandName: "Venofer",
    genericName: "Iron Sucrose",
    alternativeNames: [],
    uses: "Treats iron deficiency anemia in chronic kidney disease patients. IV iron.",
    additionalInfo: "Given as series of IV infusions over several weeks."
  },
  {
    brandName: "Feraheme",
    genericName: "Ferumoxytol",
    alternativeNames: [],
    uses: "Treats iron deficiency anemia in chronic kidney disease. IV iron that can be given quickly.",
    additionalInfo: "Given as 2 IV infusions 3-8 days apart. Monitor for allergic reactions."
  },

  // ========== NICHE BUT COMMONLY ENCOUNTERED ==========

  {
    brandName: "Elmiron",
    genericName: "Pentosan Polysulfate",
    alternativeNames: [],
    uses: "Treats interstitial cystitis (painful bladder syndrome).",
    additionalInfo: "Takes 3-6 months for full effect. Long-term use linked to eye problems."
  },
  {
    brandName: "Truvada (for PrEP)",
    genericName: "Emtricitabine/Tenofovir Disoproxil",
    alternativeNames: [],
    uses: "Prevents HIV infection when taken daily by high-risk individuals (pre-exposure prophylaxis).",
    additionalInfo: "Take daily for maximum protection. Regular HIV and kidney testing required."
  },
  {
    brandName: "Austedo",
    genericName: "Deutetrabenazine",
    alternativeNames: [],
    uses: "Treats tardive dyskinesia and Huntington's chorea (involuntary movements).",
    additionalInfo: "Take with food. Requires CYP2D6 metabolizer testing."
  },
  {
    brandName: "Ingrezza",
    genericName: "Valbenazine",
    alternativeNames: [],
    uses: "Treats tardive dyskinesia (involuntary movements from antipsychotic use).",
    additionalInfo: "First FDA-approved treatment for tardive dyskinesia. Taken once daily."
  },
  {
    brandName: "Botox",
    genericName: "OnabotulinumtoxinA",
    alternativeNames: [],
    uses: "Treats chronic migraines, overactive bladder, muscle spasticity, excessive sweating, and wrinkles.",
    additionalInfo: "Given by injection every 3 months for migraines (31 injection sites). Effects wear off."
  },
  {
    brandName: "Aimovig",
    genericName: "Erenumab-aooe",
    alternativeNames: [],
    uses: "Prevents migraine headaches. Monthly self-injection targeting CGRP receptor.",
    additionalInfo: "Autoinjector used once monthly. May cause constipation and injection site reactions."
  },
  {
    brandName: "Ozempic (for diabetes)",
    genericName: "Semaglutide Injection",
    alternativeNames: [],
    uses: "Treats type 2 diabetes by improving blood sugar control. GLP-1 receptor agonist.",
    additionalInfo: "Weekly injection. Also causes significant weight loss. Different from Wegovy dosing."
  },
  {
    brandName: "Rybelsus",
    genericName: "Semaglutide Oral",
    alternativeNames: [],
    uses: "Treats type 2 diabetes. First oral GLP-1 medication (tablet form of semaglutide).",
    additionalInfo: "Take on empty stomach with sip of water. Wait 30 minutes before eating or other meds."
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

