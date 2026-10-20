import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api, apiUrl } from "./api";
import { useSession } from "../store/session";
export async function shareInvoicePdf(id: string, number: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error(
      "Document sharing is unavailable on this device. Use the WhatsApp link instead.",
    );
  await api("/auth/me");
  const file = FileSystem.cacheDirectory + `${number}.pdf`;
  try {
    const result = await FileSystem.downloadAsync(
      `${apiUrl}/api/invoices/${id}/pdf`,
      file,
      {
        headers: {
          Authorization: `Bearer ${useSession.getState().accessToken}`,
        },
      },
    );
    if (result.status !== 200)
      throw new Error("Could not download this invoice. Please retry.");
    await Sharing.shareAsync(result.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Share invoice",
    });
  } finally {
    await FileSystem.deleteAsync(file, { idempotent: true });
  }
}
