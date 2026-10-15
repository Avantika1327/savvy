export type PlantCoverageType = "LOCAL" | "PAN_INDIA";

export type Plant = {
  id: number;
  tenantId: string;
  name: string;
  address: string | null;
  manager: string | null;
  managerEmail: string | null;
  coverageType: PlantCoverageType;
  location: string | null;
  pincode: string | null;
  details: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlantInput = {
  name: string;
  address: string | null;
  manager: string | null;
  managerEmail: string | null;
  coverageType: PlantCoverageType;
  location: string | null;
  pincode: string | null;
  details: string | null;
};

export type PlantStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
