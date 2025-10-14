import ServiceClient from "./ServiceClient";

type PageProps = {
  params: { serviceId: string };
  searchParams?: { token?: string };
};

export const dynamic = "force-dynamic";

export default function ServicePage({ params, searchParams }: PageProps) {
  const token = typeof searchParams?.token === "string" ? searchParams.token : "";
  return <ServiceClient serviceId={params.serviceId} token={token} />;
}
