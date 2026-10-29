import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { saveFile } from "@/lib/export";
import { errorMessage } from "@/services";

// A file the API generates (PDF, Excel), saved once it arrives. `variables`
// says which one is on its way, for the button's spinner.
export default function useFileDownload<T>(
  fetchFile: (target: T) => Promise<{ blob: Blob; fileName: string }>
) {
  return useMutation({
    mutationFn: fetchFile,
    onSuccess: ({ blob, fileName }) => saveFile(blob, fileName),
    onError: (error) => toast.error(errorMessage(error)),
  });
}
