import { api, apiUrl } from "./api";
import { useSession } from "../store/session";
export async function shareInvoicePdf(id: string, number: string) {
  await api("/auth/me");
  const response = await fetch(`${apiUrl}/api/invoices/${id}/pdf`, {
    headers: { Authorization: `Bearer ${useSession.getState().accessToken}` },
    signal: AbortSignal.timeout(30000),
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/pdf")
  )
    throw new Error("Could not download this invoice. Please retry.");
  const url = URL.createObjectURL(await response.blob()),
    link = document.createElement("a");
  link.href = url;
  link.download = `${number.replace(/[^a-z0-9_-]/gi, "_")}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
