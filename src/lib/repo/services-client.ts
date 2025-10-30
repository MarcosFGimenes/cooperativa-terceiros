"use client";

import { tryGetFirestore } from "@/lib/firebase";
import { collection, orderBy, query, where } from "firebase/firestore";

export function servicesQueryForCompany(companyId: string) {
  const normalizedCompanyId = companyId.trim();
  const { db, error } = tryGetFirestore();
  if (!db) {
    throw error ?? new Error("Firestore client is not available");
  }
  return query(
    collection(db, "services"),
    where("status", "==", "Aberto"),
    where("assignedTo.companyId", "==", normalizedCompanyId),
    orderBy("createdAt", "desc"),
  );
}
