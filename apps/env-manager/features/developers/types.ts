export interface Developer {
  id: string;
  name: string;
  email: string | null;
  tunnelDomain: string;
  dopplerSuffix: string;
  createdAt: string;
}

export interface CreateDeveloperInput {
  name: string;
  email: string;
  tunnelDomain: string;
}
