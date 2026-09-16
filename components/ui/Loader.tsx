// Loading indicator: the word first, then the spinner.
//
// Used by the route-level loading.tsx files, and safe to drop anywhere an
// async section is pending. `center` fills the area and centres it, which is
// what a whole-page fallback wants; without it the loader sits inline.
export default function Loader({
  label = "Loading",
  center = false,
}: {
  label?: string;
  center?: boolean;
}) {
  const loader = (
    <span className="zp-loader" role="status" aria-live="polite">
      <span>{label}</span>
      <span className="zp-spinner" aria-hidden="true" />
    </span>
  );
  if (!center) return loader;
  return <div className="zp-loader-center">{loader}</div>;
}
