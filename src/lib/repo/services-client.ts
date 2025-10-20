import { db } from "@/lib/firebase";
import { collection, orderBy, query, where } from "firebase/firestore";

export function servicesQueryForCompany(companyId: string) {
  return query(
    collection(db, "services"),
    where("status", "==", "Aberto"),
    where("assignedTo.companyId", "==", companyId),
    orderBy("createdAt", "desc"),
  );
}
