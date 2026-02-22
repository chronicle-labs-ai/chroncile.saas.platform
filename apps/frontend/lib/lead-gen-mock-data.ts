/**
 * Mock lead/company data for the Lead gen (demo) flow.
 * Target profile: large CPG or D2C brands with large call centers exploring AI agents.
 */

export interface LeadGenLead {
  id: string;
  name: string;
  domain: string;
  industry: string;
  region: string;
  call_center_size: string;
  ai_agents_exploration: string;
}

export const LEAD_GEN_MOCK_LEADS: LeadGenLead[] = [
  { id: "lg_001", name: "FreshCo Consumer Goods", domain: "freshco.example.com", industry: "CPG", region: "North America", call_center_size: "500+", ai_agents_exploration: "Pilot" },
  { id: "lg_002", name: "HomeStyle D2C", domain: "homestyle.io", industry: "D2C", region: "North America", call_center_size: "200+", ai_agents_exploration: "Evaluating" },
  { id: "lg_003", name: "NutriBrands Inc", domain: "nutribrands.com", industry: "CPG", region: "EMEA", call_center_size: "1000+", ai_agents_exploration: "Adopting" },
  { id: "lg_004", name: "DirectCare Health", domain: "directcare.health", industry: "D2C", region: "North America", call_center_size: "300+", ai_agents_exploration: "Pilot" },
  { id: "lg_005", name: "Everyday Essentials Co", domain: "everydayessentials.com", industry: "CPG", region: "APAC", call_center_size: "400+", ai_agents_exploration: "Evaluating" },
  { id: "lg_006", name: "StyleBox D2C", domain: "stylebox.co", industry: "D2C", region: "North America", call_center_size: "150+", ai_agents_exploration: "Adopting" },
  { id: "lg_007", name: "GreenLife Foods", domain: "greenlifefoods.com", industry: "CPG", region: "EMEA", call_center_size: "600+", ai_agents_exploration: "Pilot" },
  { id: "lg_008", name: "TechGear Direct", domain: "techgeardirect.com", industry: "D2C", region: "North America", call_center_size: "250+", ai_agents_exploration: "Evaluating" },
  { id: "lg_009", name: "PureBeverage Group", domain: "purebeverage.com", industry: "CPG", region: "Latin America", call_center_size: "800+", ai_agents_exploration: "Adopting" },
  { id: "lg_010", name: "WellnessFirst D2C", domain: "wellnessfirst.io", industry: "D2C", region: "EMEA", call_center_size: "180+", ai_agents_exploration: "Pilot" },
  { id: "lg_011", name: "Household Brands LLC", domain: "householdbrands.com", industry: "CPG", region: "North America", call_center_size: "350+", ai_agents_exploration: "Evaluating" },
  { id: "lg_012", name: "FitDirect Athletics", domain: "fitdirect.com", industry: "D2C", region: "APAC", call_center_size: "220+", ai_agents_exploration: "Adopting" },
];
