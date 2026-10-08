"use client";
import { useState } from "react";
import Image from "next/image";
import type { PublicProduct } from "./public";
type Photo = { url: string; alt: string };
function Video({ video }: { video: PublicProduct["videos"][number] }) {
  const [playing, setPlaying] = useState(false);
  if (video.source === "CLOUDINARY")
    return (
      <video
        controls
        playsInline
        preload="none"
        poster={video.poster}
        aria-label={video.title}
        src={video.url}
      />
    );
  return playing ? (
    <iframe
      src={video.url}
      title={video.title}
      allow="encrypted-media; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  ) : (
    <button
      type="button"
      className="product-video-poster"
      onClick={() => setPlaying(true)}
    >
      <Image unoptimized src={video.poster} alt="" width={760} height={428} />
      <span>▶ Play {video.title}</span>
    </button>
  );
}
export function ProductGallery({
  images,
  videos,
  hoverImage,
}: {
  images: Photo[];
  videos: PublicProduct["videos"];
  hoverImage?: Photo | null;
}) {
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const items = [
    ...images.map((image) => ({ kind: "image" as const, image })),
    ...videos.map((video) => ({ kind: "video" as const, video })),
  ];
  const current = items[selected] ?? items[0];
  const photo =
    current?.kind === "image"
      ? hovered && selected === 0 && hoverImage
        ? hoverImage
        : current.image
      : null;
  return (
    <div className="product-gallery">
      <div
        className="product-gallery-stage"
        tabIndex={
          hoverImage && current?.kind === "image" && selected === 0
            ? 0
            : undefined
        }
        aria-label={
          hoverImage
            ? "Product image. Focus to view the alternate image."
            : undefined
        }
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        {photo ? (
          failed.includes(photo.url) ? (
            <div className="product-no-image">This image is unavailable.</div>
          ) : (
            <Image
              key={photo.url}
              priority={selected === 0}
              unoptimized
              referrerPolicy="no-referrer"
              src={photo.url}
              alt={photo.alt}
              width={760}
              height={640}
              className="product-main-image"
              onError={() => setFailed((values) => [...values, photo.url])}
            />
          )
        ) : current?.kind === "video" ? (
          <Video key={current.video.url} video={current.video} />
        ) : (
          <div className="product-no-image">No product media</div>
        )}
      </div>
      <div
        className="product-thumbnails"
        aria-label="Product images and videos"
      >
        {items.map((item, index) => (
          <button
            key={
              item.kind === "image"
                ? item.image.url + index
                : item.video.url + index
            }
            type="button"
            aria-label={
              item.kind === "image"
                ? "View image " + (index + 1)
                : "View video: " + item.video.title
            }
            aria-pressed={index === selected}
            onClick={() => {
              setSelected(index);
              setHovered(false);
            }}
          >
            {item.kind === "image" ? (
              <Image
                unoptimized
                referrerPolicy="no-referrer"
                src={item.image.url}
                alt=""
                width={80}
                height={80}
              />
            ) : (
              <>
                {item.video.poster && (
                  <Image
                    unoptimized
                    src={item.video.poster}
                    alt=""
                    width={80}
                    height={80}
                  />
                )}
                <span className="product-video-label">▶ Video</span>
              </>
            )}
          </button>
        ))}
      </div>
      <p className="product-gallery-count" aria-live="polite">
        {items.length
          ? String(Math.min(selected, items.length - 1) + 1) +
            " / " +
            items.length
          : ""}
        {current?.kind === "video" ? " · " + current.video.title : ""}
      </p>
    </div>
  );
}
