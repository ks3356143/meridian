import { FolderInput, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function ReceivedAssetDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const emitFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    onFiles(Array.from(fileList));
  };

  return (
    <section
      data-dragging={dragging}
      className="received-dropzone"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        emitFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        aria-label="选择接收文件"
        onChange={(event) => {
          emitFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <span className="received-dropzone-icon">
        <FolderInput aria-hidden />
      </span>
      <div className="min-w-0 text-center">
        <p className="text-sm font-semibold">接收文件投放区</p>
        <p className="mt-1 text-xs text-muted-foreground">DOC / DOCX / PDF / ZIP / RAR / 7Z</p>
      </div>
      <Button type="button" onClick={() => inputRef.current?.click()}>
        <Upload data-icon="inline-start" aria-hidden />
        选择文件
      </Button>
    </section>
  );
}
