"use client";

import { createPack, deletePack, getPack, listContainers, listPacks, updatePack } from "@/lib/api/packing";

export async function fetchPackRows(params = {}) {
  return listPacks(params);
}

export async function fetchContainerRows(params = {}) {
  return listContainers(params);
}

export async function fetchPack(id) {
  return getPack(id);
}

export async function savePack(payload) {
  if (payload.id) {
    const { id, ...rest } = payload;
    return updatePack(id, rest);
  }
  return createPack(payload);
}

export async function removePack(id) {
  return deletePack(id);
}
