import type {
  ProjectClassification,
  ProjectNature,
  ProjectPlatform,
  SecurityLevel,
  SoftwareType,
} from "@/features/projects/types";

export interface BasicProjectValues {
  identifierSuffix: string;
  name: string;
  nature: ProjectNature;
  platform: ProjectPlatform;
  softwareType: SoftwareType;
  classification: ProjectClassification;
  securityLevel: SecurityLevel;
}

export const initialBasicValues: BasicProjectValues = {
  identifierSuffix: "",
  name: "",

  nature: "鉴定测评",
  platform: "CPU/非嵌",
  softwareType: "新研",
  classification: "内部",
  securityLevel: "C",
};
