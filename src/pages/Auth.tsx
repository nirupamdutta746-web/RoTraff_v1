import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { ArrowRight, Loader2, Mail, UserX, Shield, KeyRound, UserPlus } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion } from "framer-motion"

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ensureRole = useMutation(api.users.ensureRole);
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  type AuthStep =
    | "signIn"
    | "signUp"
    | { email: string }
    | "forgotPassword"
    | { resetEmail: string };

  const [step, setStep] = useState<AuthStep>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetViaOtp, setResetViaOtp] = useState(false); // true if reset used email-otp fallback
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      // Ensure user has a role, then redirect based on it
      ensureRole().then(({ role }) => {
        if (role === "admin") {
          navigate("/admin");
        } else {
          navigate(redirect);
        }
      }).catch(() => {
        navigate(redirect);
      });
    }
  }, [authLoading, isAuthenticated, navigate, redirect, ensureRole]);

  // ── Email + Password Sign In ──
  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      await signIn("password", { flow: "signIn", email, password });
    } catch (error) {
      console.error("Sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to sign in. Check your email and password.",
      );
      setIsLoading(false);
    }
  };

  // ── Email + Password Sign Up ──
  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      await signIn("password", { flow: "signUp", email, password });
    } catch (error) {
      console.error("Sign-up error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to create account. Please try again.",
      );
      setIsLoading(false);
    }
  };

  // ── OTP verification (for forgot password reset) ──
  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const email = (step as { resetEmail: string }).resetEmail;
      const code = formData.get("code") as string;

      if (resetViaOtp) {
        // User signed up via email-otp — verify the OTP directly
        const otpFormData = new FormData();
        otpFormData.set("email", email);
        otpFormData.set("code", code);
        await signIn("email-otp", otpFormData);
        navigate(redirect);
      } else {
        // User has a password account — use password reset-verification
        const password = formData.get("newPassword") as string;
        await signIn("password", {
          flow: "reset-verification",
          email,
          password,
          code,
        });
        // Password reset succeeded — sign out and redirect to sign-in
        await signOut();
        setStep("signIn");
        setOtp("");
        setResetViaOtp(false);
        setError(null);
        setPasswordResetSuccess(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Reset verification error:", error);
      setError("The verification code is incorrect or has expired.");
      setIsLoading(false);
      setOtp("");
    }
  };

  // ── Forgot Password: send reset code ──
  const handleForgotPassword = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const email = formData.get("email") as string;
      // Try password reset first; fall back to email-otp for non-password accounts
      try {
        await signIn("password", { flow: "reset", email });
      } catch (pwError) {
        // If no password account exists, send an OTP instead
        const msg = pwError instanceof Error ? pwError.message : "";
        if (msg.includes("InvalidAccountId") || msg.includes("not found")) {
          const otpFormData = new FormData();
          otpFormData.set("email", email);
          await signIn("email-otp", otpFormData);
          setResetViaOtp(true);
        } else {
          throw pwError;
        }
      }
      setStep({ resetEmail: email });
      setIsLoading(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send reset code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  // ── Guest Login ──
  const handleGuestLogin = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        `Failed to sign in as guest: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      setIsLoading(false);
    }
  };

  // Derive the current email for the OTP screen
  const currentEmail =
    step && typeof step === "object" && "email" in step
      ? step.email
      : step && typeof step === "object" && "resetEmail" in step
        ? step.resetEmail
        : "";

  const isOtpStep =
    step && typeof step === "object" && "resetEmail" in step;

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-violet-400/10 rounded-full blur-3xl" />
      </div>

      {/* Auth Content */}
      <div className="flex-1 flex items-center justify-center relative z-10 px-4">
        <div className="flex items-center justify-center h-full flex-col">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="min-w-90 max-w-105 glass-card border-white/30 shadow-xl shadow-blue-500/5">
              {/* ── Sign In Step ── */}
              {step === "signIn" && (
                <>
                  <CardHeader className="text-center">
                    <div className="flex justify-center mb-2">
                      <img
                        src="/logo.png"
                        alt="RoTraff"
                        className="w-14 h-14 rounded-2xl shadow-xl shadow-blue-500/25 cursor-pointer object-cover"
                        onClick={() => navigate("/")}
                      />
                    </div>
                    <CardTitle className="text-xl">Welcome to RoTraff</CardTitle>
                    <CardDescription>
                      Sign in to report incidents and plan safe routes
                    </CardDescription>
                  </CardHeader>
                  {passwordResetSuccess && (
                    <div className="mx-6 mb-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm text-center">
                      ✅ Password reset successfully! Please sign in with your new password.
                    </div>
                  )}
                  <form onSubmit={handleSignIn}>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            name="email"
                            placeholder="Email address"
                            type="email"
                            className="pl-9 glass border-white/30 bg-white/40"
                            disabled={isLoading}
                            required
                          />
                        </div>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            name="password"
                            placeholder="Password"
                            type="password"
                            className="pl-9 glass border-white/30 bg-white/40"
                            disabled={isLoading}
                            required
                            minLength={8}
                          />
                        </div>
                        <Button
                          type="submit"
                          className="w-full cursor-pointer bg-linear-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Sign In
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                      {error && (
                        <p className="mt-2 text-sm text-red-500">{error}</p>
                      )}
                      <div className="mt-2 text-right">
                        <Button
                          type="button"
                          variant="link"
                          className="p-0 h-auto text-xs cursor-pointer"
                          onClick={() => setStep("forgotPassword")}
                        >
                          Forgot password?
                        </Button>
                      </div>
                      <div className="mt-3">
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/30" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-transparent px-2 text-muted-foreground">
                              Or
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full mt-4 glass border-white/30 bg-white/40 cursor-pointer"
                          onClick={() => setStep("signUp")}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Create New Account
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full mt-2 glass border-white/30 bg-white/40 cursor-pointer"
                          onClick={handleGuestLogin}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <UserX className="mr-2 h-4 w-4" />
                          )}
                          Continue as Guest
                        </Button>
                      </div>
                    </CardContent>
                  </form>
                </>
              )}

              {/* ── Sign Up Step ── */}
              {step === "signUp" && (
                <>
                  <CardHeader className="text-center">
                    <div className="flex justify-center mb-2">
                      <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-xl shadow-blue-500/25">
                        <UserPlus className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    <CardTitle className="text-xl">Create Account</CardTitle>
                    <CardDescription>
                      Join the community and help keep roads safe
                    </CardDescription>
                  </CardHeader>
                  <form onSubmit={handleSignUp}>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            name="email"
                            placeholder="Email address"
                            type="email"
                            className="pl-9 glass border-white/30 bg-white/40"
                            disabled={isLoading}
                            required
                          />
                        </div>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            name="password"
                            placeholder="Password (min 8 characters)"
                            type="password"
                            className="pl-9 glass border-white/30 bg-white/40"
                            disabled={isLoading}
                            required
                            minLength={8}
                          />
                        </div>
                        <Button
                          type="submit"
                          className="w-full cursor-pointer bg-linear-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Create Account
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                      {error && (
                        <p className="mt-2 text-sm text-red-500">{error}</p>
                      )}
                      <div className="mt-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          Already have an account?{" "}
                          <Button
                            variant="link"
                            className="p-0 h-auto cursor-pointer"
                            onClick={() => setStep("signIn")}
                          >
                            Sign in
                          </Button>
                        </p>
                      </div>
                    </CardContent>
                  </form>
                </>
              )}

              {/* ── Forgot Password Step ── */}
              {step === "forgotPassword" && (
                <>
                  <CardHeader className="text-center mt-4">
                    <CardTitle>Reset Password</CardTitle>
                    <CardDescription>
                      Enter your email to receive a reset code
                    </CardDescription>
                  </CardHeader>
                  <form onSubmit={handleForgotPassword}>
                    <CardContent className="pb-4">
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          name="email"
                          placeholder="name@example.com"
                          type="email"
                          className="pl-9 glass border-white/30 bg-white/40"
                          disabled={isLoading}
                          required
                          autoFocus
                        />
                      </div>
                      {error && (
                        <p className="mt-2 text-sm text-red-500">{error}</p>
                      )}
                    </CardContent>
                    <CardFooter className="flex-col gap-2">
                      <Button
                        type="submit"
                        className="w-full cursor-pointer bg-linear-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Send Reset Code
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setStep("signIn")}
                        disabled={isLoading}
                        className="w-full cursor-pointer"
                      >
                        Back to Sign In
                      </Button>
                    </CardFooter>
                  </form>
                </>
              )}

              {/* ── OTP Verification Step (Reset Password) ── */}
              {isOtpStep && (
                <>                    <CardHeader className="text-center mt-4">
                    <CardTitle>{resetViaOtp ? "Verify Your Email" : "Enter Reset Code"}</CardTitle>
                    <CardDescription>
                      {resetViaOtp
                        ? `We've sent a verification code to ${currentEmail}`
                        : `We've sent a reset code to ${currentEmail}`}
                    </CardDescription>
                  </CardHeader>
                  <form onSubmit={handleOtpSubmit}>
                    <CardContent className="pb-4">
                      <input type="hidden" name="email" value={currentEmail} />
                      <input type="hidden" name="code" value={otp} />

                      <div className="space-y-3">
                        <div className="flex justify-center">
                          <InputOTP
                            value={otp}
                            onChange={setOtp}
                            maxLength={6}
                            disabled={isLoading}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                otp.length === 6 &&
                                !isLoading
                              ) {
                                const form = (e.target as HTMLElement).closest(
                                  "form",
                                );
                                if (form) form.requestSubmit();
                              }
                            }}
                          >
                            <InputOTPGroup>
                              {Array.from({ length: 6 }).map((_, index) => (
                                <InputOTPSlot key={index} index={index} />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                        {!resetViaOtp && (
                          <div className="relative">
                            <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              name="newPassword"
                              placeholder="New password (min 8 characters)"
                              type="password"
                              className="pl-9 glass border-white/30 bg-white/40"
                              disabled={isLoading}
                              required
                              minLength={8}
                            />
                          </div>
                        )}
                      </div>
                      {error && (
                        <p className="mt-2 text-sm text-red-500 text-center">
                          {error}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground text-center mt-4">
                        Didn't receive a code?{" "}
                        <Button
                          variant="link"
                          className="p-0 h-auto cursor-pointer"
                          onClick={() => {
                            setStep("forgotPassword");
                            setOtp("");
                          }}
                        >
                          Resend code
                        </Button>
                      </p>
                    </CardContent>
                    <CardFooter className="flex-col gap-2">
                      <Button
                        type="submit"
                        className="w-full cursor-pointer bg-linear-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600"
                        disabled={isLoading || otp.length !== 6}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            {resetViaOtp ? "Verify Code" : "Reset Password"}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setStep("signIn");
                          setOtp("");
                          setResetViaOtp(false);
                        }}
                        disabled={isLoading}
                        className="w-full cursor-pointer"
                      >
                        Back to Sign In
                      </Button>
                    </CardFooter>
                  </form>
                </>
              )}

              <div className="py-4 px-6 text-xs text-center text-muted-foreground bg-white/20 border-t border-white/20 rounded-b-xl">
                Secured by{" "}
                <a
                  href="https://freebuff.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary transition-colors"
                >
                  freebuff.com
                </a>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
