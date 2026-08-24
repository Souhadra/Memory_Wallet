import type { AccessLevel } from "./types";
import { getPermissions, savePermissions } from "./storage";
import { nowISO, uid } from "./constants";

const DEFAULT_ACCESS: AccessLevel = "ask";

export async function getAccessLevel(
  aiApplicationId: string,
  profileId: string,
): Promise<AccessLevel> {
  const perms = await getPermissions();
  const p = perms.find(
    (x) => x.aiApplicationId === aiApplicationId && x.profileId === profileId,
  );
  return p?.access ?? DEFAULT_ACCESS;
}

export async function setAccessLevel(
  aiApplicationId: string,
  profileId: string,
  access: AccessLevel,
): Promise<void> {
  const perms = await getPermissions();
  const existing = perms.find(
    (x) => x.aiApplicationId === aiApplicationId && x.profileId === profileId,
  );
  if (existing) {
    existing.access = access;
    existing.updatedAt = nowISO();
    await savePermissions(perms);
  } else {
    perms.push({
      id: uid("perm"),
      aiApplicationId,
      profileId,
      access,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });
    await savePermissions(perms);
  }
}
