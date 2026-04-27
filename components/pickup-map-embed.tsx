type PickupMapEmbedProps = {
  title: string;
  src: string;
  className?: string;
};

export function PickupMapEmbed({ title, src, className = "" }: PickupMapEmbedProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-stone-200/70 bg-stone-100 ${className}`.trim()}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-full w-full border-0"
      />
      <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-12 w-12 rounded-bl-2xl bg-stone-100" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/10 to-transparent" />
    </div>
  );
}
