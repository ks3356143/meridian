import type { RequirementPrimaryKind, RequirementRecord } from "@/features/requirements/types";

export type BulkPreviewRow = {
  requirement: RequirementRecord;
  name: string;
  identifier: string;
  primaryKind: RequirementPrimaryKind;
  secondaryKinds: RequirementPrimaryKind[];
  changed: boolean;
  conflict: "name" | "identifier" | null;
};

export function buildBulkPreview({
  requirements,
  allRequirements,
  primaryKind,
  secondaryKinds,
  find,
  replacement,
  applyToName,
  applyToIdentifier,
}: {
  requirements: RequirementRecord[];
  allRequirements: RequirementRecord[];
  primaryKind: RequirementPrimaryKind | null;
  secondaryKinds: RequirementPrimaryKind[] | null;
  find: string;
  replacement: string;
  applyToName: boolean;
  applyToIdentifier: boolean;
}): BulkPreviewRow[] {
  const rows: BulkPreviewRow[] = requirements.map((requirement) => {
    const nextKind = primaryKind ?? requirement.primaryKind;
    const canReplace = find.trim() !== "";
    const nextName =
      applyToName && canReplace ? requirement.name.split(find).join(replacement) : requirement.name;
    const nextIdentifier =
      applyToIdentifier && canReplace
        ? requirement.externalIdentifier.split(find).join(replacement)
        : requirement.externalIdentifier;
    const nextSecondary = secondaryKinds ?? requirement.secondaryKinds;
    return {
      requirement,
      name: nextName,
      identifier: nextIdentifier,
      primaryKind: nextKind,
      secondaryKinds: nextSecondary,
      changed:
        nextName !== requirement.name ||
        nextIdentifier !== requirement.externalIdentifier ||
        nextKind !== requirement.primaryKind ||
        nextSecondary.join(",") !== requirement.secondaryKinds.join(","),
      conflict: null,
    };
  });

  const nameCounts = new Map<string, number>();
  const codeCounts = new Map<string, number>();
  for (const requirement of allRequirements) {
    if (requirement.status !== "candidate" && requirement.status !== "official") continue;
    countKey(nameCounts, `${requirement.sourceVersionId}\0${requirement.name}`, 1);
    if (requirement.externalIdentifier) {
      countKey(codeCounts, `${requirement.sourceVersionId}\0${requirement.externalIdentifier}`, 1);
    }
  }
  for (const row of rows) {
    if (!row.changed) continue;
    if (!row.name.trim()) row.conflict = "name";
    if (row.name.length > 240) row.conflict = "name";
    if (row.identifier.length > 64) row.conflict = "identifier";
    countKey(nameCounts, `${row.requirement.sourceVersionId}\0${row.requirement.name}`, -1);
    countKey(nameCounts, `${row.requirement.sourceVersionId}\0${row.name}`, 1);
    if (row.requirement.externalIdentifier) {
      countKey(
        codeCounts,
        `${row.requirement.sourceVersionId}\0${row.requirement.externalIdentifier}`,
        -1,
      );
    }
    if (row.identifier) {
      countKey(codeCounts, `${row.requirement.sourceVersionId}\0${row.identifier}`, 1);
    }
  }
  for (const row of rows) {
    if (!row.changed) continue;
    if ((nameCounts.get(`${row.requirement.sourceVersionId}\0${row.name}`) ?? 0) > 1) {
      row.conflict = "name";
    } else if (
      row.identifier &&
      (codeCounts.get(`${row.requirement.sourceVersionId}\0${row.identifier}`) ?? 0) > 1
    ) {
      row.conflict = "identifier";
    }
  }
  return rows;
}

function countKey(map: Map<string, number>, key: string, delta: number) {
  map.set(key, (map.get(key) ?? 0) + delta);
}
