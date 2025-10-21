import { getFirestoreClient } from "@/lib/firebase";
import { collection, orderBy, query, where } from "firebase/firestore";

export function servicesQueryForCompany(companyId: string) {
  const firestore = getFirestoreClient();
  return query(
    collection(firestore, "services"),
    where("status", "==", "Aberto"),
    where("assignedTo.companyId", "==", companyId),
    orderBy("createdAt", "desc"),
  );
}
