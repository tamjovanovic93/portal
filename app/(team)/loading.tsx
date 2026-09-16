import Loader from "@/components/ui/Loader";

// Route-level fallback for the team app. The sidebar and top bar come from the
// layout and stay put; only the content area swaps to this while a page's data
// resolves. The client portal is deliberately not covered yet.
export default function TeamLoading() {
  return <Loader center />;
}
