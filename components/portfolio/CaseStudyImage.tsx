import Image from "next/image";

export function CaseStudyImage({
  src,
  alt,
  caption,
  aspectRatio,
  fit = "cover",
  objectPosition = "center",
  captionPosition = "top",
  className = "",
  loading = "lazy",
}: {
  src: string;
  alt: string;
  caption?: string;
  aspectRatio: string;
  fit?: "cover" | "contain";
  objectPosition?: "center" | "top";
  captionPosition?: "top" | "bottom";
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const figureCaption = caption && (
    <figcaption className="px-4 py-3 text-xs leading-relaxed text-muted">
      {caption}
    </figcaption>
  );

  return (
    <figure className={`overflow-hidden rounded-xl bg-mist ${className}`}>
      {captionPosition === "top" && figureCaption}
      <div className="relative w-full" style={{ aspectRatio }}>
        <Image
          src={src}
          alt={alt}
          fill
          loading={loading}
          quality={90}
          sizes="(min-width: 1200px) 1100px, (min-width: 700px) 90vw, 100vw"
          className={`${fit === "cover" ? "object-cover" : "object-contain"} ${objectPosition === "top" ? "object-top" : "object-center"}`}
        />
      </div>
      {captionPosition === "bottom" && figureCaption}
    </figure>
  );
}
