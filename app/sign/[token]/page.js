import SignClient from "@/components/SignClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign your document — Transworld",
  robots: { index: false, follow: false },
};

export default function SignPage({ params }) {
  return <SignClient token={params.token} />;
}
