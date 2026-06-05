import { useId, useMemo, useState } from 'react'

export function Carousel({
  images,
  alt,
  onImageClick,
}: {
  images: string[]
  alt: string
  onImageClick?: () => void
}) {
  const uid = useId()
  const safe = useMemo(() => images.filter(Boolean), [images])
  const [idx, setIdx] = useState(0)

  if (safe.length === 0) return null
  const i = Math.max(0, Math.min(idx, safe.length - 1))

  return (
    <div className="carousel" aria-roledescription="carousel" aria-label={alt}>
      <img
        src={safe[i]}
        alt={alt}
        className={onImageClick ? 'carousel-img clickable' : 'carousel-img'}
        onClick={onImageClick}
      />

      {safe.length > 1 ? (
        <>
          <button
            type="button"
            className="carousel-btn left"
            onClick={(e) => {
              e.stopPropagation()
              setIdx((x) => (x - 1 + safe.length) % safe.length)
            }}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            className="carousel-btn right"
            onClick={(e) => {
              e.stopPropagation()
              setIdx((x) => (x + 1) % safe.length)
            }}
            aria-label="Next photo"
          >
            ›
          </button>

          <div className="carousel-dots" role="tablist" aria-label="Photo dots">
            {safe.map((_, dot) => (
              <button
                key={`${uid}_${dot}`}
                type="button"
                className={dot === i ? 'dot active' : 'dot'}
                onClick={(e) => {
                  e.stopPropagation()
                  setIdx(dot)
                }}
                aria-label={`Photo ${dot + 1}`}
                aria-selected={dot === i}
                role="tab"
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

