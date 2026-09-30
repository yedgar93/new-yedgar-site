import { releases } from "@/data/releases";
import type { Release } from "@/types";

/** Artwork-bearing releases, in the same order the home ring uses. */
export const artReleases: Release[] = releases.filter((release) => Boolean(release.artwork));
