import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
  maxFiles?: number;
}

async function uploadToCloudinary(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", UPLOAD_PRESET!);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body }
  );
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const data = await res.json();
  return data.secure_url as string;
}

export default function CloudinaryUpload({ images, onChange, maxFiles = 10 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  async function processFiles(fileList: FileList) {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      alert(
        "Cloudinary is not configured.\n" +
        "Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your .env file."
      );
      return;
    }

    const slots = maxFiles - images.length;
    const files = Array.from(fileList).slice(0, slots);
    if (!files.length) return;

    setErrors([]);
    setUploading(true);
    setDone(0);
    setTotal(files.length);

    const newUrls: string[] = [];
    const errs: string[] = [];

    for (const file of files) {
      try {
        const url = await uploadToCloudinary(file);
        newUrls.push(url);
      } catch (e: any) {
        errs.push(`${file.name}: ${e.message}`);
      }
      setDone(d => d + 1);
    }

    onChange([...images, ...newUrls]);
    setErrors(errs);
    setUploading(false);
    // Reset input so the same file can be picked again
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleRemove(index: number) {
    const next = [...images];
    next.splice(index, 1);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : uploading
            ? "border-blue-300 bg-blue-50 cursor-default"
            : "border-gray-300 hover:border-primary hover:bg-gray-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />

        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
            <p className="text-sm font-medium text-blue-700">
              Uploading {done} / {total}…
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-sm font-medium text-gray-700">
              Click to select or drag &amp; drop images
            </p>
            <p className="text-xs text-gray-400">
              PNG, JPG, WEBP · up to {maxFiles} images
            </p>
          </div>
        )}
      </div>

      {/* Upload errors */}
      {errors.length > 0 && (
        <div className="text-xs text-red-600 space-y-0.5">
          {errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}

      {/* Image preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {images.map((url, i) => (
            <div key={i} className="relative group aspect-square">
              <img
                src={url}
                alt={`Product image ${i + 1}`}
                className="w-full h-full object-cover rounded border"
              />
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
              >
                <X className="h-3 w-3" />
              </button>
              {i === 0 && (
                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">
                  Main
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
