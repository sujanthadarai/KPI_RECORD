import { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const login = useAppStore((s) => s.login);
  const currentUser = useAppStore((s) => s.currentUser);

  useEffect(() => {
    if (currentUser) redirectBasedOnRole(currentUser);
  }, [currentUser]);

  const redirectBasedOnRole = (user: any) => {
    if (user.role === "admin") window.location.href = "/admin/dashboard";
    else if (user.role === "instructor") window.location.href = "/instructor/dashboard";
    else window.location.href = "/";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const success = await login(username, password);
      if (success && currentUser) {
        redirectBasedOnRole(currentUser);
      } else {
        setError("Invalid credentials. Try: admin, sarah, michael, priya, david");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0f14] p-4 relative overflow-hidden">
      {/* Background mesh */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 10%, rgba(99,102,241,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 85% 85%, rgba(16,185,129,0.12) 0%, transparent 55%),
            radial-gradient(ellipse 40% 40% at 60% 40%, rgba(244,114,182,0.08) 0%, transparent 50%)`
        }}
      />
      {/* Grid lines */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
          backgroundSize: "40px 40px"
        }}
      />

      <Card className="relative z-10 w-full max-w-md border border-white/[0.08] bg-[rgba(20,22,30,0.85)] backdrop-blur-2xl shadow-2xl rounded-2xl animate-fade-in">
        <CardHeader className="pb-0 pt-10 px-10 space-y-0">

          {/* Logo + Brand */}
          <div className="flex items-center gap-3 mb-7">
            <div className="w-[52px] h-[52px] rounded-[14px] overflow-hidden flex-shrink-0 shadow-lg"
              style={{ boxShadow: "0 8px 24px rgba(99,102,241,0.35)" }}>
              <img
                src="/logo.png"
                alt="Instructor Hub Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[22px] font-serif text-white leading-tight tracking-tight">
                Instructor Hub
              </span>
              <span className="text-[11px] text-gray-500 uppercase tracking-widest font-medium">
                Sipalaya Info Tech
              </span>
            </div>
          </div>

          <div className="h-px w-full mb-7"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }}
          />

          <CardTitle className="text-[26px] font-serif text-white tracking-tight">
            Welcome back
          </CardTitle>
          <CardDescription className="text-sm text-gray-500 mt-1">
            Sign in to manage classes & track performance
          </CardDescription>
        </CardHeader>

        <CardContent className="px-10 pb-10 pt-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username"
                className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
                className="bg-white/[0.04] border-white/[0.09] text-white placeholder:text-gray-700
                           focus:border-indigo-500/50 focus:ring-indigo-500/10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password"
                className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
                className="bg-white/[0.04] border-white/[0.09] text-white placeholder:text-gray-700
                           focus:border-indigo-500/50 focus:ring-indigo-500/10 rounded-xl"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 rounded-xl font-semibold text-sm tracking-wide h-11
                         bg-gradient-to-br from-indigo-500 to-violet-600
                         hover:opacity-90 hover:-translate-y-px transition-all
                         shadow-[0_4px_16px_rgba(99,102,241,0.3)]"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;