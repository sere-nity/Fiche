import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 pt-16 pb-10">
      <h1 className="font-serif text-[32px] leading-tight">Sign in</h1>
      <p className="mt-2 leading-normal text-muted">
        Just your email. Your cards and essays are kept under it, so you can come back from any browser.
      </p>
      {/* The form reads ?next= from the URL, which is only known per request. */}
      <Suspense>
        <SignInForm />
      </Suspense>
      <p className="mt-6 text-xs leading-normal text-muted">
        Prototype: there is no password, so don&apos;t use this for anything private.
      </p>
    </main>
  );
}
